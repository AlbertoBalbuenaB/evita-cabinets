import { supabase } from './supabase';

export interface ProductUsage {
  usageCount: number;
  projectNames: string[];
}

export async function checkProductUsage(sku: string): Promise<ProductUsage> {
  try {
    const { data, error } = await supabase.rpc('check_product_usage', {
      product_sku_param: sku,
    });

    if (error) {
      console.error('Error checking product usage:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return { usageCount: 0, projectNames: [] };
    }

    const result = data[0];
    return {
      usageCount: Number(result.usage_count || 0),
      projectNames: result.project_names || [],
    };
  } catch (error) {
    console.error('Failed to check product usage:', error);
    return { usageCount: 0, projectNames: [] };
  }
}
