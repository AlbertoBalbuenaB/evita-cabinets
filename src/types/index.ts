import type { Database } from '../lib/database.types';

export interface CutPiece {
  id: string;
  nombre: string;
  ancho: number;    // mm
  alto: number;     // mm
  cantidad: number;
  material: 'cuerpo' | 'frente' | 'custom';
}

export type Product = Database['public']['Tables']['products_catalog']['Row'];
export type ProductInsert = Database['public']['Tables']['products_catalog']['Insert'];
export type ProductUpdate = Database['public']['Tables']['products_catalog']['Update'];

export type PriceListItem = Database['public']['Tables']['price_list']['Row'];
export type PriceListInsert = Database['public']['Tables']['price_list']['Insert'];
export type PriceListUpdate = Database['public']['Tables']['price_list']['Update'];

// New parent entity (projects_hub → projects)
export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

// What was previously "projects" is now "quotations" (pricing versions)
export type Quotation = Database['public']['Tables']['quotations']['Row'];
export type QuotationInsert = Database['public']['Tables']['quotations']['Insert'];
export type QuotationUpdate = Database['public']['Tables']['quotations']['Update'];

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
  description?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  length_inches?: number;
  width_inches?: number;
  square_feet?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClosetCatalogItem {
  id: string;
  cabinet_code: string;
  evita_line: 'Evita Plus' | 'Evita Premium';
  description: string;
  height_in: number;
  width_in: number;
  depth_in: number;
  price_with_backs_usd: number | null;
  price_without_backs_usd: number | null;
  has_backs_option: boolean;
  boxes_count: number;
  dimensions_locked: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AreaSection {
  id: string;
  area_id: string;
  name: string;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface AreaClosetItem {
  id: string;
  area_id: string;
  closet_catalog_id: string;
  quantity: number;
  with_backs: boolean;
  unit_price_usd: number;
  unit_price_mxn: number;
  hardware: HardwareItem[];
  hardware_cost: number;
  subtotal_mxn: number;
  boxes_count: number;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  catalog_item?: ClosetCatalogItem;
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

export type TeamMember = Database['public']['Tables']['team_members']['Row'];
export type TeamMemberInsert = Database['public']['Tables']['team_members']['Insert'];

export type ProjectDocument = Database['public']['Tables']['project_documents']['Row'];
export type ProjectDocumentInsert = Database['public']['Tables']['project_documents']['Insert'];

export type ProjectTask = Database['public']['Tables']['project_tasks']['Row'];
export type ProjectTaskInsert = Database['public']['Tables']['project_tasks']['Insert'];

export interface ProjectTaskWithAssignee extends ProjectTask {
  assignee_name?: string;
}

export type ProjectActivity = Database['public']['Tables']['project_activities']['Row'];
export type ProjectActivityInsert = Database['public']['Tables']['project_activities']['Insert'];

export type ProjectLog = Database['public']['Tables']['project_logs']['Row'];
export type ProjectLogInsert = Database['public']['Tables']['project_logs']['Insert'];
export type ProjectLogReply = Database['public']['Tables']['project_log_replies']['Row'];

export interface HardwareItem {
  hardware_id: string;
  quantity_per_cabinet: number;
}

export interface AccessoryItem {
  accessory_id: string;
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
  accessoriesCost: number;
  laborCost: number;
  backPanelMaterialCost: number;
  doorProfileCost: number;
  subtotal: number;
}

export type ProjectType = 'Custom' | 'Bids' | 'Prefab' | 'Stores';

export type QuotationStatus = 'Pending' | 'Estimating' | 'Sent' | 'Lost' | 'Awarded' | 'Discarded' | 'Cancelled';
/** @deprecated Use QuotationStatus */
export type ProjectStatus = QuotationStatus;

export interface ProjectWithQuotations extends Project {
  quotations?: Quotation[];
  latestQuotation?: Quotation;
  quotationCount?: number;
}

export interface QuotationWithDetails extends Quotation {
  project?: Project;
  areas?: (ProjectArea & {
    cabinets?: AreaCabinet[];
  })[];
}

/** @deprecated Use QuotationWithDetails */
export type ProjectWithDetails = QuotationWithDetails;

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
  accessories: AccessoryItem[];
  is_rta: boolean;
  use_back_panel_material: boolean;
  back_panel_material_id: string | null;
  back_panel_material_name: string | null;
  back_panel_width_inches: number | null;
  back_panel_height_inches: number | null;
  original_box_material_price: number | null;
  original_box_edgeband_price: number | null;
  original_box_interior_finish_price: number | null;
  original_doors_material_price: number | null;
  original_doors_edgeband_price: number | null;
  original_doors_interior_finish_price: number | null;
  original_back_panel_material_price: number | null;
  door_profile_id: string | null;
  door_profile_name: string | null;
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
  accessories: AccessoryItem[];
  is_rta: boolean;
  use_back_panel_material: boolean;
  back_panel_material_id?: string | null;
  back_panel_material_name?: string | null;
  back_panel_width_inches?: number | null;
  back_panel_height_inches?: number | null;
  original_box_material_price?: number | null;
  original_box_edgeband_price?: number | null;
  original_box_interior_finish_price?: number | null;
  original_doors_material_price?: number | null;
  original_doors_edgeband_price?: number | null;
  original_doors_interior_finish_price?: number | null;
  original_back_panel_material_price?: number | null;
  door_profile_id?: string | null;
  door_profile_name?: string | null;
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
