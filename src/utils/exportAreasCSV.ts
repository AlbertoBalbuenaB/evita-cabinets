import type { ProjectArea, AreaCabinet, AreaItem, AreaCountertop } from '../types';
import { formatCurrency } from '../lib/calculations';

export interface AreaExportData {
  areaName: string;
  cabinetCount: number;
  itemCount: number;
  countertopCount: number;
  cabinetsTotal: number;
  itemsTotal: number;
  countertopsTotal: number;
  areaTotal: number;
}

export function prepareAreasForExport(
  areas: (ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[] })[]
): AreaExportData[] {
  return areas.map(area => {
    const cabinetsTotal = area.cabinets.reduce((sum, c) => sum + c.subtotal, 0);
    const itemsTotal = area.items.reduce((sum, i) => sum + i.subtotal, 0);
    const countertopsTotal = area.countertops.reduce((sum, ct) => sum + ct.subtotal, 0);
    const areaTotal = cabinetsTotal + itemsTotal + countertopsTotal;

    return {
      areaName: area.name,
      cabinetCount: area.cabinets.filter(c => !c.is_accessory).length,
      itemCount: area.items.length,
      countertopCount: area.countertops.length,
      cabinetsTotal,
      itemsTotal,
      countertopsTotal,
      areaTotal,
    };
  });
}

export function generateAreasCSV(
  areas: (ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[] })[],
  projectName: string
): string {
  const exportData = prepareAreasForExport(areas);

  const headers = [
    'Area Name',
    'Cabinets',
    'Items',
    'Countertops',
    'Cabinets Total',
    'Items Total',
    'Countertops Total',
    'Area Total',
  ];

  const rows = exportData.map(area => [
    escapeCSVField(area.areaName),
    area.cabinetCount.toString(),
    area.itemCount.toString(),
    area.countertopCount.toString(),
    area.cabinetsTotal.toFixed(2),
    area.itemsTotal.toFixed(2),
    area.countertopsTotal.toFixed(2),
    area.areaTotal.toFixed(2),
  ]);

  const totalsRow = [
    'TOTAL',
    exportData.reduce((sum, a) => sum + a.cabinetCount, 0).toString(),
    exportData.reduce((sum, a) => sum + a.itemCount, 0).toString(),
    exportData.reduce((sum, a) => sum + a.countertopCount, 0).toString(),
    exportData.reduce((sum, a) => sum + a.cabinetsTotal, 0).toFixed(2),
    exportData.reduce((sum, a) => sum + a.itemsTotal, 0).toFixed(2),
    exportData.reduce((sum, a) => sum + a.countertopsTotal, 0).toFixed(2),
    exportData.reduce((sum, a) => sum + a.areaTotal, 0).toFixed(2),
  ];

  const csvLines = [
    `Project: ${escapeCSVField(projectName)}`,
    '',
    headers.join(','),
    ...rows.map(row => row.join(',')),
    '',
    totalsRow.join(','),
  ];

  return csvLines.join('\n');
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function downloadAreasCSV(
  areas: (ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[] })[],
  projectName: string
): void {
  const csv = generateAreasCSV(areas, projectName);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);

  const sanitizedProjectName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `${sanitizedProjectName}_areas_${timestamp}.csv`);

  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function generateDetailedAreasCSV(
  areas: (ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[] })[],
  projectName: string
): string {
  const csvLines: string[] = [];

  csvLines.push(`Project: ${escapeCSVField(projectName)}`);
  csvLines.push('Detailed Areas Report');
  csvLines.push('');

  areas.forEach((area, index) => {
    if (index > 0) {
      csvLines.push('');
    }

    csvLines.push(`Area: ${escapeCSVField(area.name)}`);
    csvLines.push('');

    if (area.cabinets.length > 0) {
      csvLines.push('Cabinets:');
      csvLines.push('SKU,Description,Quantity,Unit Price,Subtotal');

      area.cabinets.forEach(cabinet => {
        csvLines.push([
          escapeCSVField(cabinet.product_sku || ''),
          escapeCSVField(cabinet.description || ''),
          cabinet.quantity.toString(),
          (cabinet.subtotal / cabinet.quantity).toFixed(2),
          cabinet.subtotal.toFixed(2),
        ].join(','));
      });

      const cabinetsTotal = area.cabinets.reduce((sum, c) => sum + c.subtotal, 0);
      csvLines.push(`,,,Cabinets Total:,${cabinetsTotal.toFixed(2)}`);
      csvLines.push('');
    }

    if (area.countertops.length > 0) {
      csvLines.push('Countertops:');
      csvLines.push('Description,Length (in),Width (in),Square Feet,Unit Price,Subtotal');

      area.countertops.forEach(ct => {
        csvLines.push([
          escapeCSVField(ct.description || ''),
          ct.length_inches?.toString() || '0',
          ct.width_inches?.toString() || '0',
          ct.square_feet?.toFixed(2) || '0',
          ct.unit_price?.toFixed(2) || '0',
          ct.subtotal.toFixed(2),
        ].join(','));
      });

      const countertopsTotal = area.countertops.reduce((sum, ct) => sum + ct.subtotal, 0);
      csvLines.push(`,,,,Countertops Total:,${countertopsTotal.toFixed(2)}`);
      csvLines.push('');
    }

    if (area.items.length > 0) {
      csvLines.push('Additional Items:');
      csvLines.push('Description,Quantity,Unit Price,Subtotal,Notes');

      area.items.forEach(item => {
        csvLines.push([
          escapeCSVField(item.description || ''),
          item.quantity.toString(),
          item.unit_price.toFixed(2),
          item.subtotal.toFixed(2),
          escapeCSVField(item.notes || ''),
        ].join(','));
      });

      const itemsTotal = area.items.reduce((sum, i) => sum + i.subtotal, 0);
      csvLines.push(`,,Items Total:,${itemsTotal.toFixed(2)}`);
      csvLines.push('');
    }

    const areaTotal =
      area.cabinets.reduce((sum, c) => sum + c.subtotal, 0) +
      area.countertops.reduce((sum, ct) => sum + ct.subtotal, 0) +
      area.items.reduce((sum, i) => sum + i.subtotal, 0);

    csvLines.push(`Area Total:,${areaTotal.toFixed(2)}`);
    csvLines.push('---');
  });

  csvLines.push('');
  const grandTotal = areas.reduce((sum, area) => {
    return sum +
      area.cabinets.reduce((s, c) => s + c.subtotal, 0) +
      area.countertops.reduce((s, ct) => s + ct.subtotal, 0) +
      area.items.reduce((s, i) => s + i.subtotal, 0);
  }, 0);

  csvLines.push(`Project Total:,${grandTotal.toFixed(2)}`);

  return csvLines.join('\n');
}

export function downloadDetailedAreasCSV(
  areas: (ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[] })[],
  projectName: string
): void {
  const csv = generateDetailedAreasCSV(areas, projectName);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);

  const sanitizedProjectName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `${sanitizedProjectName}_areas_detailed_${timestamp}.csv`);

  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
