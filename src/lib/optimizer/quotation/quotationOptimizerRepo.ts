/**
 * Thin Supabase data layer for `quotation_optimizer_runs`.
 *
 * Encapsulates all CRUD operations on the runs table so the store, UI, and
 * any dev scripts share the same query shapes and error handling. This file
 * has no knowledge of the optimizer engine — it just moves rows.
 */

import { supabase } from '../../supabase';
import type {
  QuotationOptimizerRun,
  QuotationOptimizerRunInsert,
} from '../../../types';
import type { OptimizerRunSnapshot, OptimizerRunKpis } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Light list (omits snapshot + result blobs) for sidebars / versions list.
 * Use `loadRun(id)` to fetch the heavy fields.
 */
export async function listRuns(quotationId: string): Promise<QuotationOptimizerRun[]> {
  const { data, error } = await supabase
    .from('quotation_optimizer_runs')
    .select('*')
    .eq('quotation_id', quotationId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listRuns failed: ${error.message}`);
  return (data ?? []) as QuotationOptimizerRun[];
}

export async function loadRun(runId: string): Promise<QuotationOptimizerRun> {
  const { data, error } = await supabase
    .from('quotation_optimizer_runs')
    .select('*')
    .eq('id', runId)
    .single();
  if (error) throw new Error(`loadRun failed: ${error.message}`);
  return data as QuotationOptimizerRun;
}

/**
 * Fetch the currently-active run for a quotation, or null if none.
 * There is a unique partial index enforcing at most one active row.
 */
export async function loadActiveRun(
  quotationId: string,
): Promise<QuotationOptimizerRun | null> {
  const { data, error } = await supabase
    .from('quotation_optimizer_runs')
    .select('*')
    .eq('quotation_id', quotationId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(`loadActiveRun failed: ${error.message}`);
  return (data as QuotationOptimizerRun | null) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateRunInput {
  quotationId: string;
  name: string;
  snapshot: OptimizerRunSnapshot;
  result: unknown; // serialized OptimizationResult
  kpis: OptimizerRunKpis;
  notes?: string;
  setActive?: boolean; // if true, deactivate any existing active run
}

export async function createRun(input: CreateRunInput): Promise<string> {
  if (input.setActive) {
    // Clear any existing active run first (unique partial index enforces this).
    const { error: clrErr } = await supabase
      .from('quotation_optimizer_runs')
      .update({ is_active: false })
      .eq('quotation_id', input.quotationId)
      .eq('is_active', true);
    if (clrErr) throw new Error(`createRun (deactivate prev) failed: ${clrErr.message}`);
  }

  const payload: QuotationOptimizerRunInsert = {
    quotation_id:   input.quotationId,
    name:           input.name,
    is_active:      input.setActive === true,
    is_stale:       false,
    snapshot:       input.snapshot as unknown as QuotationOptimizerRunInsert['snapshot'],
    result:         input.result as QuotationOptimizerRunInsert['result'],
    total_cost:     input.kpis.totalCost,
    material_cost:  input.kpis.materialCost,
    edgeband_cost:  input.kpis.edgebandCost,
    waste_pct:      input.kpis.wastePct,
    board_count:    input.kpis.boardCount,
    total_piece_m2: input.kpis.totalPieceM2,
    cost_per_m2:    input.kpis.costPerM2,
    notes:          input.notes ?? null,
  };

  const { data, error } = await supabase
    .from('quotation_optimizer_runs')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw new Error(`createRun failed: ${error.message}`);

  // If we set this run active, also update quotations.active_optimizer_run_id
  // so the rollup in Phase 7 can find it without scanning the runs table.
  if (input.setActive && data) {
    const { error: qErr } = await supabase
      .from('quotations')
      .update({
        active_optimizer_run_id: data.id,
        optimizer_total_amount:  input.kpis.totalCost,
        optimizer_is_stale:      false,
      })
      .eq('id', input.quotationId);
    if (qErr) throw new Error(`createRun (update quotation) failed: ${qErr.message}`);
  }

  return data!.id;
}

/**
 * Flip the active run for a quotation. Deactivates whatever is currently
 * active (enforced at DB level by the unique partial index).
 */
export async function setActiveRun(
  quotationId: string,
  runId: string,
): Promise<void> {
  // Deactivate everything else for this quotation.
  const { error: clrErr } = await supabase
    .from('quotation_optimizer_runs')
    .update({ is_active: false })
    .eq('quotation_id', quotationId)
    .eq('is_active', true);
  if (clrErr) throw new Error(`setActiveRun (deactivate prev) failed: ${clrErr.message}`);

  // Activate the target.
  const { error: setErr } = await supabase
    .from('quotation_optimizer_runs')
    .update({ is_active: true })
    .eq('id', runId);
  if (setErr) throw new Error(`setActiveRun (activate) failed: ${setErr.message}`);

  // Mirror into quotations so the rollup finds it.
  const run = await loadRun(runId);
  const { error: qErr } = await supabase
    .from('quotations')
    .update({
      active_optimizer_run_id: run.id,
      optimizer_total_amount:  run.total_cost,
      optimizer_is_stale:      run.is_stale,
    })
    .eq('id', quotationId);
  if (qErr) throw new Error(`setActiveRun (update quotation) failed: ${qErr.message}`);
}

export async function renameRun(runId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('quotation_optimizer_runs')
    .update({ name })
    .eq('id', runId);
  if (error) throw new Error(`renameRun failed: ${error.message}`);
}

export async function deleteRun(runId: string): Promise<void> {
  const { error } = await supabase
    .from('quotation_optimizer_runs')
    .delete()
    .eq('id', runId);
  if (error) throw new Error(`deleteRun failed: ${error.message}`);
}

/**
 * Manual stale flip (used when the DB trigger cannot be relied upon, e.g.
 * from a dev script). Normal edits on `area_cabinets` already flip the flag
 * via `trg_area_cabinets_stale_optimizer`.
 */
export async function markActiveStale(quotationId: string): Promise<void> {
  const { error: runErr } = await supabase
    .from('quotation_optimizer_runs')
    .update({ is_stale: true })
    .eq('quotation_id', quotationId)
    .eq('is_active', true);
  if (runErr) throw new Error(`markActiveStale (runs) failed: ${runErr.message}`);

  const { error: qErr } = await supabase
    .from('quotations')
    .update({ optimizer_is_stale: true })
    .eq('id', quotationId);
  if (qErr) throw new Error(`markActiveStale (quotations) failed: ${qErr.message}`);
}
