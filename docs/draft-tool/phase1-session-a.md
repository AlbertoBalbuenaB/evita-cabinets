# Evita Draft Tool — Phase 1, Session A report

**Fecha:** 2026-04-15
**Branch:** claude/upbeat-dhawan (→ merge planned as feature/draft-tool-phase-1)
**Scope:** Steps 0–2 of Prompt 2 Phase 1 — Discovery, schema migration, backfill.

## Outcome

- ✅ Discovery completed; 3 scope decisions taken by Alberto (see plan file).
- ✅ Schema migration `evita_draft_phase1_schema` applied: 8 draft_* columns added to `products_catalog`, 4 drawing tables created with RLS, 3 `source_drawing_element_id` columns added to `area_*` tables.
- ✅ Backfill migration `evita_draft_phase1_backfill` applied, plus a follow-up one-row fix for the "MW" microwave anomaly.
- ✅ `database.types.ts` regenerated (100,738 chars, up from ~91k) — now contains `drawings`, `drawing_areas`, `drawing_elevations`, `drawing_elements` tables and `draft_*` columns on `products_catalog`.

## Step 0 — Discovery findings (summary)

| Area | Finding |
|---|---|
| products_catalog.sku column | Column is `sku` (varchar, NOT NULL). Dimensions already exist in `width_in`, `height_in`, `depth_in` — no parsing from SKU needed. |
| AWI coverage | Only ~35% of catalog (539/1526) follows AWI 1xx–4xx pattern. Rest uses alphabetic prefixes (C, W, H, D, G, K, etc.). |
| Series 500 | Does NOT exist in products_catalog. Wardrobes/closets live in separate `closet_catalog` table (1222 rows with `cabinet_code`, not `sku`). |
| 460 series | 291 rows labeled "Accessories: Panel \| Filler \| Toe Kick \| Crown" — will be reused instead of creating a new `custom_piece` type. |
| area_cabinets FK | Uses `product_sku varchar`, not `product_id uuid`. Material binding via 6 separate FKs + jsonb hardware/accessories. |
| area_countertops | Uses `price_list_item_id` — countertops are NOT a custom data structure, they're line items of `price_list`. Simplifies Phase 3 mapping. |
| RLS pattern | Trivially simple: `USING (auth.uid() IS NOT NULL)` with `ALL` command. Mirrored on all 4 new drawing tables. |
| Phase 2 tables | `finishes` / `accessories` / `countertop_materials` / `appliances` do NOT exist — no conflicts for Phase 2. |
| Evita constants | Live in [src/lib/settingsStore.ts](../../src/lib/settingsStore.ts) (`SettingsCache` / `DEFAULT_SETTINGS`) + distributed material UUIDs in 27 files. Central location TBD in Session B. |
| cabinet_templates | Already exists (43 rows, "Stores reusable cabinet configurations"). May overlap conceptually with Phase 2 "Promote to Catalog" — review in Phase 2 Session F. |

## Step 2 — Backfill results

**Total active products: 1526. Enabled: 1512 (99.08%). Threshold in plan: 70%. Status: ✅ well above threshold, no replanning needed.**

### By family / series

| Family | Series | Count | Enabled | Notes |
|---|---|---|---|---|
| accessory | 460 | 291 | 288 | 3 rows have NULL dimensions in DB (dirty data) |
| base | 100 | 491 | 482 | 9 "Floating Shelf" (SKU 190-*) have NULL dimensions |
| base | 200 | 63 | 63 | ✓ |
| closet | 500 | 308 | 308 | ✓ (legacy duplicates of `closet_catalog`) |
| tall | 400 | 228 | 228 | ✓ |
| wall | 300 | 143 | 143 | ✓ |
| (null) | (null) | 2 | 0 | `Empty` placeholder + `Test-01` test data |
| **TOTAL** | | **1526** | **1512** | **99.08%** |

### Fine adjustments applied post-backfill

- `MW30.5x42.75x24` ("Open Micro Wave - 1 Shelf"): initial fallback 6h put it in `wall/100`. Corrected to `base/200/microwave_base`.

## 14 unparsed SKUs (draft_enabled = false)

These are edge cases that will stay disabled in Phase 1. They fall into three buckets:

### Bucket 1 — Dirty data in DB (3 rows, accessories)

460 accessories where `width_in`/`height_in`/`depth_in` are all NULL despite the SKU encoding the dimensions. Needs a separate data-cleanup pass, not a backfill concern.

| SKU | Description |
|---|---|
| 460-12x12 | Accessories: Panel \| Filler \| Toe Kick \| Crown |
| 460-96x44 | Accessories: Panel \| Filler \| Toe Kick \| Crown |
| 460-96x48 | Accessories: Panel \| Filler \| Toe Kick \| Crown |

### Bucket 2 — Floating shelves (9 rows)

190-series "Floating Shelf" items, labeled as `base/100` by the AWI regex, but their `width_in`/`height_in`/`depth_in` are all NULL. Floating shelves aren't a standard draft tool element. Deferred — decide in Phase 2 whether they become a Custom Piece subtype or a new element_type.

| SKU |
|---|
| 190-12x2x12 |
| 190-24x2x12 |
| 190-36x2x12 |
| 190-48x2x12 |
| 190-48x7x15 |
| 190-60x2x12 |
| 190-72x2x12 |
| 190-84x2x12 |
| 190-96x2x12 |

### Bucket 3 — Non-production rows (2 rows)

| SKU | Reason |
|---|---|
| Empty | Placeholder row |
| Test-01 | Test data (excluded via `sku !~ '^Test'` rule in backfill 6h) |

## Schema added

### products_catalog columns

```sql
draft_family         text           -- base | wall | tall | accessory | closet
draft_subfamily      text           -- e.g. base_standard, sink_base, oven_column, hamper
draft_series         text           -- 100 | 200 | 300 | 400 | 460 | 500
draft_default_hinge  text           -- left | right | double | null
draft_plan_svg       text           -- custom SVG override (null = generated)
draft_elevation_svg  text
draft_detail_svg     text
draft_enabled        boolean        -- true if all required fields populated
```

### New tables

- `drawings` — top-level drawing entity, FK to `quotations.id`
- `drawing_areas` — areas within a drawing (e.g. "Kitchen" with prefix "K")
- `drawing_elevations` — elevations within an area (letter, wall angle)
- `drawing_elements` — walls / cabinets / custom_pieces / countertops / dimensions / notes / keyplan_arrows

### Forward-compat columns added to existing tables

- `area_cabinets.source_drawing_element_id uuid` (nullable, indexed)
- `area_items.source_drawing_element_id uuid` (nullable, indexed)
- `area_countertops.source_drawing_element_id uuid` (nullable, indexed)

These are consumed in Phase 3 for idempotent re-sync but are harmless columns today.

## Migrations written

1. `evita_draft_phase1_schema` — schema (applied to production via MCP)
2. `evita_draft_phase1_backfill` — data backfill (applied to production via MCP)

Both need to be committed locally into `supabase/migrations/` so they stay in sync with `supabase_migrations.schema_migrations`.

## Next — Session B

Ready to proceed to **Session B: Tool Shell, Canvas, Walls, Catalog & Renderer (Steps 3–7)**. No blockers from Session A. Dependencies to install in Session B: `konva`, `react-konva`, `svg2pdf.js`.
