/**
 * Runtime xlsx importer for Prefab price lists (Venus / Northville).
 *
 * Wired up to the "Import price list" button in ProductsCatalog → Prefab tab.
 * Handles the full lifecycle when a new vendor price list arrives:
 *
 *   1. Parse xlsx → flat rows {code, finish, cost_usd, category}
 *   2. Upsert prefab_catalog (create missing SKUs, refresh dims unless
 *      dims_locked=true, run decoder on new codes).
 *   3. Archive previous prices for the affected brand (is_current=false)
 *      and insert new rows with effective_date=today.
 *   4. Soft-delete SKUs no longer present in the incoming list
 *      (is_active=false). Historical quotations keep working because
 *      area_prefab_items snapshots cost_usd/cost_mxn at insert time.
 *
 * Category column typically appears only on the first row of each SKU group
 * in vendor xlsx — we carry it forward.
 */

import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { decodePrefabCode } from './prefabCodeDecoder';
import type { PrefabItemType } from '../types';

export interface PrefabImportReport {
  brand: string;
  sheetName: string;
  rowsParsed: number;
  skusParsed: number;
  catalogInserted: number;
  catalogUpdated: number;
  catalogDeactivated: number;
  pricesInserted: number;
  pricesArchived: number;
  priceChanges: Array<{ code: string; finish: string; oldUsd: number | null; newUsd: number }>;
  errors: string[];
}

export interface PrefabImportOptions {
  /** Brand name that must already exist in `prefab_brand`. */
  brandName: 'Venus' | 'Northville' | string;
  /** Effective date for the new price rows. Defaults to today's ISO date. */
  effectiveDate?: string;
}

interface ParsedRow {
  code: string;
  finish: string;
  cost_usd: number;
  category: string;
}

const SHEET_NAME_HINTS = [
  /lista\s*de\s*precios/i,
  /price\s*list/i,
  /venus/i,
  /northville/i,
];

/**
 * Pick the best sheet: first match against the known hints, else sheet 0.
 */
function pickSheet(wb: XLSX.WorkBook): string {
  for (const hint of SHEET_NAME_HINTS) {
    const match = wb.SheetNames.find((n) => hint.test(n));
    if (match) return match;
  }
  return wb.SheetNames[0];
}

/**
 * Parse a Venus or Northville sheet into flat rows. We accept both layouts:
 *
 *   Venus      : A=code, B=finish, C=price_usd, D=category
 *   Northville : A=code, B=finish, C=price_usd, D=category, E=mxn_price (ignored)
 *
 * The header row contains labels like "CODE" / "CODIGO", "FINISH" / "ACABADO",
 * "PRICE" / "PRECIO", "CATEGORY" / "CATEGORIA". We find columns by header text
 * (first 10 rows) rather than fixed indices, so the importer is resilient to
 * small layout changes.
 *
 * Category column behaves as in the vendor xlsx: it is only populated on the
 * first row of each SKU group. We forward-fill null / empty category values.
 */
function parseSheet(ws: XLSX.WorkSheet): { rows: ParsedRow[]; errors: string[] } {
  const errors: string[] = [];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

  // Locate header row.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const cells = raw[i].map((c) => String(c ?? '').trim().toUpperCase());
    if (cells.some((c) => /\b(CODE|CODIGO|SKU)\b/.test(c)) &&
        cells.some((c) => /\b(FINISH|ACABADO|COLOR)\b/.test(c))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    errors.push('Header row not found (looking for CODE/CODIGO + FINISH/ACABADO).');
    return { rows: [], errors };
  }

  const headers = raw[headerIdx].map((c) => String(c ?? '').trim().toUpperCase());
  const findCol = (patterns: RegExp[]): number => {
    for (const pat of patterns) {
      const idx = headers.findIndex((h) => pat.test(h));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const iCode = findCol([/\b(CODE|CODIGO|SKU)\b/]);
  const iFinish = findCol([/\b(FINISH|ACABADO|COLOR)\b/]);
  const iPrice = findCol([/\b(PRICE|PRECIO)\b(?!.*MXN)/, /\bUSD\b/, /\b(PRICE|PRECIO)\b/]);
  const iCategory = findCol([/\b(CATEGORY|CATEGORIA|GRUPO|GROUP)\b/]);

  if (iCode < 0 || iFinish < 0 || iPrice < 0) {
    errors.push(`Missing required columns. code=${iCode}, finish=${iFinish}, price=${iPrice}`);
    return { rows: [], errors };
  }

  const rows: ParsedRow[] = [];
  let lastCategory = '';
  for (let r = headerIdx + 1; r < raw.length; r++) {
    const row = raw[r];
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue;

    const code = String(row[iCode] ?? '').trim().replace(/^"+|"+$/g, '');
    const finish = String(row[iFinish] ?? '').trim();
    const priceRaw = row[iPrice];
    const categoryCell = iCategory >= 0 ? String(row[iCategory] ?? '').trim() : '';

    if (categoryCell) lastCategory = categoryCell;

    if (!code) continue;
    if (!finish) {
      errors.push(`Row ${r + 1}: missing finish for code=${code}`);
      continue;
    }
    const cost_usd = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw));
    if (!Number.isFinite(cost_usd)) {
      errors.push(`Row ${r + 1}: invalid price "${String(priceRaw)}" for ${code}/${finish}`);
      continue;
    }
    rows.push({
      code,
      finish,
      cost_usd,
      category: lastCategory || 'UNCATEGORIZED',
    });
  }

  return { rows, errors };
}

