/**
 * Shared types for the optimizer-pricing quotation path.
 *
 * These types describe the JSONB payloads persisted in
 * `quotation_optimizer_runs.snapshot` and the denormalized KPI columns.
 * Keep this file decoupled from React / Supabase — it should stay pure
 * TypeScript so it can be imported from library modules, the Zustand
 * store, and UI components alike.
 */

import type { Pieza, StockSize, EbConfig, EbCabinetMap, EbTypeSummary, OptimizationResult } from '../types';

/** Frozen snapshot of everything needed to re-render a saved optimizer run. */
export interface OptimizerRunSnapshot {
  version: 1;

  /** Pieces fed to the engine, tagged with cabinetId/areaId/cutPieceRole. */
  pieces: Pieza[];

  /** Stocks auto-built from price_list at build time. */
  stocks: StockSize[];

  /** Edge-band slot config (a/b/c) derived from cabinet edgeband ids. */
  ebConfig: EbConfig;

  /** Mapping from EbConfig slot → price_list item id (for cost lookups). */
  ebSlotToPriceListId: Record<'a' | 'b' | 'c', string | null>;

  /** Engine settings frozen at build time. */
  settings: {
    sierra: number;
    minOffcut: number;
    boardTrim: number;
    trimIncludesKerf: boolean;
  };

  /** Per-area attribution: area_id → { m², cost, fractional board count }. */
  areaAttribution: Record<string, { m2: number; cost: number; boards: number }>;

  /** Per-cabinet attribution: cabinet_id → { m², cost }. */
  cabinetAttribution: Record<string, { m2: number; cost: number }>;

  /** Per-cabinet edge band cost (for cost substitution). */
  edgebandCostByCabinet: Record<string, number>;

  /**
   * Per-cabinet edgeband price lookup — maps cabinetId → cubrecanto code →
   * { pricePerMeter, plId, name }. When present, `computeEdgebandCost` uses
   * this instead of the global 3-slot `ebConfig` for pricing. Optional for
   * backward compat with snapshots created before this field existed.
   */
  ebCabinetMap?: EbCabinetMap;

  /** Summary of all distinct edgeband types across the quotation. */
  ebTypeSummary?: Record<string, EbTypeSummary>;

  /** Warnings surfaced to the user at build time. */
  warnings: string[];

  /** Cabinet ids that produced pieces (rest fell back to ft²). */
  cabinetsCovered: string[];

  /** Cabinet ids skipped and why. */
  cabinetsSkipped: Array<{ id: string; reason: string }>;

  /** Per-cabinet display metadata (SKU + description) for the Cut-list UI.
   *  Optional because runs saved before this field was introduced won't
   *  have it — the UI falls back to re-querying area_cabinets in that case. */
  cabinetDetails?: Record<string, {
    productSku: string | null;
    productDescription: string | null;
    quantity: number;
    areaId: string;
    areaName: string;
  }>;

  /** ISO timestamp of when the run was built. */
  builtAt: string;
}

/** Denormalized KPIs stored as regular columns for fast list/analytics queries. */
export interface OptimizerRunKpis {
  totalCost: number;
  materialCost: number;
  edgebandCost: number;
  /** Percent (0-100). */
  wastePct: number;
  boardCount: number;
  /** Sum of all piece m² (denominator for cost_per_m2). */
  totalPieceM2: number;
  /** totalCost / totalPieceM2, or 0 when no pieces. */
  costPerM2: number;
}

/** Compute KPIs from an engine result + edgeband cost. Pure function. */
export function deriveKpis(
  result: OptimizationResult,
  edgebandCost: number,
): OptimizerRunKpis {
  const totalPieceM2 = result.boards.reduce((sum, b) => sum + b.areaUsed, 0);
  const totalBoardM2 = result.boards.reduce((sum, b) => sum + b.areaTotal, 0);
  const wastePct = totalBoardM2 > 0
    ? ((totalBoardM2 - totalPieceM2) / totalBoardM2) * 100
    : 0;
  const totalCost = result.totalCost + edgebandCost;
  const costPerM2 = totalPieceM2 > 0 ? totalCost / totalPieceM2 : 0;

  return {
    totalCost,
    materialCost: result.totalCost,
    edgebandCost,
    wastePct,
    boardCount: result.boards.length,
    totalPieceM2,
    costPerM2,
  };
}
