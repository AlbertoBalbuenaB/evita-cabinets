import { formatCurrency } from '../lib/calculations';
import { calculateAreaBoxesAndPallets } from '../lib/boxesAndPallets';
import { supabase } from '../lib/supabase';
import type { Quotation, ProjectArea, AreaCabinet, AreaItem, AreaCountertop, AreaClosetItem, Product, PriceListItem } from '../types';
import { filterProjectBriefForPDF, renderBriefBlocksAsHTML } from './filterProjectBrief';

export interface PDFOverrides {
  pdfProjectName?: string;
  pdfCustomer?: string;
  pdfAddress?: string;
  pdfProjectBrief?: string;
  /**
   * Optimizer-mode override: per-area cabinet subtotal in MXN, pre-quantity.
   *
   * When present for a given `area.id`, the PDF uses this value instead of
   * `Σ cabinet.subtotal` for that area. All downstream math (profit
   * multiplier, tariff, referral, tax, USD conversion, boxes/sf) is
   * unchanged. Areas NOT present in the map keep their ft² behavior, so
   * mixed-mode quotations (or areas without an optimizer contribution) stay
   * byte-identical to the legacy output.
   *
   * Populated by `resolveOptimizerAreaSubtotals()` in ProjectDetails when
   * `quotations.pricing_method === 'optimizer'` and the active run is
   * fresh. Left undefined in ft² mode.
   */
  optimizerAreaSubtotals?: Record<string, number>;
  /**
   * Pricing method label surfaced in the PDF header so the printed
   * document is self-documenting. 'optimizer' prints a small badge next
   * to the title; 'sqft' or undefined prints nothing extra.
   */
  pricingMethodLabel?: 'sqft' | 'optimizer';
}

