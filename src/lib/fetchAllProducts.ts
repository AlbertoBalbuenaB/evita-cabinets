import { supabase } from './supabase';
import type { Product } from '../types';

export async function fetchAllProducts(options?: {
  onlyActive?: boolean;
}): Promise<Product[]> {
  const onlyActive = options?.onlyActive ?? true;
  const PAGE_SIZE = 1000;
  let allProducts: Product[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('products_catalog')
      .select('*')
      .eq('is_active', true);

    if (onlyActive) {
      query = query.eq('status', 'active');
    }

    const { data, error } = await query
      .order('sku')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allProducts = [...allProducts, ...data];
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allProducts;
}
