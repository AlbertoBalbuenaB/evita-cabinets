import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import type { ProjectExport } from './projectExportImport';

export interface BackupSummary {
  projectCount: number;
  productCount: number;
  priceListCount: number;
  fileName: string;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function escapeCSVValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSVRow(values: (string | number | boolean | null | undefined)[]): string {
  return values.map(escapeCSVValue).join(',');
}

async function fetchAllProjectsAsExports(): Promise<{ exports: ProjectExport[]; errors: string[] }> {
  const exports: ProjectExport[] = [];
  const errors: string[] = [];

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true });

  if (projectsError) throw new Error(`Failed to fetch projects: ${projectsError.message}`);
  if (!projects || projects.length === 0) return { exports, errors };

  for (const project of projects) {
    try {
      const { data: projectAreas, error: areasError } = await supabase
        .from('project_areas')
        .select('*')
        .eq('project_id', project.id)
        .order('display_order', { ascending: true });

      if (areasError) throw new Error(`Error loading areas: ${areasError.message}`);

      const areas = await Promise.all(
        (projectAreas || []).map(async (area) => {
          const [cabinetsResult, itemsResult, countertopsResult] = await Promise.all([
            supabase.from('area_cabinets').select('*').eq('area_id', area.id),
            supabase.from('area_items').select('*').eq('area_id', area.id),
            supabase.from('area_countertops').select('*').eq('area_id', area.id),
          ]);

          if (cabinetsResult.error) throw new Error(`Error loading cabinets: ${cabinetsResult.error.message}`);
          if (itemsResult.error) throw new Error(`Error loading items: ${itemsResult.error.message}`);
          if (countertopsResult.error) throw new Error(`Error loading countertops: ${countertopsResult.error.message}`);

          return {
            area,
            cabinets: cabinetsResult.data || [],
            items: itemsResult.data || [],
            countertops: countertopsResult.data || [],
          };
        })
      );

      const exportData: ProjectExport = {
        exportVersion: '1.0',
        exportDate: new Date().toISOString(),
        project,
        areas,
        metadata: {
          totalAreas: areas.length,
          totalCabinets: areas.reduce((sum, a) => sum + a.cabinets.length, 0),
          totalItems: areas.reduce((sum, a) => sum + a.items.length, 0),
          totalCountertops: areas.reduce((sum, a) => sum + a.countertops.length, 0),
          originalProjectId: project.id,
        },
      };

      exports.push(exportData);
    } catch (err) {
      errors.push(`Project "${project.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return { exports, errors };
}

async function fetchProductsCatalogAsCSV(): Promise<{ csv: string; count: number }> {
  const { data: products, error } = await supabase
    .from('products_catalog')
    .select('*')
    .limit(2000)
    .order('sku', { ascending: true });

  if (error) throw new Error(`Failed to fetch products: ${error.message}`);

  const headers = [
    'SKU (CDS)',
    'Description',
    'Box SF',
    'Box Edgeband',
    'Box Edgeband Color',
    'Doors & Fronts SF',
    'Doors & Fronts Edgeband',
    'Total Edgeband Color',
  ];

  const rows = (products || []).map((p) =>
    buildCSVRow([
      p.sku,
      p.description,
      p.box_sf,
      p.box_edgeband,
      p.box_edgeband_color,
      p.doors_fronts_sf,
      p.doors_fronts_edgeband,
      p.total_edgeband,
    ])
  );

  const csv = [headers.join(','), ...rows].join('\n');
  return { csv, count: products?.length || 0 };
}

async function fetchPriceListAsCSV(): Promise<{ csv: string; count: number }> {
  const { data: items, error } = await supabase
    .from('price_list')
    .select('*')
    .order('type', { ascending: true });

  if (error) throw new Error(`Failed to fetch price list: ${error.message}`);

  const headers = [
    'ID',
    'SKU/Code',
    'Concept / Description',
    'Type',
    'Material',
    'Dimensions',
    'Unit',
    'Price',
    'Tax Rate',
    'Notes',
    'Product URL',
    'Is Active',
  ];

  const rows = (items || []).map((item) =>
    buildCSVRow([
      item.id,
      item.sku_code,
      item.concept_description,
      item.type,
      item.material,
      item.dimensions,
      item.unit,
      item.price,
      item.tax_rate,
      item.notes,
      item.product_url,
      item.is_active ? 'true' : 'false',
    ])
  );

  const csv = [headers.join(','), ...rows].join('\n');
  return { csv, count: items?.length || 0 };
}

export async function downloadFullBackup(
  onProgress?: (step: string) => void
): Promise<BackupSummary> {
  const zip = new JSZip();

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const folderName = `evita-backup-${dateStr}`;

  onProgress?.('Exporting projects...');
  const { exports, errors } = await fetchAllProjectsAsExports();

  if (errors.length > 0) {
    console.warn('Some projects could not be exported:', errors);
  }

  const projectsFolder = zip.folder(`${folderName}/projects`);
  for (const exportData of exports) {
    const safeFileName = sanitizeFileName(exportData.project.name);
    const fileName = `${safeFileName}.evita.json`;
    projectsFolder?.file(fileName, JSON.stringify(exportData, null, 2));
  }

  onProgress?.('Exporting products catalog...');
  const { csv: productsCsv, count: productCount } = await fetchProductsCatalogAsCSV();
  zip.file(`${folderName}/products_catalog.csv`, productsCsv);

  onProgress?.('Exporting price list...');
  const { csv: priceListCsv, count: priceListCount } = await fetchPriceListAsCSV();
  zip.file(`${folderName}/price_list.csv`, priceListCsv);

  onProgress?.('Compressing files...');
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  const fileName = `${folderName}.zip`;
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    projectCount: exports.length,
    productCount,
    priceListCount,
    fileName,
  };
}
