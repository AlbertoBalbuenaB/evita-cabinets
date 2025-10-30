export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: string;
  version_name: string;
  is_current: boolean;
  notes: string | null;
  total_amount: number;
  created_at: string;
  created_by: string | null;
  based_on_version_id: string | null;
}

export interface VersionProjectArea {
  id: string;
  version_id: string;
  name: string;
  display_order: number;
  subtotal: number;
  created_at: string;
}

export interface VersionAreaCabinet {
  id: string;
  area_id: string;
  product_id: string;
  quantity: number;

  box_material_id: string | null;
  box_material_name: string | null;
  box_material_cost: number;
  box_edgeband_id: string | null;
  box_edgeband_name: string | null;
  box_edgeband_cost: number;
  box_interior_finish_id: string | null;
  box_interior_finish_name: string | null;
  box_interior_finish_cost: number;

  doors_material_id: string | null;
  doors_material_name: string | null;
  doors_material_cost: number;
  doors_edgeband_id: string | null;
  doors_edgeband_name: string | null;
  doors_edgeband_cost: number;
  doors_interior_finish_id: string | null;
  doors_interior_finish_name: string | null;
  doors_interior_finish_cost: number;

  hardware: any;
  hardware_cost: number;
  labor_cost: number;
  subtotal: number;

  product_sku: string | null;
  product_description: string | null;
  box_sf: number | null;
  doors_fronts_sf: number | null;
  total_edgeband: number | null;
  has_drawers: boolean;
  is_rta: boolean;

  created_at: string;
  updated_at: string;
}

export interface VersionAreaItem {
  id: string;
  area_id: string;
  price_list_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
