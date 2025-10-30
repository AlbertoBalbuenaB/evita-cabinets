import { supabase } from '../lib/supabase';
import { parseDimensions } from '../lib/calculations';

interface ProductCSVRow {
  'SKU (CDS)': string;
  'Description': string;
  'Box SF': string;
  'Box Edgeband': string;
  'Box Edgeband Color': string;
  'Doors & Fronts SF': string;
  'Doors & Fronts Edgeband': string;
  'Total Edgeband Color': string;
}

interface PriceListCSVRow {
  'SKU/Code': string;
  'Concept / Description': string;
  'Type': string;
  'Material': string;
  'Dimensions': string;
  'Unit': string;
  'Price': string;
}

function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[$,]/g, '').trim();
  return parseFloat(cleaned) || 0;
}

function parseNumber(numStr: string): number {
  if (!numStr || numStr.trim() === '') return 0;
  return parseFloat(numStr) || 0;
}

function hasDrawers(description: string): boolean {
  return description.toLowerCase().includes('drawer');
}

export async function importProductsFromCSV(csvText: string): Promise<{ success: number; errors: string[] }> {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',');

  let success = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = line.split(',');
      const row: any = {};
      headers.forEach((header, idx) => {
        row[header.trim()] = values[idx]?.trim() || '';
      });

      const sku = row['SKU (CDS)'];
      if (!sku) continue;

      const product = {
        sku: sku,
        description: row['Description'] || '',
        box_sf: parseNumber(row['Box SF']),
        box_edgeband: parseNumber(row['Box Edgeband']),
        box_edgeband_color: parseNumber(row['Box Edgeband Color']),
        doors_fronts_sf: parseNumber(row['Doors & Fronts SF']),
        doors_fronts_edgeband: parseNumber(row['Doors & Fronts Edgeband']),
        total_edgeband: parseNumber(row['Total Edgeband Color']),
        has_drawers: hasDrawers(row['Description']),
        is_active: true,
      };

      const { error } = await supabase
        .from('products_catalog')
        .upsert([product], { onConflict: 'sku' });

      if (error) {
        errors.push(`Row ${i}: ${error.message}`);
      } else {
        success++;
      }
    } catch (error) {
      errors.push(`Row ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { success, errors };
}

export async function importPriceListFromCSV(csvText: string): Promise<{ success: number; errors: string[] }> {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',');

  let success = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);
      const row: any = {};
      headers.forEach((header, idx) => {
        row[header.trim()] = values[idx]?.trim() || '';
      });

      const description = row['Concept / Description'];
      if (!description || description === 'Select the concept') continue;

      const dimensions = row['Dimensions'] || null;
      const sfPerSheet = dimensions ? parseDimensions(dimensions) : null;

      const priceItem = {
        sku_code: row['SKU/Code'] || null,
        concept_description: description,
        type: row['Type'] || 'Other',
        material: row['Material'] || null,
        dimensions: dimensions,
        unit: row['Unit'] || 'Piece',
        price: parsePrice(row['Price']),
        sf_per_sheet: sfPerSheet,
        is_active: true,
      };

      const { error } = await supabase
        .from('price_list')
        .insert([priceItem]);

      if (error) {
        errors.push(`Row ${i} (${description}): ${error.message}`);
      } else {
        success++;
      }
    } catch (error) {
      errors.push(`Row ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { success, errors };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export async function clearAllData(): Promise<void> {
  await supabase.from('area_cabinets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('project_areas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('products_catalog').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('price_list').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
