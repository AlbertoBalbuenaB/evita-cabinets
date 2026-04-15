/**
 * Draft Tool — Supabase CRUD helpers.
 *
 * Thin typed wrappers around the Supabase client that only the Draft Tool
 * consumes. Everything returns unwrapped rows and throws on error so callers
 * (primarily `useDraftStore`) can use try/catch + setSaveStatus.
 */

import { supabase } from '../../../lib/supabase';
import type {
  DrawingRow,
  DrawingAreaRow,
  DrawingElevationRow,
  DrawingElementRow,
  DrawingInsert,
  DrawingElementInsert,
  ProductsCatalogRow,
  ExportLanguage,
} from '../types';

// ── Drawings (top-level) ────────────────────────────────────────────────────

export async function listDrawingsByProject(projectId: string): Promise<DrawingRow[]> {
  const { data, error } = await supabase
    .from('drawings')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDrawing(drawingId: string): Promise<DrawingRow | null> {
  const { data, error } = await supabase
    .from('drawings')
    .select('*')
    .eq('id', drawingId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface NewDrawingInput {
  project_id: string;
  name: string;
  created_by?: string | null;
  export_language?: ExportLanguage;
}

export async function createDrawing(input: NewDrawingInput): Promise<DrawingRow> {
  const payload: DrawingInsert = {
    project_id: input.project_id,
    name: input.name,
    created_by: input.created_by ?? null,
    export_language: input.export_language ?? 'en',
  };
  const { data, error } = await supabase
    .from('drawings')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateDrawing(
  drawingId: string,
  patch: Partial<DrawingRow>
): Promise<DrawingRow> {
  const { data, error } = await supabase
    .from('drawings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', drawingId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ── Areas / elevations ──────────────────────────────────────────────────────

export async function listAreasByDrawing(drawingId: string): Promise<DrawingAreaRow[]> {
  const { data, error } = await supabase
    .from('drawing_areas')
    .select('*')
    .eq('drawing_id', drawingId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createArea(
  drawingId: string,
  name: string,
  prefix: string
): Promise<DrawingAreaRow> {
  const { data, error } = await supabase
    .from('drawing_areas')
    .insert({ drawing_id: drawingId, name, prefix })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listElevationsByDrawing(
  drawingId: string
): Promise<DrawingElevationRow[]> {
  const { data: areas, error: ae } = await supabase
    .from('drawing_areas')
    .select('id')
    .eq('drawing_id', drawingId);
  if (ae) throw ae;
  const areaIds = (areas ?? []).map((a) => a.id);
  if (areaIds.length === 0) return [];

  const { data, error } = await supabase
    .from('drawing_elevations')
    .select('*')
    .in('area_id', areaIds)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createElevation(
  areaId: string,
  letter: string
): Promise<DrawingElevationRow> {
  const { data, error } = await supabase
    .from('drawing_elevations')
    .insert({ area_id: areaId, letter })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ── Elements ────────────────────────────────────────────────────────────────

export async function listElementsByDrawing(
  drawingId: string
): Promise<DrawingElementRow[]> {
  const { data, error } = await supabase
    .from('drawing_elements')
    .select('*')
    .eq('drawing_id', drawingId)
    .order('z_index', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertElements(
  rows: DrawingElementInsert[]
): Promise<DrawingElementRow[]> {
  if (rows.length === 0) return [];
  const { data, error } = await supabase
    .from('drawing_elements')
    .upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), {
      onConflict: 'id',
    })
    .select('*');
  if (error) throw error;
  return data ?? [];
}

export async function deleteElements(elementIds: string[]): Promise<void> {
  if (elementIds.length === 0) return;
  const { error } = await supabase
    .from('drawing_elements')
    .delete()
    .in('id', elementIds);
  if (error) throw error;
}

// ── Catalog (read-only) ─────────────────────────────────────────────────────

export async function listDraftCatalog(): Promise<ProductsCatalogRow[]> {
  // PostgREST caps results at 1000; this may need pagination once the
  // filtered set exceeds 1k. Today we have ~1512 rows with draft_enabled=true
  // so we paginate explicitly with .range.
  const PAGE = 1000;
  let offset = 0;
  const all: ProductsCatalogRow[] = [];
  // Hard cap the loop — if we ever get runaway paginate, abort after 5 pages.
  for (let i = 0; i < 5; i += 1) {
    const { data, error } = await supabase
      .from('products_catalog')
      .select('*')
      .eq('draft_enabled', true)
      .eq('is_active', true)
      .order('draft_series', { ascending: true })
      .order('sku', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// ── Project (quotation) list for the header project selector ───────────────

export interface QuotationSummary {
  id: string;
  name: string;
  project_id: string;
}

export async function listQuotationsForSelector(): Promise<QuotationSummary[]> {
  const { data, error } = await supabase
    .from('quotations')
    .select('id, name, project_id')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as QuotationSummary[];
}