/**
 * Import a new Venus/Northville price list from an xlsx file.
 */
export async function importPrefabPriceList(
  file: File,
  options: PrefabImportOptions,
): Promise<PrefabImportReport> {
  const effectiveDate =
    options.effectiveDate ?? new Date().toISOString().slice(0, 10);

  const report: PrefabImportReport = {
    brand: options.brandName,
    sheetName: '',
    rowsParsed: 0,
    skusParsed: 0,
    catalogInserted: 0,
    catalogUpdated: 0,
    catalogDeactivated: 0,
    pricesInserted: 0,
    pricesArchived: 0,
    priceChanges: [],
    errors: [],
  };

  // ── 1. Parse xlsx ──
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = pickSheet(wb);
  report.sheetName = sheetName;
  const { rows, errors } = parseSheet(wb.Sheets[sheetName]);
  report.errors.push(...errors);
  report.rowsParsed = rows.length;
  if (rows.length === 0) {
    report.errors.push('No valid rows parsed from sheet.');
    return report;
  }

  // Group rows by code → {category, prices[]}
  const byCode = new Map<string, { category: string; prices: { finish: string; cost_usd: number }[] }>();
  for (const r of rows) {
    if (!byCode.has(r.code)) byCode.set(r.code, { category: r.category, prices: [] });
    byCode.get(r.code)!.prices.push({ finish: r.finish, cost_usd: r.cost_usd });
  }
  report.skusParsed = byCode.size;

  // ── 2. Resolve brand ──
  const { data: brandRow, error: brandErr } = await supabase
    .from('prefab_brand')
    .select('id, name')
    .eq('name', options.brandName)
    .maybeSingle();
  if (brandErr || !brandRow) {
    report.errors.push(`Brand not found: ${options.brandName}`);
    return report;
  }
  const brandId = brandRow.id;

  // ── 3. Fetch existing catalog for this brand ──
  const { data: existingRows, error: exErr } = await supabase
    .from('prefab_catalog')
    .select('id, cabinet_code, dims_locked, is_active')
    .eq('brand_id', brandId);
  if (exErr) {
    report.errors.push(`Fetch catalog: ${exErr.message}`);
    return report;
  }
  const existingByCode = new Map(existingRows!.map((r) => [r.cabinet_code, r]));

  // ── 4. Upsert catalog rows ──
  // Split into "new" (insert) vs "existing" (update, respecting dims_locked).
  const toInsert: Array<{
    brand_id: string; category: string; cabinet_code: string; item_type: PrefabItemType;
    width_in: number | null; height_in: number | null; depth_in: number | null;
    dims_auto_parsed: boolean; is_active: boolean;
  }> = [];
  const toUpdate: Array<{
    id: string; category: string; width_in: number | null;
    height_in: number | null; depth_in: number | null;
    dims_auto_parsed: boolean; is_active: boolean;
  }> = [];

  for (const [code, data] of byCode) {
    const existing = existingByCode.get(code);
    const decoded = decodePrefabCode(code);
    if (!existing) {
      toInsert.push({
        brand_id: brandId,
        category: data.category,
        cabinet_code: code,
        item_type: decoded.item_type,
        width_in: decoded.width_in,
        height_in: decoded.height_in,
        depth_in: decoded.depth_in,
        dims_auto_parsed: decoded.confidence !== 'low',
        is_active: true,
      });
    } else {
      // Respect dims_locked — user-edited dims survive re-imports.
      const update: typeof toUpdate[number] = {
        id: existing.id,
        category: data.category,
        width_in: existing.dims_locked ? null : decoded.width_in,
        height_in: existing.dims_locked ? null : decoded.height_in,
        depth_in: existing.dims_locked ? null : decoded.depth_in,
        dims_auto_parsed: !existing.dims_locked && decoded.confidence !== 'low',
        is_active: true,
      };
      toUpdate.push(update);
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('prefab_catalog').insert(toInsert);
    if (error) report.errors.push(`Insert new catalog: ${error.message}`);
    else report.catalogInserted = toInsert.length;
  }

  for (const u of toUpdate) {
    const patch: Record<string, unknown> = {
      category: u.category,
      is_active: u.is_active,
    };
    // Only update dims when not locked.
    const existing = existingRows!.find((r) => r.id === u.id);
    if (existing && !existing.dims_locked) {
      patch.width_in = u.width_in;
      patch.height_in = u.height_in;
      patch.depth_in = u.depth_in;
      patch.dims_auto_parsed = u.dims_auto_parsed;
    }
    const { error } = await supabase.from('prefab_catalog').update(patch).eq('id', u.id);
    if (error) report.errors.push(`Update ${u.id}: ${error.message}`);
    else report.catalogUpdated++;
  }

  // ── 5. Soft-delete SKUs missing from the new list ──
  const incomingCodes = new Set(byCode.keys());
  const missing = existingRows!.filter(
    (r) => r.is_active && !incomingCodes.has(r.cabinet_code),
  );
  if (missing.length > 0) {
    const { error } = await supabase
      .from('prefab_catalog')
      .update({ is_active: false })
      .in('id', missing.map((r) => r.id));
    if (error) report.errors.push(`Deactivate missing: ${error.message}`);
    else report.catalogDeactivated = missing.length;
  }

  // ── 6. Archive existing current prices for the affected SKUs ──
  // Build the final code → id map (including freshly inserted rows).
  const { data: refreshedRows, error: refErr } = await supabase
    .from('prefab_catalog')
    .select('id, cabinet_code')
    .eq('brand_id', brandId);
  if (refErr) {
    report.errors.push(`Fetch refreshed catalog: ${refErr.message}`);
    return report;
  }
  const idByCode = new Map(refreshedRows!.map((r) => [r.cabinet_code, r.id]));
  const affectedIds = Array.from(byCode.keys())
    .map((code) => idByCode.get(code))
    .filter((id): id is string => !!id);

  if (affectedIds.length > 0) {
    // Read old current prices for the diff report, then archive them.
    const { data: oldPrices, error: oldErr } = await supabase
      .from('prefab_catalog_price')
      .select('prefab_catalog_id, finish, cost_usd')
      .in('prefab_catalog_id', affectedIds)
      .eq('is_current', true);
    if (oldErr) report.errors.push(`Fetch old prices: ${oldErr.message}`);
    const oldByKey = new Map<string, number>(
      (oldPrices ?? []).map((p) => [`${p.prefab_catalog_id}|${p.finish}`, p.cost_usd]),
    );

    const { error: archErr } = await supabase
      .from('prefab_catalog_price')
      .update({ is_current: false })
      .in('prefab_catalog_id', affectedIds)
      .eq('is_current', true);
    if (archErr) report.errors.push(`Archive old prices: ${archErr.message}`);
    // oldPrices was fetched above for the diff — same rows we just archived.
    report.pricesArchived = (oldPrices ?? []).length;

    // ── 7. Insert new prices ──
    const newPriceRows = [];
    for (const [code, data] of byCode) {
      const catalogId = idByCode.get(code);
      if (!catalogId) continue;
      for (const p of data.prices) {
        newPriceRows.push({
          prefab_catalog_id: catalogId,
          finish: p.finish,
          cost_usd: p.cost_usd,
          effective_date: effectiveDate,
          is_current: true,
        });
        const oldUsd = oldByKey.get(`${catalogId}|${p.finish}`);
        if (oldUsd !== undefined && oldUsd !== p.cost_usd) {
          report.priceChanges.push({
            code, finish: p.finish, oldUsd, newUsd: p.cost_usd,
          });
        } else if (oldUsd === undefined) {
          report.priceChanges.push({
            code, finish: p.finish, oldUsd: null, newUsd: p.cost_usd,
          });
        }
      }
    }

    // Chunk to stay under PostgREST row limits.
    const CHUNK = 500;
    for (let i = 0; i < newPriceRows.length; i += CHUNK) {
      const chunk = newPriceRows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('prefab_catalog_price')
        .upsert(chunk, { onConflict: 'prefab_catalog_id,finish,effective_date' });
      if (error) report.errors.push(`Insert new prices chunk ${i}: ${error.message}`);
      else report.pricesInserted += chunk.length;
    }
  }

  return report;
}

/**
 * Internal helpers exported for unit tests.
 * @internal
 */
export const __testables = {
  parseSheet,
  pickSheet,
};
