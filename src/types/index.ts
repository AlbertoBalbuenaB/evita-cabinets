import type { Database } from '../lib/database.types';

export type Product = Database['public']['Tables']['products_catalog']['Row'];
export type ProductInsert = Database['public']['Tables']['products_catalog']['Insert'];
export type ProductUpdate = Database['public']['Tables']['products_catalog']['Update'];

export type PriceListItem = Database['public']['Tables']['price_list']['Row'];
export type PriceListInsert = Database['public']['Tables']['price_list']['Insert'];
export type PriceListUpdate = Database['public']['Tables']['price_list']['Update'];

export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export type ProjectArea = Database['public']['Tables']['project_areas']['Row'];
export type ProjectAreaInsert = Database['public']['Tables']['project_areas']['Insert'];
export type ProjectAreaUpdate = Database['public']['Tables']['project_areas']['Update'];

export type AreaCabinet = Database['public']['Tables']['area_cabinets']['Row'];
export type AreaCabinetInsert = Database['public']['Tables']['area_cabinets']['Insert'];
export type AreaCabinetUpdate = Database['public']['Tables']['area_cabinets']['Update'];

export interface AreaItem {
  id: string;
  area_id: string;
  price_list_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AreaCountertop {
  id: string;
  area_id: string;
  price_list_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export type Setting = Database['public']['Tables']['settings']['Row'];
export type SettingInsert = Database['public']['Tables']['settings']['Insert'];
export type SettingUpdate = Database['public']['Tables']['settings']['Update'];

export interface TaxByType {
  id: string;
  material_type: string;
  tax_percentage: number;
  created_at?: string;
  updated_at?: string;
}

export interface CustomType {
  id: string;
  type_name: string;
  created_at?: string;
}

export interface CustomUnit {
  id: string;
  unit_name: string;
  created_at?: string;
}

export interface HardwareItem {
  hardware_id: string;
  quantity_per_cabinet: number;
}

export interface CabinetCostBreakdown {
  boxMaterialCost: number;
  boxEdgebandCost: number;
  boxInteriorFinishCost: number;
  doorsMaterialCost: number;
  doorsEdgebandCost: number;
  doorsInteriorFinishCost: number;
  hardwareCost: number;
  laborCost: number;
  subtotal: number;
}

export type ProjectType = 'Custom' | 'Bids' | 'Prefab' | 'Stores';

export type ProjectStatus = 'Pending' | 'Estimating' | 'Sent' | 'Lost' | 'Awarded' | 'Disqualified' | 'Cancelled';

export interface ProjectWithDetails extends Project {
  areas?: (ProjectArea & {
    cabinets?: AreaCabinet[];
  })[];
}

export interface CabinetTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  product_sku: string | null;
  product_description: string | null;
  box_material_id: string | null;
  box_material_name: string | null;
  box_edgeband_id: string | null;
  box_edgeband_name: string | null;
  box_interior_finish_id: string | null;
  box_interior_finish_name: string | null;
  use_box_interior_finish: boolean;
  doors_material_id: string | null;
  doors_material_name: string | null;
  doors_edgeband_id: string | null;
  doors_edgeband_name: string | null;
  doors_interior_finish_id: string | null;
  doors_interior_finish_name: string | null;
  use_doors_interior_finish: boolean;
  hardware: HardwareItem[];
  is_rta: boolean;
  original_box_material_price: number | null;
  original_box_edgeband_price: number | null;
  original_box_interior_finish_price: number | null;
  original_doors_material_price: number | null;
  original_doors_edgeband_price: number | null;
  original_doors_interior_finish_price: number | null;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CabinetTemplateInsert {
  name: string;
  description?: string | null;
  category: string;
  product_sku: string | null;
  product_description: string | null;
  box_material_id: string | null;
  box_material_name: string | null;
  box_edgeband_id: string | null;
  box_edgeband_name: string | null;
  box_interior_finish_id: string | null;
  box_interior_finish_name: string | null;
  use_box_interior_finish: boolean;
  doors_material_id: string | null;
  doors_material_name: string | null;
  doors_edgeband_id: string | null;
  doors_edgeband_name: string | null;
  doors_interior_finish_id: string | null;
  doors_interior_finish_name: string | null;
  use_doors_interior_finish: boolean;
  hardware: HardwareItem[];
  is_rta: boolean;
  original_box_material_price?: number | null;
  original_box_edgeband_price?: number | null;
  original_box_interior_finish_price?: number | null;
  original_doors_material_price?: number | null;
  original_doors_edgeband_price?: number | null;
  original_doors_interior_finish_price?: number | null;
}

export interface TemplateUsageLog {
  id: string;
  template_id: string;
  project_id: string;
  area_id: string;
  cabinet_id: string | null;
  used_at: string;
  quantity_used: number;
}

export interface TemplateUsageLogInsert {
  template_id: string;
  project_id: string;
  area_id: string;
  cabinet_id?: string | null;
  quantity_used?: number;
}

export type TemplateCategory = 'Base Cabinets' | 'Wall Cabinets' | 'Tall Cabinets' | 'Specialty' | 'Accessories' | 'General';

export interface TemplateAnalytics {
  totalTemplates: number;
  totalUses: number;
  averageUsesPerTemplate: number;
  mostUsedTemplates: Array<{
    id: string;
    name: string;
    category: string;
    usage_count: number;
    last_used_at: string | null;
  }>;
  usageByCategory: Array<{
    category: string;
    total_templates: number;
    total_uses: number;
  }>;
  usageTimeline: Array<{
    usage_date: string;
    usage_count: number;
  }>;
}
