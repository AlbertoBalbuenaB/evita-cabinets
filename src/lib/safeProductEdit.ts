import { supabase } from './supabase';
import type { Product, ProductInsert } from '../types';
import { archiveProduct } from './collectionManager';

export interface CreateVersionOptions {
  newSku: string;
  archiveOriginal?: boolean;
}

export async function createProductVersion(
  originalProduct: Product,
  updates: Partial<ProductInsert>,
  options: CreateVersionOptions
): Promise<Product> {
  try {
    const newProduct: ProductInsert = {
      sku: options.newSku,
      description: updates.description ?? originalProduct.description,
      box_sf: updates.box_sf ?? originalProduct.box_sf,
      box_edgeband: updates.box_edgeband ?? originalProduct.box_edgeband,
      box_edgeband_color: updates.box_edgeband_color ?? originalProduct.box_edgeband_color,
      doors_fronts_sf: updates.doors_fronts_sf ?? originalProduct.doors_fronts_sf,
      doors_fronts_edgeband: updates.doors_fronts_edgeband ?? originalProduct.doors_fronts_edgeband,
      total_edgeband: updates.total_edgeband ?? originalProduct.total_edgeband,
      has_drawers: updates.has_drawers ?? originalProduct.has_drawers,
      collection_name: updates.collection_name ?? originalProduct.collection_name,
      status: 'active',
      is_active: true,
      original_box_sf: updates.original_box_sf ?? originalProduct.original_box_sf,
      original_doors_fronts_sf: updates.original_doors_fronts_sf ?? originalProduct.original_doors_fronts_sf,
      waste_applied: updates.waste_applied ?? originalProduct.waste_applied,
    };

    const { data, error } = await supabase
      .from('products_catalog')
      .insert([newProduct])
      .select()
      .single();

    if (error) throw error;

    if (options.archiveOriginal) {
      await archiveProduct(originalProduct.id);
    }

    return data;
  } catch (error) {
    console.error('Error creating product version:', error);
    throw error;
  }
}

export function generateVersionedSku(originalSku: string, existingSkus: string[]): string {
  let version = 2;
  let newSku = `${originalSku}-V${version}`;

  while (existingSkus.includes(newSku)) {
    version++;
    newSku = `${originalSku}-V${version}`;
  }

  return newSku;
}

export async function getExistingSkus(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('products_catalog')
      .select('sku')
      .eq('is_active', true);

    if (error) throw error;
    return data?.map((p) => p.sku) || [];
  } catch (error) {
    console.error('Error fetching existing SKUs:', error);
    return [];
  }
}
