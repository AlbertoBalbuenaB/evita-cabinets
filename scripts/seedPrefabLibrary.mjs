#!/usr/bin/env node
/**
 * One-shot seed for the Prefab Library catalog from data/prefab/*.csv.
 *
 * Usage:
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
 *   node scripts/seedPrefabLibrary.mjs
 *
 * Idempotent:
 *   - prefab_catalog uses UNIQUE (brand_id, cabinet_code) and ON CONFLICT DO UPDATE
 *     so re-running will refresh category/item_type/dims but won't duplicate rows.
 *   - prefab_catalog_price uses UNIQUE (prefab_catalog_id, finish, effective_date='2024-09-01')
 *     so re-running updates prices in place.
 *
 * Re-uses the decoder from src/lib/prefabCodeDecoder.ts — imported via a tiny
 * inlined port to avoid adding tsx as a dependency (this script is pure Node ESM).
 *
 * No xlsx libs required. For future price list updates (new brand, new cutoff
 * date), use the UI's "Import price list" button, which calls
 * src/lib/prefabImport.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');

// ─────────────── Config ───────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const BRANDS = [
  { name: 'Venus', csv: 'data/prefab/venus_2024_09.csv' },
  { name: 'Northville', csv: 'data/prefab/northville_2024_09.csv' },
];
const EFFECTIVE_DATE = '2024-09-01';
const CATALOG_BATCH = 200;
const PRICE_BATCH = 500;

// ─────────────── Decoder (port of src/lib/prefabCodeDecoder.ts) ───────────────
const BASE_DEPTH = 24, BASE_HEIGHT = 34.5, WALL_DEPTH = 12;
const VANITY_DEPTH = 21, VANITY_HEIGHT = 34.5, TALL_DEPTH = 24;
const DEFAULT_RESULT = { item_type: 'cabinet', width_in: null, height_in: null, depth_in: null, confidence: 'low' };
const n2 = (s) => { if (s == null) return null; const v = parseInt(s, 10); return Number.isFinite(v) ? v : null; };
const SUFFIX = '(?:DL\\/R|DL|DR|L\\/R|L|R|DD|D)?(?:-\\d+)?(?:-[A-Z]+)?';
const RULES = [
  { re: new RegExp(`^VSD(\\d{2})(\\d{2})?(?:SINGLE|DOUBLE)?${SUFFIX}$`), b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:VANITY_HEIGHT, depth_in:m[2]?n2(m[2]):VANITY_DEPTH, confidence:m[2]?'high':'medium'}) },
  { re: new RegExp(`^VSB(\\d{2})(\\d{2})?${SUFFIX}$`), b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:VANITY_HEIGHT, depth_in:m[2]?n2(m[2]):VANITY_DEPTH, confidence:'high'}) },
  { re: /^VDB(\d{2})(?:(\d{2})(\d{2}))?(?:21)?(?:-\d+)?$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:m[3]?n2(m[3]):VANITY_HEIGHT, depth_in:m[2]?n2(m[2]):VANITY_DEPTH, confidence:'high'}) },
  { re: /^VB(\d{2})(?:21)?$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:VANITY_HEIGHT, depth_in:VANITY_DEPTH, confidence:'high'}) },
  { re: /^VA(\d{2})(?:(\d{2})(\d{2}))?(?:DL\/R|D|DD)?$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:m[3]?n2(m[3]):VANITY_HEIGHT, depth_in:m[2]?n2(m[2]):VANITY_DEPTH, confidence:'high'}) },
  { re: /^VAS(\d{2})(\d{2})?$/, b: (m) => ({ item_type:'linear', width_in:n2(m[1]), height_in:m[2]?n2(m[2]):null, depth_in:null, confidence:'medium'}) },
  { re: /^GDWDC(\d{2})(\d{2})$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:WALL_DEPTH, confidence:'high'}) },
  { re: /^GDW(\d{2})(\d{2})$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:WALL_DEPTH, confidence:'high'}) },
  { re: /^WMDC(\d{2})(\d{2})(?:\d{2})?$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:WALL_DEPTH, confidence:'high'}) },
  { re: /^WMD(\d{2})(\d{2})(?:-\d+)?$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:WALL_DEPTH, confidence:'high'}) },
  { re: /^WDC(\d{2})(\d{2})(?:\d{2})?$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:WALL_DEPTH, confidence:'high'}) },
  { re: /^WBC(\d{2})(\d{2})(?:L\/R|L|R)?$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:WALL_DEPTH, confidence:'high'}) },
  { re: /^WPC(\d{2})(\d{2})$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:TALL_DEPTH, confidence:'high'}) },
  { re: /^WP(\d{2})(\d{2})(\d{2})?$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:m[3]?n2(m[3]):TALL_DEPTH, confidence:'high'}) },
  { re: /^W(\d{2})(\d{2})(\d{2})$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:n2(m[3]), confidence:'high'}) },
  { re: /^W(\d{2})(\d{2})$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:WALL_DEPTH, confidence:'high'}) },
  { re: /^TP(\d{2})(\d{2})$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:TALL_DEPTH, confidence:'high'}) },
  { re: /^OC(\d{2})(\d{2})(\d{2})?$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:m[3]?n2(m[3]):TALL_DEPTH, confidence:'high'}) },
  { re: /^RHA(\d{2})(\d{2})$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:WALL_DEPTH, confidence:'high'}) },
  { re: /^DB(\d{2})(?:-\d+)?$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:BASE_HEIGHT, depth_in:BASE_DEPTH, confidence:'high'}) },
  { re: /^SB(\d{2})$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:BASE_HEIGHT, depth_in:BASE_DEPTH, confidence:'high'}) },
  { re: /^BF(\d{1,2})(\d{2})?(?:-PO)?$/, b: (m) => ({ item_type:'linear', width_in:n2(m[1]), height_in:m[2]?n2(m[2]):null, depth_in:null, confidence:'medium'}) },
  { re: /^BBC(\d{2})[/(](\d{2})\)?$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:BASE_HEIGHT, depth_in:BASE_DEPTH, confidence:'medium'}) },
  { re: /^B(\d{2})[A-Z]{0,2}$/, b: (m) => ({ item_type:'cabinet', width_in:n2(m[1]), height_in:BASE_HEIGHT, depth_in:BASE_DEPTH, confidence:'high'}) },
  { re: /^TK\d+$/, b: () => ({ item_type:'linear', width_in:null, height_in:null, depth_in:null, confidence:'medium'}) },
  { re: /^SM\d*(?:-S)?$/, b: () => ({ item_type:'linear', width_in:null, height_in:null, depth_in:null, confidence:'medium'}) },
  { re: /^RRPF?(?:[\d*."]+)?$/, b: () => ({ item_type:'panel', width_in:null, height_in:null, depth_in:null, confidence:'medium'}) },
  { re: /^BP\d+(?:-\d+\/\d+)?$/, b: () => ({ item_type:'panel', width_in:null, height_in:null, depth_in:null, confidence:'medium'}) },
  { re: /^WF(\d)(\d{2})$/, b: (m) => ({ item_type:'linear', width_in:n2(m[1]), height_in:n2(m[2]), depth_in:null, confidence:'medium'}) },
];
function decode(raw) {
  const code = raw.trim().replace(/^"+|"+$/g, '').toUpperCase();
  if (!code) return { ...DEFAULT_RESULT };
  for (const r of RULES) { const m = code.match(r.re); if (m) return r.b(m); }
  return { ...DEFAULT_RESULT };
}

// ─────────────── CSV parser (minimal — our CSVs have no quoted fields) ───────────────
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

// ─────────────── Seed runner ───────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function resolveBrandIds() {
  const { data, error } = await supabase.from('prefab_brand').select('id, name');
  if (error) throw error;
  const map = new Map(data.map((b) => [b.name, b.id]));
  for (const b of BRANDS) {
    if (!map.has(b.name)) {
      throw new Error(`Missing brand in prefab_brand: ${b.name}. Apply the schema migration first.`);
    }
  }
  return map;
}

async function upsertCatalog(brandId, brandName, byCode) {
  const rows = [];
  for (const [code, data] of byCode) {
    const d = decode(code);
    rows.push({
      brand_id: brandId,
      category: data.category,
      cabinet_code: code,
      item_type: d.item_type,
      width_in: d.width_in,
      height_in: d.height_in,
      depth_in: d.depth_in,
      dims_auto_parsed: d.confidence !== 'low',
    });
  }
  for (let i = 0; i < rows.length; i += CATALOG_BATCH) {
    const chunk = rows.slice(i, i + CATALOG_BATCH);
    const { error } = await supabase
      .from('prefab_catalog')
      .upsert(chunk, { onConflict: 'brand_id,cabinet_code' });
    if (error) throw new Error(`upsert catalog ${brandName} chunk ${i}: ${error.message}`);
  }
  return rows.length;
}

async function upsertPrices(brandId, brandName, byCode) {
  // Fetch catalog ids so we can map code → id without a sub-select per row.
  const { data: catalogRows, error: catErr } = await supabase
    .from('prefab_catalog')
    .select('id, cabinet_code')
    .eq('brand_id', brandId);
  if (catErr) throw catErr;
  const idByCode = new Map(catalogRows.map((r) => [r.cabinet_code, r.id]));

  const rows = [];
  for (const [code, data] of byCode) {
    const id = idByCode.get(code);
    if (!id) { console.warn(`  warn: no catalog id for ${code}`); continue; }
    for (const p of data.prices) {
      if (!Number.isFinite(p.cost_usd)) continue;
      rows.push({
        prefab_catalog_id: id,
        finish: p.finish,
        cost_usd: p.cost_usd,
        effective_date: EFFECTIVE_DATE,
        is_current: true,
      });
    }
  }

  for (let i = 0; i < rows.length; i += PRICE_BATCH) {
    const chunk = rows.slice(i, i + PRICE_BATCH);
    const { error } = await supabase
      .from('prefab_catalog_price')
      .upsert(chunk, { onConflict: 'prefab_catalog_id,finish,effective_date' });
    if (error) throw new Error(`upsert prices ${brandName} chunk ${i}: ${error.message}`);
  }
  return rows.length;
}

function loadBrand(brandFile) {
  const text = fs.readFileSync(path.join(REPO_ROOT, brandFile), 'utf8');
  const rows = parseCsv(text);
  const byCode = new Map();
  for (const r of rows) {
    const code = (r.code || '').trim().replace(/^"+|"+$/g, '');
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, { category: r.category, prices: [] });
    byCode.get(code).prices.push({
      finish: (r.finish || '').trim(),
      cost_usd: parseFloat(r.cost_usd),
    });
  }
  return byCode;
}

async function main() {
  console.log('Seeding Prefab Library from data/prefab/*.csv ...');
  const brandIds = await resolveBrandIds();

  let totalSkus = 0;
  let totalPrices = 0;
  for (const b of BRANDS) {
    console.log(`\n== ${b.name} ==`);
    const byCode = loadBrand(b.csv);
    console.log(`  CSV: ${byCode.size} unique SKUs`);
    const catN = await upsertCatalog(brandIds.get(b.name), b.name, byCode);
    console.log(`  catalog upserted: ${catN}`);
    const prN = await upsertPrices(brandIds.get(b.name), b.name, byCode);
    console.log(`  prices upserted:  ${prN}`);
    totalSkus += catN;
    totalPrices += prN;
  }

  console.log(`\nDone. Total SKUs: ${totalSkus}, total price rows: ${totalPrices}.`);
  console.log('Safe to re-run (idempotent via UNIQUE constraints).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
