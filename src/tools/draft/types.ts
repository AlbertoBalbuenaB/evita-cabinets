/**
 * Draft Tool — local types.
 *
 * All geometry is in millimeters. Inches/cm formatting happens only at
 * render time via helpers in `utils/format.ts`.
 *
 * These types are derived from the Supabase `Database` rows but narrow the
 * string fields (element_type, view_type, etc.) to string-literal unions so
 * the canvas code can switch on them exhaustively.
 */

import type { Database } from '../../lib/database.types';

// ── Enum narrowings ─────────────────────────────────────────────────────────
export type ViewType = 'plan' | 'elevation' | 'detail';

export type ElementType =
  | 'wall'
  | 'cabinet'
  | 'custom_piece'
  | 'countertop'
  | 'dimension'
  | 'note'
  | 'keyplan_arrow';

export type ExportLanguage = 'en' | 'es';

export type DrawingFamily =
  | 'base'
  | 'wall'
  | 'tall'
  | 'accessory'
  | 'closet';

// ── Row types ───────────────────────────────────────────────────────────────
export type DrawingRow = Database['public']['Tables']['drawings']['Row'];
export type DrawingAreaRow = Database['public']['Tables']['drawing_areas']['Row'];
export type DrawingElevationRow = Database['public']['Tables']['drawing_elevations']['Row'];
export type DrawingElementRow = Database['public']['Tables']['drawing_elements']['Row'];

export type DrawingInsert = Database['public']['Tables']['drawings']['Insert'];
export type DrawingElementInsert = Database['public']['Tables']['drawing_elements']['Insert'];

export type ProductsCatalogRow = Database['public']['Tables']['products_catalog']['Row'];

// ── Narrowed element (element_type/view_type as string-literal unions) ─────
export interface DraftElement extends Omit<DrawingElementRow, 'element_type' | 'view_type' | 'props'> {
  element_type: ElementType;
  view_type: ViewType;
  props: ElementProps;
}

// ── Element-specific props (union by element_type) ─────────────────────────
export type ElementProps =
  | WallProps
  | CabinetProps
  | CustomPieceProps
  | CountertopProps
  | DimensionProps
  | NoteProps
  | KeyplanArrowProps
  | Record<string, never>;

export interface WallProps {
  type: 'wall';
  thickness_mm: number;
  /** Panel finish override applied to this wall (Phase 2). */
  panel_finish?: string;
}

export interface CabinetProps {
  type: 'cabinet';
  hinge?: 'left' | 'right' | 'double' | 'none';
  notes?: string;
  /** Phase 2 hooks — unused in Phase 1 but reserved so the jsonb shape is stable. */
  finish_override?: string | null;
  hardware_override?: string | null;
  accessories?: string[];
}

export interface CustomPieceProps {
  type: 'custom_piece';
  custom_type: 'filler' | 'end_panel' | 'toe_kick' | 'crown' | 'custom_cabinet';
  label?: string;
  thickness_in?: number;
  material_id?: string;
  exposed_edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  return_left?: boolean;
  return_right?: boolean;
  profile?: 'crown' | 'light_rail' | 'scribe';
}

export interface CountertopProps {
  type: 'countertop';
  material_label: string;
  material_id?: string;
  thickness_in: number;
  edge_profile: 'eased' | 'bullnose' | 'ogee' | 'square' | 'mitered_waterfall';
  overhang_front_in: number;
  overhang_left_in: number;
  overhang_right_in: number;
  waterfall_sides: Array<'left' | 'right' | 'front' | 'back'>;
  backsplash?: {
    present: boolean;
    height_in: number;
    material_label: string;
  };
  seams: Array<{ position_mm: number; angle_deg: number }>;
  outline_mm: Array<{ x: number; y: number }>;
  associated_cabinet_ids: string[];
  label?: string;
}

export interface DimensionProps {
  type: 'dimension';
  value_mm: number;
  orientation: 'horizontal' | 'vertical';
  anchor_element_ids: string[];
  /** Offset from the anchored elements, in mm. */
  offset_mm?: number;
}

export interface NoteProps {
  type: 'note';
  text: string;
}

export interface KeyplanArrowProps {
  type: 'keyplan_arrow';
  letter: string;
  target_page?: number;
  wall_id?: string;
}

// ── Specs (JSONB on drawings.specs) ─────────────────────────────────────────
export interface DrawingSpecFinish {
  label: string;
  role: 'primary' | 'accent' | 'interior' | 'other';
}

export interface DrawingSpecs {
  finishes?: DrawingSpecFinish[];
  box_construction?: string;
  toe_kick?: string;
  hinges?: string;
  slides?: string;
  shelves?: string;
  pulls?: string;
  special_hardware?: string;
}

// ── Save status used by the autosave pill ───────────────────────────────────
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Drag payload used to move library items onto the canvas ────────────────
export interface DragPayload {
  kind: 'catalog_cabinet';
  product_id: string;
  sku: string;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  family: DrawingFamily;
  series: string;
  description: string;
}

/** HTML5 dataTransfer key. */
export const DRAG_MIME = 'application/x-evita-draft+json';
