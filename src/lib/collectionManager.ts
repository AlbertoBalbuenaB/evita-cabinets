import { supabase } from './supabase';
import type { Product } from '../types';

export async function getAllCollections(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('products_catalog')
      .select('collection_name')
      .eq('is_active', true)
      .order('collection_name');

    if (error) throw error;

    const uniqueCollections = [...new Set(data?.map((p) => p.collection_name) || [])];
    return uniqueCollections.filter((name): name is string => !!name);
  } catch (error) {
    console.error('Error fetching collections:', error);
    return [];
  }
}

export async function getProductsByCollection(
  collectionName: string,
  includeArchived = false
): Promise<Product[]> {
  try {
    let query = supabase
      .from('products_catalog')
      .select('*')
      .eq('is_active', true)
      .eq('collection_name', collectionName);

    if (!includeArchived) {
      query = query.eq('status', 'active');
    }

    const { data, error } = await query.order('sku');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching products by collection:', error);
    return [];
  }
}

export async function archiveProduct(productId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('products_catalog')
      .update({ status: 'archived' })
      .eq('id', productId);

    if (error) throw error;
  } catch (error) {
    console.error('Error archiving product:', error);
    throw error;
  }
}

export async function restoreProduct(productId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('products_catalog')
      .update({ status: 'active' })
      .eq('id', productId);

    if (error) throw error;
  } catch (error) {
    console.error('Error restoring product:', error);
    throw error;
  }
}

export async function getCollectionStats(): Promise<
  Array<{ collection: string; productCount: number; activeCount: number }>
> {
  try {
    const { data, error } = await supabase
      .from('products_catalog')
      .select('collection_name, status')
      .eq('is_active', true);

    if (error) throw error;

    const stats = new Map<string, { total: number; active: number }>();

    data?.forEach((product) => {
      const collection = product.collection_name || 'Standard Catalog';
      const current = stats.get(collection) || { total: 0, active: 0 };

      current.total++;
      if (product.status === 'active') {
        current.active++;
      }

      stats.set(collection, current);
    });

    return Array.from(stats.entries()).map(([collection, counts]) => ({
      collection,
      productCount: counts.total,
      activeCount: counts.active,
    }));
  } catch (error) {
    console.error('Error fetching collection stats:', error);
    return [];
  }
}
