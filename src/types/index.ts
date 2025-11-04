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

export type ProjectStatus = 'Pending' | 'Estimating' | 'Lost' | 'Awarded' | 'Disqualified' | 'Cancelled';

export interface ProjectWithDetails extends Project {
  areas?: (ProjectArea & {
    cabinets?: AreaCabinet[];
  })[];
}