export async function printQuotation(
  project: Quotation,
  areas: (ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[]; closetItems?: AreaClosetItem[] })[],
  products: Product[] = [],
  priceList: PriceListItem[] = [],
  overrides: PDFOverrides = {}
) {
  const resolvedName = overrides.pdfProjectName ?? project.name;
  const resolvedAddress = overrides.pdfAddress ?? (project.address || '');
  const resolvedBrief = overrides.pdfProjectBrief ?? filterProjectBriefForPDF(project.project_brief || '');
  // Optimizer-mode swap: if the caller passed per-area overrides, use them
  // in place of `Σ cabinet.subtotal` for that area. Areas missing from the
  // map fall back to the ft² sum, so mixed-mode/ft²-mode quotations keep
  // their existing behavior.
  const resolveAreaCabinetsTotal = (area: ProjectArea & { cabinets: AreaCabinet[] }) => {
    const override = overrides.optimizerAreaSubtotals?.[area.id];
    if (typeof override === 'number' && Number.isFinite(override)) return override;
    return area.cabinets.reduce((s, c) => s + (c.subtotal ?? 0), 0);
  };

  const cabinetsSubtotal = areas.reduce(
    (sum, area) => sum + resolveAreaCabinetsTotal(area) * (area.quantity ?? 1),
    0
  );

  const itemsSubtotal = areas.reduce(
    (sum, area) => sum + area.items.reduce((s, i) => s + i.subtotal, 0) * (area.quantity ?? 1),
    0
  );

  const countertopsSubtotal = areas.reduce(
    (sum, area) => sum + area.countertops.reduce((s, ct) => s + ct.subtotal, 0) * (area.quantity ?? 1),
    0
  );

  const closetItemsSubtotal = areas.reduce(
    (sum, area) => sum + (area.closetItems || []).reduce((s, ci) => s + ci.subtotal_mxn, 0) * (area.quantity ?? 1),
    0
  );

  const materialsSubtotal = cabinetsSubtotal + itemsSubtotal + countertopsSubtotal + closetItemsSubtotal;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print the quotation.');
    return;
  }

  const areaBreakdown = areas.map(area => {
    const qty = area.quantity ?? 1;
    const areaCabinetsTotal = resolveAreaCabinetsTotal(area);
    const areaItemsTotal = area.items.reduce((sum, i) => sum + i.subtotal, 0);
    const areaClosetTotal = (area.closetItems || []).reduce((sum, ci) => sum + ci.subtotal_mxn, 0);
    const rawTotal = areaCabinetsTotal + areaItemsTotal + areaClosetTotal;
    const areaTotal = rawTotal * qty;

    const boxesPalletsCalc = calculateAreaBoxesAndPallets(area.cabinets, products, area.closetItems || []);

    return {
      name: qty > 1 ? `${area.name} (×${qty})` : area.name,
      boxes: boxesPalletsCalc.boxes * qty,
      palletsRaw: boxesPalletsCalc.palletsRaw * qty,
      sf: (boxesPalletsCalc.accessoriesSqFt * qty).toFixed(2),
      total: areaTotal
    };
  });

  const cabinetAreaBreakdown = areaBreakdown.filter((_, i) => {
    const area = areas[i];
    const hasClosets = (area.closetItems || []).length > 0;
    return !(area.cabinets.length === 0 && !hasClosets && (area.countertops.length > 0 || area.items.length > 0));
  });

  const totalBoxes = cabinetAreaBreakdown.reduce((sum, a) => sum + a.boxes, 0);
  const totalPallets = Math.ceil(areaBreakdown.reduce((sum, a) => sum + a.palletsRaw, 0));
  const totalSF = cabinetAreaBreakdown.reduce((sum, a) => sum + parseFloat(a.sf), 0);
  const cabinetAreasDisplayTotal = cabinetAreaBreakdown.reduce((sum, a) => sum + a.total, 0);

  interface CountertopGroup {
    itemName: string;
    qty: number;
    unit: string;
    subtotal: number;
  }
  const mxnCountertopGroupMap = new Map<string, CountertopGroup>();
  for (const area of areas) {
    for (const ct of area.countertops) {
      const existing = mxnCountertopGroupMap.get(ct.item_name);
      const plItem = priceList.find(p => p.id === ct.price_list_item_id);
      const unit = plItem?.unit || '';
      if (existing) {
        existing.qty += ct.quantity;
        existing.subtotal += ct.subtotal;
      } else {
        mxnCountertopGroupMap.set(ct.item_name, { itemName: ct.item_name, qty: ct.quantity, unit, subtotal: ct.subtotal });
      }
    }
  }
  const mxnCountertopGroups = Array.from(mxnCountertopGroupMap.values());


  let logoUrl = '';
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('logo_url')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
    }

    if (settings?.logo_url) {
      const { data } = supabase.storage
        .from('logos')
        .getPublicUrl(settings.logo_url);
      logoUrl = data.publicUrl;
    } else {
      console.warn('No logo_url found in settings');
    }
  } catch (error) {
    console.error('Error fetching logo URL:', error);
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quotation - ${resolvedName}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        @page {
          margin: 2cm;
          size: A4;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 10pt;
          line-height: 1.5;
          color: #000;
          background: white;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 2px solid #000;
        }

        .logo-section {
          flex: 0 0 auto;
        }

        .logo-section img {
          height: 60px;
          width: auto;
          display: block;
          max-width: 300px;
        }

        .logo-section img[alt]:after {
          content: attr(alt);
          display: block;
          font-size: 24pt;
          font-weight: 700;
        }

        .company-info {
          text-align: right;
          font-size: 9pt;
          line-height: 1.5;
        }

        .company-info p {
          margin: 2px 0;
        }

        .project-header {
          margin-bottom: 30px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .project-header-left {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .project-label {
          font-size: 9pt;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .project-name {
          font-size: 16pt;
          font-weight: 700;
          margin: 2px 0 8px 0;
          color: #000;
        }

        .section-title {
          text-align: center;
          font-size: 11pt;
          font-weight: 600;
          margin: 25px 0 15px 0;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #000;
        }

        .pricing-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 9pt;
        }

        .pricing-table thead {
          background-color: #f8f9fa;
        }

        .pricing-table th {
          text-align: left;
          padding: 10px 12px;
          font-weight: 600;
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 2px solid #000;
          color: #000;
        }

        .pricing-table th.center {
          text-align: center;
        }

        .pricing-table th.right {
          text-align: right;
        }

        .pricing-table tbody td {
          padding: 10px 12px;
          border-bottom: 1px solid #e0e0e0;
        }

        .pricing-table tbody td.center {
          text-align: center;
        }

        .pricing-table tbody td.right {
          text-align: right;
          font-weight: 600;
        }

        .totals-block {
          page-break-inside: avoid;
          page-break-before: avoid;
        }

        .totals-table {
          width: 100%;
          border-collapse: collapse;
        }

        .totals-table td {
          padding: 12px;
          font-weight: 700;
          font-size: 10pt;
          background-color: #f8f9fa;
        }

        .totals-table td.center {
          text-align: center;
        }

        .totals-table td.right {
          text-align: right;
        }

        .totals-table tr:first-child td {
          border-top: 2px solid #000;
        }

        .totals-table tr:last-child td {
          border-top: 2px solid #333;
        }

        .notes-box {
          background-color: #fff8e1;
          border: 1px solid #ffd54f;
          border-left: 4px solid #ffa000;
          padding: 12px 15px;
          margin: 20px 0;
          font-size: 9pt;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          line-height: 1.5;
        }

        .notes-box-number {
          background-color: #ffa000;
          color: white;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 3px;
          font-size: 9pt;
          flex-shrink: 0;
        }

        .summary-section {
          margin-top: 30px;
          border: 2px solid #000;
          border-radius: 4px;
          overflow: hidden;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 20px;
          font-size: 10pt;
          border-bottom: 1px solid #e0e0e0;
        }

        .summary-row:last-child {
          border-bottom: none;
        }

        .summary-row.subtotal {
          background-color: #f8f9fa;
          font-weight: 600;
        }

        .summary-row.total {
          background-color: #000;
          color: white;
          font-weight: 700;
          font-size: 11pt;
          padding: 14px 20px;
        }

        .summary-label {
          color: inherit;
        }

        .summary-value {
          font-weight: 600;
          text-align: right;
        }

        .project-details {
          margin-top: 20px;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }

        .project-details h3 {
          font-size: 10pt;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .project-details ul {
          list-style: disc;
          padding-left: 18px;
          margin: 0;
        }

        .project-details li {
          margin: 4px 0;
          font-size: 9pt;
          line-height: 1.5;
        }

        .project-details li strong {
          font-weight: 600;
        }

        .countertop-row td {
          background-color: #fff7ed;
          font-style: italic;
          border-bottom: 1px solid #e0e0e0;
          font-weight: 600;
        }

        .ct-section-header td {
          background-color: #ffedd5;
          font-size: 8pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 6px 12px;
          border-top: 1px solid #fed7aa;
          color: #9a3412;
        }

        .closet-row td {
          background-color: #f0fdfa;
          font-style: italic;
          border-bottom: 1px solid #e0e0e0;
          font-weight: 600;
        }

        .closet-section-header td {
          background-color: #ccfbf1;
          font-size: 8pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 6px 12px;
          border-top: 1px solid #99f6e4;
          color: #0f766e;
        }

        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .project-details {
            page-break-inside: avoid;
          }

          .summary-section {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          ${logoUrl ? `<img src="${logoUrl}" alt="Evita Cabinets" crossorigin="anonymous" />` : '<h1 style="font-size: 24pt; font-weight: 700; margin: 0;">Evita Cabinets</h1>'}
        </div>
        <div class="company-info">
          <p><strong>6400 Westpark Dr # 465, Houston, TX 77057</strong></p>
          <p>www.evitacabinets.com</p>
          <p>346-234-9223</p>
          <p>info@evitacabinets.com</p>
        </div>
      </div>

      <div class="project-header">
        <div class="project-header-left">
          <span class="project-label">Project</span>
          <div class="project-name">${resolvedName}${overrides.pricingMethodLabel === 'optimizer' ? ' <span style="display:inline-block; font-size:7pt; font-weight:600; padding:1px 6px; margin-left:6px; vertical-align:middle; border:1px solid #1d4ed8; color:#1d4ed8; border-radius:3px; letter-spacing:0.5px;">OPTIMIZER</span>' : ''}</div>
          <span class="project-label">Address</span>
          <div style="font-size: 10pt; font-weight: 600; margin-top: 2px;">${resolvedAddress || '-'}</div>
        </div>
        <div style="text-align: right;">
          <span class="project-label">Date</span>
          <div style="font-size: 10pt; font-weight: 600; margin-top: 2px;">${new Date(project.quote_date + 'T00:00:00').toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
          })}</div>
        </div>
      </div>

      <div class="section-title">Pricing MXN</div>

      <table class="pricing-table">
        <thead>
          <tr>
            <th>Area/Concept</th>
            <th class="center">Boxes</th>
            <th class="right">Square Feet</th>
            <th class="right">Price</th>
          </tr>
        </thead>
        <tbody>
          ${cabinetAreaBreakdown.map(area => `
            <tr>
              <td>${area.name}</td>
              <td class="center">${area.boxes}</td>
              <td class="right">${area.sf}</td>
              <td class="right">${formatCurrency(area.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals-block">
        <table class="totals-table">
          <tr>
            <td><strong>Totals</strong></td>
            <td class="center"><strong>${totalBoxes}</strong></td>
            <td class="right">${totalSF.toFixed(2)}</td>
            <td class="right">${formatCurrency(cabinetAreasDisplayTotal)}</td>
          </tr>
          ${mxnCountertopGroups.length > 0 ? `
          <tr class="ct-section-header">
            <td colspan="4">Countertops</td>
          </tr>
          ${mxnCountertopGroups.map(g => {
            const qtyDisplay = g.unit ? `${g.qty} ${g.unit}` : `${g.qty}`;
            return `
          <tr class="countertop-row">
            <td>${g.itemName}</td>
            <td class="center"></td>
            <td class="right">${qtyDisplay}</td>
            <td class="right">${formatCurrency(g.subtotal)}</td>
          </tr>`;
          }).join('')}
          ` : ''}
          <tr>
            <td><strong>Grand Total</strong></td>
            <td class="center"></td>
            <td class="right"></td>
            <td class="right"><strong>${formatCurrency(materialsSubtotal)}</strong></td>
          </tr>
        </table>
      </div>

      ${totalPallets > 0 ? `
        <div class="notes-box">
          <div class="notes-box-number">${totalPallets}</div>
          <div>Pallets approx. everything assembled</div>
        </div>
      ` : ''}

      ${renderBriefBlocksAsHTML(resolvedBrief)}

      <script>
        window.onload = function() {
          const logo = document.querySelector('.logo-section img');
          if (logo) {
            if (logo.complete && logo.naturalHeight > 0) {
              setTimeout(() => window.print(), 500);
            } else {
              logo.onload = function() {
                setTimeout(() => window.print(), 500);
              };
              logo.onerror = function(e) {
                console.error('Logo failed to load. URL:', logo.src);
                setTimeout(() => window.print(), 500);
              };
            }
          } else {
            setTimeout(() => window.print(), 500);
          }
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export async function printQuotationUSD(
  project: Quotation,
  areas: (ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[]; closetItems?: AreaClosetItem[] })[],
  exchangeRate: number,
  products: Product[] = [],
  priceList: PriceListItem[] = [],
  disclaimerTariffInfo = '',
  disclaimerPriceValidity = '',
  overrides: PDFOverrides = {}
) {
  const resolvedName = overrides.pdfProjectName ?? project.name;
  const resolvedAddress = overrides.pdfAddress ?? (project.address || '');
  const resolvedBrief = overrides.pdfProjectBrief ?? filterProjectBriefForPDF(project.project_brief || '');
  const formatUSD = (amount: number) => {
    const amountInUSD = amount / exchangeRate;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountInUSD);
  };

  const profitMultiplier = project.profit_multiplier || 0;
  const tariffMultiplier = project.tariff_multiplier || 0;
  const taxPercentage = project.tax_percentage || 0;
  const referralRate = project.referral_currency_rate || 0;

  // Optimizer-mode swap: mirrors the MXN path in `printQuotation`.
  // Areas with an override use the optimizer-derived per-area cabinet
  // subtotal (pre-quantity, MXN); everything else falls back to ft².
  const resolveAreaCabinetsTotal = (area: ProjectArea & { cabinets: AreaCabinet[] }) => {
    const override = overrides.optimizerAreaSubtotals?.[area.id];
    if (typeof override === 'number' && Number.isFinite(override)) return override;
    return area.cabinets.reduce((s, c) => s + (c.subtotal ?? 0), 0);
  };

  // First pass: calculate original prices, tariffs, and taxes (NOT inflated)
  const baseAreaData = areas.map(area => {
    const qty = area.quantity ?? 1;
    const areaCabinetsTotal = resolveAreaCabinetsTotal(area);
    const areaItemsTotal = area.items.reduce((sum, i) => sum + i.subtotal, 0);
    const areaClosetTotal = (area.closetItems || []).reduce((sum, ci) => sum + ci.subtotal_mxn, 0);
    const areaMaterialsSubtotal = (areaCabinetsTotal + areaItemsTotal + areaClosetTotal) * qty;

    const areaPrice = profitMultiplier > 0 && profitMultiplier < 1
      ? areaMaterialsSubtotal / (1 - profitMultiplier)
      : areaMaterialsSubtotal;

    // Calculate tariff and tax based on ORIGINAL price (not inflated), only when flag is enabled
    const areaTariff = area.applies_tariff === true ? areaMaterialsSubtotal * tariffMultiplier : 0;
    const areaTax = (areaPrice + areaTariff) * (taxPercentage / 100);

    return {
      name: qty > 1 ? `${area.name} (×${qty})` : area.name,
      basePrice: areaPrice,
      tariff: areaTariff,
      tax: areaTax
    };
  });

  const totalBasePrice = baseAreaData.reduce((sum, a) => sum + a.basePrice, 0);
  // install_delivery in DB is stored in MXN (= install_delivery_usd * exchangeRate)
  // Use it directly since all other calculations in this function are in MXN
  const installDeliveryMxn = project.install_delivery || 0;
  const totalReferralAmount = (totalBasePrice + installDeliveryMxn) * referralRate;

  // Second pass: distribute referral fee proportionally and recalculate tax including referral
  const areaBreakdown = areas.map((area, i) => {
    const base = baseAreaData[i];
    const weight = totalBasePrice > 0 ? base.basePrice / totalBasePrice : 0;
    const referralPortionForArea = totalReferralAmount * weight;
    const displayPrice = base.basePrice + referralPortionForArea;
    const areaTaxWithReferral = (base.basePrice + base.tariff + referralPortionForArea) * (taxPercentage / 100);
    const areaTotal = displayPrice + base.tariff + areaTaxWithReferral;
    const { boxes: rawBoxes } = calculateAreaBoxesAndPallets(area.cabinets, products, area.closetItems || []);
    const boxes = rawBoxes * (area.quantity ?? 1);

    return {
      name: base.name,
      boxes,
      price: displayPrice,
      tariff: base.tariff,
      tax: areaTaxWithReferral,
      total: areaTotal
    };
  });

  const usdCabinetAreaBreakdown = areaBreakdown.filter((_, i) => {
    const area = areas[i];
    const hasClosets = (area.closetItems || []).length > 0;
    return !(area.cabinets.length === 0 && !hasClosets && (area.countertops.length > 0 || area.items.length > 0));
  });

  const totalBoxesUSD = usdCabinetAreaBreakdown.reduce((sum, a) => sum + a.boxes, 0);
  const totalPrice = usdCabinetAreaBreakdown.reduce((sum, a) => sum + a.price, 0);
  const totalTariff = usdCabinetAreaBreakdown.reduce((sum, a) => sum + a.tariff, 0);
  const totalTax = usdCabinetAreaBreakdown.reduce((sum, a) => sum + a.tax, 0);
  const cabinetGrandTotal = usdCabinetAreaBreakdown.reduce((sum, a) => sum + a.total, 0);

  const grandTotal = areaBreakdown.reduce((sum, a) => sum + a.total, 0);
  const otherExpenses = project.other_expenses || 0;
  const otherExpensesLabel = project.other_expenses_label || 'Other Expenses';

  interface USDCountertopGroup {
    itemName: string;
    qty: number;
    unit: string;
    displayPrice: number;
    tariff: number;
    tax: number;
    total: number;
  }
  const usdCountertopGroupMap = new Map<string, { itemName: string; qty: number; unit: string; subtotalMXN: number }>();
  for (const area of areas) {
    for (const ct of area.countertops) {
      const existing = usdCountertopGroupMap.get(ct.item_name);
      const plItem = priceList.find(p => p.id === ct.price_list_item_id);
      const unit = plItem?.unit || '';
      if (existing) {
        existing.qty += ct.quantity;
        existing.subtotalMXN += ct.subtotal;
      } else {
        usdCountertopGroupMap.set(ct.item_name, { itemName: ct.item_name, qty: ct.quantity, unit, subtotalMXN: ct.subtotal });
      }
    }
  }
  const usdCountertopGroups: USDCountertopGroup[] = Array.from(usdCountertopGroupMap.values()).map(g => {
    const groupPrice = profitMultiplier > 0 && profitMultiplier < 1
      ? g.subtotalMXN / (1 - profitMultiplier)
      : g.subtotalMXN;
    const referralPortion = totalBasePrice > 0 ? (groupPrice / totalBasePrice) * totalReferralAmount : 0;
    const displayPrice = groupPrice + referralPortion;
    const groupTax = displayPrice * (taxPercentage / 100);
    const groupTotal = displayPrice + groupTax;
    return { itemName: g.itemName, qty: g.qty, unit: g.unit, displayPrice, tariff: 0, tax: groupTax, total: groupTotal };
  });

  const totalCountertopGroupsTotal = usdCountertopGroups.reduce((sum, g) => sum + g.total, 0);

  const finalTotal = grandTotal + totalCountertopGroupsTotal + otherExpenses + installDeliveryMxn;

  let logoUrl = '';
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('logo_url')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
    }

    if (settings?.logo_url) {
      const { data } = supabase.storage
        .from('logos')
        .getPublicUrl(settings.logo_url);
      logoUrl = data.publicUrl;
    }
  } catch (error) {
    console.error('Error fetching logo URL:', error);
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>USD Quotation - ${resolvedName}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        @page {
          margin: 2cm;
          size: A4;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 10pt;
          line-height: 1.5;
          color: #000;
          background: white;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 2px solid #000;
        }

        .logo-section img {
          height: 60px;
          width: auto;
          display: block;
          max-width: 300px;
        }

        .company-info {
          text-align: right;
          font-size: 9pt;
          line-height: 1.5;
        }

        .company-info p {
          margin: 2px 0;
        }

        .project-header {
          margin-bottom: 30px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .project-label {
          font-size: 9pt;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .project-name {
          font-size: 16pt;
          font-weight: 700;
          margin: 2px 0 8px 0;
          color: #000;
        }

        .section-title {
          text-align: center;
          font-size: 11pt;
          font-weight: 600;
          margin: 25px 0 15px 0;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #000;
        }

        .pricing-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 9pt;
        }

        .pricing-table thead {
          background-color: #f8f9fa;
        }

        .pricing-table th {
          text-align: left;
          padding: 10px 12px;
          font-weight: 600;
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 2px solid #000;
          color: #000;
        }

        .pricing-table th.right {
          text-align: right;
        }

        .pricing-table tbody td {
          padding: 10px 12px;
          border-bottom: 1px solid #e0e0e0;
        }

        .pricing-table tbody td.right {
          text-align: right;
          font-weight: 600;
        }

        .totals-block {
          page-break-inside: avoid;
          page-break-before: avoid;
        }

        .totals-table {
          width: 100%;
          border-collapse: collapse;
        }

        .totals-table td {
          padding: 12px;
          font-weight: 700;
          font-size: 10pt;
          background-color: #f8f9fa;
        }

        .totals-table td.right {
          text-align: right;
        }

        .totals-table tr:first-child td {
          border-top: 2px solid #000;
        }

        .totals-table tr:last-child td {
          border-top: 2px solid #333;
        }

        .notes-box {
          background-color: #fff8e1;
          border: 1px solid #ffd54f;
          border-left: 4px solid #ffa000;
          padding: 12px 15px;
          margin: 20px 0;
          font-size: 9pt;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          line-height: 1.5;
        }

        .notes-box-number {
          background-color: #ffa000;
          color: white;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 3px;
          font-size: 9pt;
          flex-shrink: 0;
        }

        .project-details {
          margin-top: 20px;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }

        .project-details h3 {
          font-size: 10pt;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .project-details ul {
          list-style: disc;
          padding-left: 18px;
          margin: 0;
        }

        .project-details li {
          margin: 4px 0;
          font-size: 9pt;
          line-height: 1.5;
        }

        .project-details li strong {
          font-weight: 600;
        }

        .countertop-row td {
          background-color: #fff7ed;
          font-style: italic;
          border-bottom: 1px solid #e0e0e0;
          font-weight: 600;
        }

        .ct-section-header td {
          background-color: #ffedd5;
          font-size: 8pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 6px 12px;
          border-top: 1px solid #fed7aa;
          color: #9a3412;
        }

        .closet-row td {
          background-color: #f0fdfa;
          font-style: italic;
          border-bottom: 1px solid #e0e0e0;
          font-weight: 600;
        }

        .closet-section-header td {
          background-color: #ccfbf1;
          font-size: 8pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 6px 12px;
          border-top: 1px solid #99f6e4;
          color: #0f766e;
        }

        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .project-details {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          ${logoUrl ? `<img src="${logoUrl}" alt="Evita Cabinets" crossorigin="anonymous" />` : '<h1 style="font-size: 24pt; font-weight: 700; margin: 0;">Evita Cabinets</h1>'}
        </div>
        <div class="company-info">
          <p><strong>6400 Westpark Dr # 465, Houston, TX 77057</strong></p>
          <p>www.evitacabinets.com</p>
          <p>346-234-9223</p>
          <p>info@evitacabinets.com</p>
        </div>
      </div>

      <div class="project-header">
        <div class="project-header-left">
          <span class="project-label">Project</span>
          <div class="project-name">${resolvedName}${overrides.pricingMethodLabel === 'optimizer' ? ' <span style="display:inline-block; font-size:7pt; font-weight:600; padding:1px 6px; margin-left:6px; vertical-align:middle; border:1px solid #1d4ed8; color:#1d4ed8; border-radius:3px; letter-spacing:0.5px;">OPTIMIZER</span>' : ''}</div>
          <span class="project-label">Address</span>
          <div style="font-size: 10pt; font-weight: 600; margin-top: 2px;">${resolvedAddress || '-'}</div>
        </div>
        <div style="text-align: right;">
          <span class="project-label">Date</span>
          <div style="font-size: 10pt; font-weight: 600; margin-top: 2px;">${new Date(project.quote_date + 'T00:00:00').toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
          })}</div>
        </div>
      </div>

      <div class="section-title">Pricing</div>

      <table class="pricing-table">
        <thead>
          <tr>
            <th>Area/Concept</th>
            <th class="right">Boxes Qty</th>
            <th class="right">Price</th>
            <th class="right">Tax (${taxPercentage}%)</th>
            <th class="right">Total w/Tax</th>
          </tr>
        </thead>
        <tbody>
          ${usdCabinetAreaBreakdown.map(area => `
            <tr>
              <td>${area.name}</td>
              <td class="right">${area.boxes}</td>
              <td class="right">${formatUSD(area.price + area.tariff)}</td>
              <td class="right">${formatUSD(area.tax)}</td>
              <td class="right">${formatUSD(area.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals-block">
        <table class="totals-table">
          <tr>
            <td><strong>Totals</strong></td>
            <td class="right"><strong>${totalBoxesUSD}</strong></td>
            <td class="right">${formatUSD(totalPrice + totalTariff)}</td>
            <td class="right">${formatUSD(totalTax)}</td>
            <td class="right">${formatUSD(cabinetGrandTotal)}</td>
          </tr>
          ${usdCountertopGroups.length > 0 ? `
          <tr class="ct-section-header">
            <td colspan="5">Countertops</td>
          </tr>
          ${usdCountertopGroups.map(g => {
            const qtyDisplay = g.unit ? `${g.qty} ${g.unit}` : `${g.qty}`;
            return `
          <tr class="countertop-row">
            <td>${g.itemName}</td>
            <td class="right">${qtyDisplay}</td>
            <td class="right">${formatUSD(g.displayPrice + g.tariff)}</td>
            <td class="right">${formatUSD(g.tax)}</td>
            <td class="right">${formatUSD(g.total)}</td>
          </tr>`;
          }).join('')}
          ` : ''}
          ${installDeliveryMxn > 0 ? `
          <tr>
            <td><strong>Design services, Install & Delivery</strong></td>
            <td class="right"></td>
            <td class="right"></td>
            <td class="right"></td>
            <td class="right">${formatUSD(installDeliveryMxn)}</td>
          </tr>
          ` : ''}
          ${otherExpenses > 0 ? `
          <tr>
            <td><strong>${otherExpensesLabel}</strong></td>
            <td class="right"></td>
            <td class="right"></td>
            <td class="right"></td>
            <td class="right">${formatUSD(otherExpenses)}</td>
          </tr>
          ` : ''}
          <tr>
            <td><strong>Grand Total</strong></td>
            <td class="right"></td>
            <td class="right"></td>
            <td class="right"></td>
            <td class="right"><strong>${formatUSD(finalTotal)}</strong></td>
          </tr>
        </table>
      </div>

      ${(disclaimerTariffInfo || disclaimerPriceValidity) ? `
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
        ${disclaimerTariffInfo ? `<p style="margin: 0 0 8px 0; font-size: 8pt; color: #333; line-height: 1.5; font-style: italic;">${disclaimerTariffInfo.replace(/\n/g, '<br>')}</p>` : ''}
        ${disclaimerPriceValidity ? `<p style="margin: 0; font-size: 8pt; color: #333; line-height: 1.6;">${disclaimerPriceValidity.split('\n').filter(l => l.trim()).map(l => `<strong>${l}</strong>`).join('<br>')}</p>` : ''}
      </div>
      ` : ''}

      ${renderBriefBlocksAsHTML(resolvedBrief)}

      <script>
        window.onload = function() {
          const logo = document.querySelector('.logo-section img');
          if (logo) {
            if (logo.complete && logo.naturalHeight > 0) {
              setTimeout(() => window.print(), 500);
            } else {
              logo.onload = function() {
                setTimeout(() => window.print(), 500);
              };
              logo.onerror = function() {
                setTimeout(() => window.print(), 500);
              };
            }
          } else {
            setTimeout(() => window.print(), 500);
          }
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print the quotation.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
}
