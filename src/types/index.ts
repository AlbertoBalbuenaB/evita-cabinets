import type { Database } from '../lib/database.types';

export interface Cubrecanto {
  sup: number;  // 0=none, 1=type A, 2=type B, 3=type C
  inf: number;
  izq: number;
  der: number;
}

export interface CutPiece {
  id: string;
  nombre: string;
  ancho: number;    // mm
  alto: number;     // mm
  cantidad: number;
  material: 'cuerpo' | 'frente' | 'back' | 'drawer_box' | 'shelf' | 'custom';
  cubrecanto?: Cubrecanto;
  veta?: 'none' | 'horizontal' | 'vertical';
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

// Optimizer-based pricing (alternative to ft² rollup)
export type PricingMethod = 'sqft' | 'optimizer';
export type QuotationOptimizerRun = Database['public']['Tables']['quotation_optimizer_runs']['Row'];
export type QuotationOptimizerRunInsert = Database['public']['Tables']['quotation_optimizer_runs']['Insert'];
export type QuotationOptimizerRunUpdate = Database['public']['Tables']['quotation_optimizer_runs']['Update'];

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

export interface PrefabBrand {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type PrefabItemType = 'cabinet' | 'accessory' | 'linear' | 'panel';

export interface PrefabCatalogPrice {
  id: string;
  prefab_catalog_id: string;
  finish: string;
  cost_usd: number;
  effective_date: string;
  is_current: boolean;
  created_at?: string;
}

export interface PrefabCatalogItem {
  id: string;
  brand_id: string;
  category: string;
  cabinet_code: string;
  description: string | null;
  item_type: PrefabItemType;
  width_in: number | null;
  height_in: number | null;
  depth_in: number | null;
  dims_auto_parsed: boolean;
  dims_locked: boolean;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  brand?: PrefabBrand;
  current_prices?: PrefabCatalogPrice[];
}

export interface AreaPrefabItem {
  id: string;
  area_id: string;
  prefab_catalog_id: string;
  finish: string;
  quantity: number;
  cost_usd: number;
  fx_rate: number;
  cost_mxn: number;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  catalog_item?: PrefabCatalogItem;
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

export type Department = Database['public']['Tables']['departments']['Row'];

export type SystemRole = 'admin' | 'ceo' | 'coo' | 'team_manager' | 'team_leader' | 'specialist' | 'collaborator' | 'assistant';

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  admin: 'Admin',
  ceo: 'CEO',
  coo: 'COO',
  team_manager: 'Team Manager',
  team_leader: 'Team Leader',
  specialist: 'Specialist',
  collaborator: 'Collaborator',
  assistant: 'Assistant',
};

export const SYSTEM_ROLES = Object.keys(SYSTEM_ROLE_LABELS) as SystemRole[];

export type AppNotification = Database['public']['Tables']['notifications']['Row'];
export type AppNotificationInsert = Database['public']['Tables']['notifications']['Insert'];

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

export type SupplierLog = Database['public']['Tables']['supplier_logs']['Row'];
export type SupplierLogInsert = Database['public']['Tables']['supplier_logs']['Insert'];

// ── Enhanced Task Management ────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskView = 'list' | 'kanban' | 'calendar';

export interface TaskTag {
  id: string;
  project_id: string;
  label: string;
  color: string;
  created_at: string | null;
}

export interface TaskCommentReply {
  id: string;
  comment_id: string;
  author_id: string | null;
  author_name?: string;
  body: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  author_name?: string;
  body: string;
  created_at: string;
  updated_at: string;
  replies?: TaskCommentReply[];
}

export interface TaskDeliverable {
  id: string;
  task_id: string;
  label: string;
  url: string;
  display_order: number;
  created_at: string | null;
}

export interface EnhancedTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  details: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  parent_task_id: string | null;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
  // Joined data (populated client-side)
  assignees: TeamMember[];
  tags: TaskTag[];
  subtasks: EnhancedTask[];
  comments: TaskComment[];
  deliverables: TaskDeliverable[];
}

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; dot: string; border: string }> = {
  pending:     { label: 'Pending',     color: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400',   border: 'border-slate-300' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',    border: 'border-blue-400' },
  in_review:   { label: 'In Review',   color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500',  border: 'border-purple-400' },
  blocked:     { label: 'Blocked',     color: 'bg-red-100 text-red-700',       dot: 'bg-red-500',     border: 'border-red-400' },
  done:        { label: 'Done',        color: 'bg-green-100 text-green-700',   dot: 'bg-green-500',   border: 'border-green-400' },
  cancelled:   { label: 'Cancelled',   color: 'bg-slate-100 text-slate-400',   dot: 'bg-slate-300',   border: 'border-slate-200' },
};

export const TASK_PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; border: string }> = {
  low:    { label: 'Low',    color: 'text-slate-500', bg: 'bg-slate-100',  border: 'border-l-slate-300' },
  medium: { label: 'Medium', color: 'text-blue-600',  bg: 'bg-blue-50',   border: 'border-l-blue-400' },
  high:   { label: 'High',   color: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-l-amber-400' },
  urgent: { label: 'Urgent', color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-l-red-500' },
};

export const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  blocked: 0, in_progress: 1, in_review: 2, pending: 3, done: 4, cancelled: 5,
};

export const TASK_PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
};

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

// ── Supplier & Inventory types ───────────────────────────────────────────────

export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type SupplierInsert = Database['public']['Tables']['suppliers']['Insert'];
export type SupplierUpdate = Database['public']['Tables']['suppliers']['Update'];

export type PriceListSupplier = Database['public']['Tables']['price_list_suppliers']['Row'];
export type PriceListSupplierInsert = Database['public']['Tables']['price_list_suppliers']['Insert'];

export type InventoryMovement = Database['public']['Tables']['inventory_movements']['Row'];
export type InventoryMovementInsert = Database['public']['Tables']['inventory_movements']['Insert'];

export type ProjectPurchaseItem = Database['public']['Tables']['project_purchase_items']['Row'];
export type ProjectPurchaseItemInsert = Database['public']['Tables']['project_purchase_items']['Insert'];
export type ProjectPurchaseItemUpdate = Database['public']['Tables']['project_purchase_items']['Update'];

export interface ProjectPurchaseItemWithDetails extends ProjectPurchaseItem {
  price_list_item?: PriceListItem | null;
  supplier?: Supplier | null;
  assigned_member?: TeamMember | null;
}

export interface InventoryMovementWithDetails extends InventoryMovement {
  price_list_item?: Pick<PriceListItem, 'concept_description' | 'unit'> | null;
  created_by_member?: Pick<TeamMember, 'name'> | null;
}

export interface PriceListItemWithInventory extends PriceListItem {
  suppliers?: (PriceListSupplier & { supplier: Supplier })[];
  recent_movements?: InventoryMovementWithDetails[];
}
