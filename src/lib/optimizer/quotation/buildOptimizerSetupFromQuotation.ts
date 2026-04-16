/**
 * Build an optimizer setup (pieces + stocks + eb config) from a quotation.
 *
 * Reads all area_cabinets belonging to the quotation, pulls their cut_pieces
 * from products_catalog, resolves each piece's material to the corresponding
 * price_list row via the cabinet's box/doors/back_panel material FKs, then
 * assembles the Pieza[] + StockSize[] + EbConfig tuple that feeds the
 * optimizer engine.
 *
 * This is the main entry point for Phase 3 of the optimizer-pricing
 * implementation (plan §3). Pure I/O function — no state mutation other
 * than the Supabase reads.
 *
 * Key design decisions:
 * - Cabinets without cut_pieces are skipped (D2 mixed mode) and listed in
 *   `cabinetsSkipped` so the caller can fall back to ft² pricing for them.
 * - Materials missing technical info fall back to a 2440×1220 mm board
 *   with a warning (D1).
 * - Edge banding is limited to 3 slots (a/b/c) mapped to the 3 distinct
 *   edgeband price_list ids referenced by the cabinets. Extra edgebands
 *   are rolled into slot c with a warning.
 * - Legacy `'cuerpo'`-tagged Back Panels (pre-Phase-1 templates) keep
 *   working: if `back_panel_material_id` is set and the piece name matches
 *   /back/i, it's routed to the back material.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Pieza, StockSize, EbConfig, EbTypeConfig, EbCabinetMap, EbTypeSummary } from '../types';
import type { CutPiece, Cubrecanto } from '../../../types';
import type { Database } from '../../database.types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** D1 fallback when a material has no technical_width/height_mm. */
const FALLBACK_BOARD_WIDTH_MM = 2440;
const FALLBACK_BOARD_HEIGHT_MM = 1220;
const FALLBACK_THICKNESS_MM = 18;
const DEFAULT_KERF_MM = 3.2;

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildResult {
  pieces: Pieza[];
  stocks: StockSize[];
  ebConfig: EbConfig;
  /** Which price_list id each EbConfig slot maps to (for cost calc). */
  ebSlotToPriceListId: Record<'a' | 'b' | 'c', string | null>;
  /** Human-readable warnings surfaced to the UI. */
  warnings: string[];
  /** Cabinet ids that generated pieces (for subtotal substitution later). */
  cabinetsCovered: Set<string>;
  /** Sum of cab.quantity for every covered cabinet — the "cabinet units" count. */
  cabinetsInstanceCount: number;
  /** Per-cabinet display metadata, keyed by area_cabinets.id. Used by the
   *  Cut-list detail UI panel to label each group. */
  cabinetDetails: Record<string, {
    productSku: string | null;
    productDescription: string | null;
    quantity: number;
    areaId: string;
    areaName: string;
  }>;
  /** Cabinet ids skipped (e.g. no cut_pieces) — fall back to ft² pricing. */
  cabinetsSkipped: Array<{ id: string; reason: string }>;
  /** Per-cabinet edgeband price lookup for accurate per-piece pricing. */
  ebCabinetMap: EbCabinetMap;
  /** Summary of all distinct edgeband types across the quotation. */
  ebTypeSummary: Record<string, EbTypeSummary>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type PriceListRow = Database['public']['Tables']['price_list']['Row'];
type AreaCabinetRow = Database['public']['Tables']['area_cabinets']['Row'];
type ProductRow = Pick<
  Database['public']['Tables']['products_catalog']['Row'],
  'sku' | 'cut_pieces' | 'description'
>;

const DEFAULT_CUBRECANTO: Cubrecanto = { sup: 0, inf: 0, izq: 0, der: 0 };

/** Detect a Back Panel piece whose template still tags it as 'cuerpo'. */
function isLegacyBackPanel(name: string): boolean {
  return /back\s*panel|trasero|posterior/i.test(name);
}

/** Price-list items whose concept_description contains "not apply" are placeholders
 *  meaning "no material selected". Treat them as absent for optimizer purposes. */
function isNotApply(description: string | null | undefined): boolean {
  return /not\s*apply/i.test(description ?? '');
}

/** Key used by the optimizer engine to group pieces: `${material}_${grosor}`. */
function stockKey(priceListId: string, thicknessMm: number): string {
  return `${priceListId}__${thicknessMm}`;
}

/** Coerce the JSONB cut_pieces blob to a typed array. */
function parseCutPieces(raw: unknown): CutPiece[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is CutPiece =>
    p != null &&
    typeof p === 'object' &&
    typeof (p as CutPiece).nombre === 'string' &&
    typeof (p as CutPiece).ancho === 'number' &&
    typeof (p as CutPiece).alto === 'number' &&
    typeof (p as CutPiece).cantidad === 'number',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────────────────────────────────────

export async function buildOptimizerSetupFromQuotation(
  quotationId: string,
  supabase: SupabaseClient<Database>,
): Promise<BuildResult> {
  const warnings: string[] = [];
  const cabinetsCovered = new Set<string>();
  const cabinetsSkipped: Array<{ id: string; reason: string }> = [];

  // 1. Load all cabinets for this quotation (via project_areas.project_id).
  const { data: cabinetsRaw, error: cabErr } = await supabase
    .from('area_cabinets')
    .select('*, project_areas!inner(id, name, project_id)')
    .eq('project_areas.project_id', quotationId);

  if (cabErr) {
    throw new Error(`Failed to load area_cabinets: ${cabErr.message}`);
  }

  const cabinets = (cabinetsRaw ?? []) as Array<
    AreaCabinetRow & {
      project_areas: { id: string; name: string; project_id: string };
    }
  >;

  if (cabinets.length === 0) {
    return {
      pieces: [],
      stocks: [],
      ebConfig: emptyEbConfig(),
      ebSlotToPriceListId: { a: null, b: null, c: null },
      warnings: ['This quotation has no cabinets yet.'],
      cabinetsCovered,
      cabinetsInstanceCount: 0,
      cabinetDetails: {},
      cabinetsSkipped,
      ebCabinetMap: {},
      ebTypeSummary: {},
    };
  }

  // 2. Load all referenced products_catalog rows (for cut_pieces).
  const skus = Array.from(new Set(cabinets.map((c) => c.product_sku).filter((s): s is string => !!s)));
  const productsBySku = new Map<string, ProductRow>();
  if (skus.length > 0) {
    const { data: products, error: prodErr } = await supabase
      .from('products_catalog')
      .select('sku, cut_pieces, description')
      .in('sku', skus);
    if (prodErr) {
      throw new Error(`Failed to load products_catalog: ${prodErr.message}`);
    }
    for (const p of products ?? []) productsBySku.set(p.sku, p);
  }

  // 3. Collect every price_list id referenced by any cabinet (material + edgeband).
  const priceListIds = new Set<string>();
  for (const c of cabinets) {
    if (c.box_material_id)             priceListIds.add(c.box_material_id);
    if (c.doors_material_id)           priceListIds.add(c.doors_material_id);
    if (c.back_panel_material_id)      priceListIds.add(c.back_panel_material_id);
    if (c.box_edgeband_id)             priceListIds.add(c.box_edgeband_id);
    if (c.doors_edgeband_id)           priceListIds.add(c.doors_edgeband_id);
    if (c.box_interior_finish_id)      priceListIds.add(c.box_interior_finish_id);
    if (c.doors_interior_finish_id)    priceListIds.add(c.doors_interior_finish_id);
  }

  const priceListById = new Map<string, PriceListRow>();
  if (priceListIds.size > 0) {
    const { data: rows, error: plErr } = await supabase
      .from('price_list')
      .select('*')
      .in('id', Array.from(priceListIds));
    if (plErr) {
      throw new Error(`Failed to load price_list: ${plErr.message}`);
    }
    for (const r of rows ?? []) priceListById.set(r.id, r);
  }

  // 4. Iterate cabinets → cut_pieces, emit Pieza[] and accumulate stocks/eb.
  const pieces: Pieza[] = [];
  const stocksByKey = new Map<string, StockSize>();
  const ebByRole = { box: new Set<string>(), doors: new Set<string>() };
  let cabinetsInstanceCount = 0;
  const cabinetDetails: BuildResult['cabinetDetails'] = {};

  for (const cab of cabinets) {
    const areaId = cab.project_areas.id;
    const areaName = cab.project_areas.name;

    const product = cab.product_sku ? productsBySku.get(cab.product_sku) : null;
    const cutPieces = parseCutPieces(product?.cut_pieces);

    if (cutPieces.length === 0) {
      cabinetsSkipped.push({
        id: cab.id,
        reason: product
          ? `No cut_pieces defined on product ${cab.product_sku}`
          : `Cabinet has no linked product_sku`,
      });
      continue;
    }

    // Collect edgeband IDs by role (for deterministic slot assignment later).
    // Skip any "Not Apply" placeholder entries — they mean no edgeband.
    if (cab.box_edgeband_id) {
      const ebRow = priceListById.get(cab.box_edgeband_id);
      if (!isNotApply(ebRow?.concept_description)) {
        ebByRole.box.add(cab.box_edgeband_id);
      }
    }
    if (cab.doors_edgeband_id) {
      const ebRow = priceListById.get(cab.doors_edgeband_id);
      if (!isNotApply(ebRow?.concept_description)) {
        ebByRole.doors.add(cab.doors_edgeband_id);
      }
    }

    let cabinetProducedAnyPiece = false;

    for (const cp of cutPieces) {
      if (!cp.ancho || !cp.alto || !cp.cantidad || cp.cantidad <= 0) continue;

      // Resolve which material this piece belongs to.
      const role = cp.material;
      let materialId: string | null = null;
      switch (role) {
        case 'cuerpo':
          // Legacy: if the piece name is "Back Panel" and the cabinet has a
          // back_panel_material_id set, route there instead (matches the
          // cut-list engine behavior so existing templates keep working).
          if (isLegacyBackPanel(cp.nombre) && cab.back_panel_material_id) {
            materialId = cab.back_panel_material_id;
          } else {
            materialId = cab.box_material_id;
          }
          break;
        case 'frente':
          materialId = cab.doors_material_id;
          break;
        case 'back': {
          // If back_panel_material_id is set but is "Not Apply", fall back to box.
          const backId = cab.back_panel_material_id;
          if (backId) {
            const backRow = priceListById.get(backId);
            materialId = (backRow && isNotApply(backRow.concept_description))
              ? cab.box_material_id
              : backId;
          } else {
            materialId = cab.box_material_id;
          }
          break;
        }
        case 'custom':
          materialId = cab.box_material_id;
          warnings.push(
            `Cabinet "${cab.product_sku ?? cab.id}" in area "${areaName}": cut piece "${cp.nombre}" has material=custom and was routed to box material.`,
          );
          break;
      }

      if (!materialId) {
        warnings.push(
          `Cabinet "${cab.product_sku ?? cab.id}" in area "${areaName}": cut piece "${cp.nombre}" (${role}) has no material FK set — skipped.`,
        );
        continue;
      }

      const priceRow = priceListById.get(materialId);
      if (!priceRow) {
        warnings.push(
          `Cabinet "${cab.product_sku ?? cab.id}": material id ${materialId} not found in price_list — skipped.`,
        );
        continue;
      }

      // "Not Apply" entries are placeholders — treat as no material selected.
      if (isNotApply(priceRow.concept_description)) continue;

      // Resolve thickness (D1 fallback if missing).
      const thickness = priceRow.technical_thickness_mm ?? FALLBACK_THICKNESS_MM;
      if (priceRow.technical_thickness_mm == null) {
        warnings.push(
          `Material "${priceRow.concept_description}" has no technical_thickness_mm — assuming ${FALLBACK_THICKNESS_MM} mm.`,
        );
      }

      // Ensure a stock exists for this (material, thickness) pair.
      const key = stockKey(priceRow.id, thickness);
      if (!stocksByKey.has(key)) {
        const hasTechDims =
          priceRow.technical_width_mm != null &&
          priceRow.technical_height_mm != null &&
          priceRow.technical_width_mm > 0 &&
          priceRow.technical_height_mm > 0;

        if (!hasTechDims) {
          warnings.push(
            `Material "${priceRow.concept_description}" has no technical_width/height_mm — falling back to ${FALLBACK_BOARD_WIDTH_MM}×${FALLBACK_BOARD_HEIGHT_MM} mm board.`,
          );
        }

        stocksByKey.set(key, {
          id: crypto.randomUUID(),
          nombre: `${priceRow.concept_description} ${thickness}mm`,
          ancho: hasTechDims ? Number(priceRow.technical_width_mm)  : FALLBACK_BOARD_WIDTH_MM,
          alto:  hasTechDims ? Number(priceRow.technical_height_mm) : FALLBACK_BOARD_HEIGHT_MM,
          costo: Number(priceRow.price ?? 0),
          sierra: DEFAULT_KERF_MM,
          materialId: priceRow.id,
          qty: 0, // unlimited
        });
      }

      // Emit the Pieza (one entry; cantidad is multiplied by cabinet.quantity).
      const totalQty = cp.cantidad * (cab.quantity ?? 1);
      if (totalQty <= 0) continue;

      pieces.push({
        id: crypto.randomUUID(),
        nombre: cp.nombre || `Piece (${cab.product_sku ?? cab.id})`,
        material: `${priceRow.concept_description} ${thickness}mm`,
        grosor: thickness,
        ancho: cp.ancho,
        alto: cp.alto,
        cantidad: totalQty,
        veta: cp.veta ?? 'none',
        cubrecanto: cp.cubrecanto ?? DEFAULT_CUBRECANTO,
        area: areaName,
        cabinetId: cab.id,
        areaId,
        cutPieceRole: role,
        sourceCutPieceId: cp.id,
      });

      cabinetProducedAnyPiece = true;
    }

    // Interior finish pass — duplicate cuerpo/frente pieces with the
    // surface layer material if the cabinet has one configured.
    for (const cp of cutPieces) {
      if (!cp.ancho || !cp.alto || !cp.cantidad || cp.cantidad <= 0) continue;
      const role = cp.material;
      let finishMaterialId: string | null = null;
      if (role === 'cuerpo' && !isLegacyBackPanel(cp.nombre)) {
        finishMaterialId = cab.box_interior_finish_id ?? null;
      } else if (role === 'frente') {
        finishMaterialId = cab.doors_interior_finish_id ?? null;
      }
      if (!finishMaterialId) continue;

      const priceRow = priceListById.get(finishMaterialId);
      if (!priceRow || isNotApply(priceRow.concept_description)) continue;

      const thickness = priceRow.technical_thickness_mm ?? FALLBACK_THICKNESS_MM;
      const key = stockKey(priceRow.id, thickness);
      if (!stocksByKey.has(key)) {
        const hasTechDims =
          priceRow.technical_width_mm != null &&
          priceRow.technical_height_mm != null &&
          priceRow.technical_width_mm > 0 &&
          priceRow.technical_height_mm > 0;
        stocksByKey.set(key, {
          id: crypto.randomUUID(),
          nombre: `${priceRow.concept_description} ${thickness}mm`,
          ancho: hasTechDims ? Number(priceRow.technical_width_mm) : FALLBACK_BOARD_WIDTH_MM,
          alto:  hasTechDims ? Number(priceRow.technical_height_mm) : FALLBACK_BOARD_HEIGHT_MM,
          costo: Number(priceRow.price ?? 0),
          sierra: DEFAULT_KERF_MM,
          materialId: priceRow.id,
          qty: 0,
        });
      }

      const totalQty = cp.cantidad * (cab.quantity ?? 1);
      if (totalQty <= 0) continue;

      pieces.push({
        id: crypto.randomUUID(),
        nombre: `${cp.nombre} (interior finish)`,
        material: `${priceRow.concept_description} ${thickness}mm`,
        grosor: thickness,
        ancho: cp.ancho,
        alto: cp.alto,
        cantidad: totalQty,
        veta: cp.veta ?? 'none',
        cubrecanto: DEFAULT_CUBRECANTO,
        area: areaName,
        cabinetId: cab.id,
        areaId,
        cutPieceRole: 'interior-finish',
        sourceCutPieceId: cp.id,
      });
    }

    if (cabinetProducedAnyPiece) {
      cabinetsCovered.add(cab.id);
      const qty = cab.quantity ?? 1;
      cabinetsInstanceCount += qty;
      cabinetDetails[cab.id] = {
        productSku: cab.product_sku,
        productDescription: product?.description ?? null,
        quantity: qty,
        areaId: cab.project_areas.id,
        areaName: cab.project_areas.name,
      };
    } else if (!cabinetsSkipped.some((s) => s.id === cab.id)) {
      // All cut_pieces had materials set to "Not Apply" or missing links.
      // Still cover the cabinet so its hardware/accessories are included in the
      // optimizer total instead of falling back to ft² pricing.
      cabinetsCovered.add(cab.id);
      const qty = cab.quantity ?? 1;
      cabinetsInstanceCount += qty;
      cabinetDetails[cab.id] = {
        productSku: cab.product_sku,
        productDescription: product?.description ?? null,
        quantity: qty,
        areaId: cab.project_areas.id,
        areaName: cab.project_areas.name,
      };
      warnings.push(
        `Cabinet "${cab.product_sku ?? cab.id}" in area "${areaName}": all cut pieces have no board material (materials may be set to "Not Apply"). Covered as hardware-only — no boards generated.`,
      );
    }
  }

  // 5. Legacy slot assignment (backward compat for sidebar display / old runs).
  const boxEbId = ebByRole.box.size > 0 ? Array.from(ebByRole.box)[0] : null;
  const doorsEbId = ebByRole.doors.size > 0 ? Array.from(ebByRole.doors)[0] : boxEbId;
  const usedEbIds = new Set([boxEbId, doorsEbId].filter(Boolean));
  const extraEbIds = [...ebByRole.box, ...ebByRole.doors].filter(id => !usedEbIds.has(id));
  const slotCId = extraEbIds.length > 0 ? extraEbIds[0] : null;

  const ebSlotToPriceListId: Record<'a' | 'b' | 'c', string | null> = {
    a: boxEbId,
    b: doorsEbId,
    c: slotCId,
  };

  const ebConfig: EbConfig = {
    a: ebSlotFromPriceList(priceListById, ebSlotToPriceListId.a),
    b: ebSlotFromPriceList(priceListById, ebSlotToPriceListId.b),
    c: ebSlotFromPriceList(priceListById, ebSlotToPriceListId.c),
  };

  // 6. Per-cabinet edgeband price map — supports N distinct types.
  // Each cabinet maps cubrecanto code → its actual edgeband price/name/id.
  const ebCabinetMap: EbCabinetMap = {};
  const ebTypeSummaryMap = new Map<string, EbTypeSummary & { _roles: Set<string> }>();

  for (const cab of cabinets) {
    if (!cabinetsCovered.has(cab.id)) continue;
    const cabMap: Record<number, { pricePerMeter: number; plId: string; name: string }> = {};

    // Code 1 → box construction edgeband
    if (cab.box_edgeband_id) {
      const row = priceListById.get(cab.box_edgeband_id);
      if (row && !isNotApply(row.concept_description)) {
        const pricePerMeter = row.price_with_tax ?? row.price ?? 0;
        cabMap[1] = { pricePerMeter: Number(pricePerMeter), plId: row.id, name: row.concept_description };
        const existing = ebTypeSummaryMap.get(row.id);
        if (existing) {
          existing._roles.add('box');
        } else {
          ebTypeSummaryMap.set(row.id, {
            name: row.concept_description, pricePerMeter: Number(pricePerMeter),
            plId: row.id, roles: [], _roles: new Set(['box']),
          });
        }
      }
    }

    // Code 2 → doors / fronts edgeband
    if (cab.doors_edgeband_id) {
      const row = priceListById.get(cab.doors_edgeband_id);
      if (row && !isNotApply(row.concept_description)) {
        const pricePerMeter = row.price_with_tax ?? row.price ?? 0;
        cabMap[2] = { pricePerMeter: Number(pricePerMeter), plId: row.id, name: row.concept_description };
        const existing = ebTypeSummaryMap.get(row.id);
        if (existing) {
          existing._roles.add('doors');
        } else {
          ebTypeSummaryMap.set(row.id, {
            name: row.concept_description, pricePerMeter: Number(pricePerMeter),
            plId: row.id, roles: [], _roles: new Set(['doors']),
          });
        }
      }
    }

    if (Object.keys(cabMap).length > 0) {
      ebCabinetMap[cab.id] = cabMap;
    }
  }

  // Finalize summary (convert Set to array for JSON serialization)
  const ebTypeSummary: Record<string, EbTypeSummary> = {};
  for (const [plId, entry] of ebTypeSummaryMap) {
    ebTypeSummary[plId] = {
      name: entry.name, pricePerMeter: entry.pricePerMeter,
      plId: entry.plId, roles: Array.from(entry._roles) as ('box' | 'doors')[],
    };
  }

  return {
    pieces,
    stocks: Array.from(stocksByKey.values()),
    ebConfig,
    ebSlotToPriceListId,
    warnings,
    cabinetsCovered,
    cabinetsInstanceCount,
    cabinetDetails,
    cabinetsSkipped,
    ebCabinetMap,
    ebTypeSummary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

function emptyEbSlot(): EbTypeConfig {
  return { id: '', name: '', price: 0 };
}

function emptyEbConfig(): EbConfig {
  return { a: emptyEbSlot(), b: emptyEbSlot(), c: emptyEbSlot() };
}

function ebSlotFromPriceList(
  priceListById: Map<string, PriceListRow>,
  priceListId: string | null,
): EbTypeConfig {
  if (!priceListId) return emptyEbSlot();
  const row = priceListById.get(priceListId);
  if (!row) return emptyEbSlot();
  return {
    id: row.id,
    name: row.concept_description,
    price: Number(row.price ?? 0),
  };
}
