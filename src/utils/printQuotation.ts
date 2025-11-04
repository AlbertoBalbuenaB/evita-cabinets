import { formatCurrency } from '../lib/calculations';
import { calculateAreaBoxesAndPallets } from '../lib/boxesAndPallets';
import { supabase } from '../lib/supabase';
import type { Project, ProjectArea, AreaCabinet, AreaItem, AreaCountertop, Product } from '../types';

export async function printQuotation(
  project: Project,
  areas: (ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[] })[],
  products: Product[] = []
) {
  const cabinetsSubtotal = areas.reduce(
    (sum, area) => sum + area.cabinets.reduce((s, c) => s + c.subtotal, 0),
    0
  );

  const itemsSubtotal = areas.reduce(
    (sum, area) => sum + area.items.reduce((s, i) => s + i.subtotal, 0),
    0
  );

  const countertopsSubtotal = areas.reduce(
    (sum, area) => sum + area.countertops.reduce((s, ct) => s + ct.subtotal, 0),
    0
  );

  const materialsSubtotal = cabinetsSubtotal + itemsSubtotal + countertopsSubtotal;
  const otherExpenses = project.other_expenses || 0;
  const taxesPercentage = project.taxes_percentage || 0;
  const taxesAmount = (materialsSubtotal * taxesPercentage) / 100;
  const installDelivery = project.install_delivery || 0;
  const projectTotal = materialsSubtotal + otherExpenses + taxesAmount + installDelivery;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print the quotation.');
    return;
  }

  const areaBreakdown = areas.map(area => {
    const areaCabinetsTotal = area.cabinets.reduce((sum, c) => sum + c.subtotal, 0);
    const areaItemsTotal = area.items.reduce((sum, i) => sum + i.subtotal, 0);
    const areaCountertopsTotal = area.countertops.reduce((sum, ct) => sum + ct.subtotal, 0);
    const areaTotal = areaCabinetsTotal + areaItemsTotal + areaCountertopsTotal;

    const boxesPalletsCalc = calculateAreaBoxesAndPallets(area.cabinets, products);

    return {
      name: area.name,
      boxes: boxesPalletsCalc.boxes,
      pallets: boxesPalletsCalc.pallets,
      sf: boxesPalletsCalc.accessoriesSqFt.toFixed(2),
      total: areaTotal
    };
  });

  const totalBoxes = areaBreakdown.reduce((sum, a) => sum + a.boxes, 0);
  const totalPallets = areaBreakdown.reduce((sum, a) => sum + a.pallets, 0);
  const totalSF = areaBreakdown.reduce((sum, a) => sum + parseFloat(a.sf), 0);

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
      <title>Quotation - ${project.name}</title>
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

        .pricing-table tfoot td {
          padding: 12px;
          font-weight: 700;
          font-size: 10pt;
          border-top: 2px solid #000;
          background-color: #f8f9fa;
        }

        .pricing-table tfoot td.center {
          text-align: center;
        }

        .pricing-table tfoot td.right {
          text-align: right;
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
          margin-top: 35px;
          page-break-inside: avoid;
        }

        .project-details h3 {
          font-size: 11pt;
          font-weight: 700;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .project-details ul {
          list-style: disc;
          padding-left: 20px;
        }

        .project-details li {
          margin: 6px 0;
          font-size: 9pt;
          line-height: 1.6;
        }

        .project-details li strong {
          font-weight: 600;
        }

        .footer {
          position: fixed;
          bottom: 1.5cm;
          left: 2cm;
          right: 2cm;
          text-align: center;
          font-size: 8pt;
          color: #666;
          padding-top: 10px;
          border-top: 1px solid #e0e0e0;
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
          <p>34-6234-9223</p>
          <p>info@evitacabinets.com</p>
        </div>
      </div>

      <div class="project-header">
        <div class="project-header-left">
          <span class="project-label">Project</span>
          <div class="project-name">${project.name}</div>
          <span class="project-label">Address</span>
          <span style="font-size: 9pt;">${project.address || '-'}</span>
        </div>
      </div>

      <div class="section-title">Pricing per Area</div>

      <table class="pricing-table">
        <thead>
          <tr>
            <th>Area</th>
            <th class="center">Boxes</th>
            <th class="center">Pallets</th>
            <th class="center">SF Fillers & Panels</th>
            <th class="right">MXN Price</th>
          </tr>
        </thead>
        <tbody>
          ${areaBreakdown.map(area => `
            <tr>
              <td>${area.name}</td>
              <td class="center">${area.boxes}</td>
              <td class="center">${area.pallets}</td>
              <td class="center">${area.sf}</td>
              <td class="right">${formatCurrency(area.total)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td><strong>TOTAL</strong></td>
            <td class="center">${totalBoxes}</td>
            <td class="center">${totalPallets}</td>
            <td class="center">${totalSF.toFixed(2)}</td>
            <td class="right">${formatCurrency(materialsSubtotal)}</td>
          </tr>
        </tfoot>
      </table>

      ${project.notes ? `
        <div class="notes-box">
          <div class="notes-box-number">2</div>
          <div>${project.notes}</div>
        </div>
      ` : ''}

      <div class="summary-section">
        <div class="summary-row subtotal">
          <span class="summary-label">Materials Subtotal</span>
          <span class="summary-value">${formatCurrency(materialsSubtotal)}</span>
        </div>
        ${otherExpenses > 0 ? `
          <div class="summary-row">
            <span class="summary-label">Other Expenses</span>
            <span class="summary-value">${formatCurrency(otherExpenses)}</span>
          </div>
        ` : ''}
        ${taxesAmount > 0 ? `
          <div class="summary-row">
            <span class="summary-label">Taxes (${taxesPercentage}%)</span>
            <span class="summary-value">${formatCurrency(taxesAmount)}</span>
          </div>
        ` : ''}
        ${installDelivery > 0 ? `
          <div class="summary-row">
            <span class="summary-label">Install & Delivery</span>
            <span class="summary-value">${formatCurrency(installDelivery)}</span>
          </div>
        ` : ''}
        <div class="summary-row total">
          <span class="summary-label">GRAND TOTAL</span>
          <span class="summary-value">${formatCurrency(projectTotal)}</span>
        </div>
      </div>

      ${project.project_details ? `
        <div class="project-details">
          <h3>Project Details</h3>
          <ul>
            ${project.project_details.split('\n').filter(line => line.trim()).map(line => {
              const trimmed = line.trim();
              if (trimmed.match(/^[A-Z][a-z\s&]+:/)) {
                const [label, ...rest] = trimmed.split(':');
                return `<li><strong>${label}:</strong>${rest.join(':')}</li>`;
              }
              return `<li>${trimmed}</li>`;
            }).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="footer">
        ${new Date(project.quote_date).toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        })} | Page 1
      </div>

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
