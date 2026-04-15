-- Evita Draft Tool — Phase 1 Backfill
-- Populates draft_family / draft_subfamily / draft_series /
-- draft_default_hinge / draft_enabled on products_catalog based on existing
-- sku, description, has_drawers, and width_in/height_in/depth_in columns.
--
-- Strategy: most-specific-first UPDATEs. Only rows with draft_family IS NULL
-- are touched in later passes, so the AWI matches take precedence. The final
-- UPDATE flips draft_enabled=true only when family + all required dimensions
-- are present.
--
-- Results (2026-04-15): 1512 / 1526 active rows enabled (99.08%).
-- 14 edge cases documented in docs/draft-tool/step2-unparsed-skus.csv.

-- ─── 1. AWI 1xx — base, no drawers ───────────────────────────────────────────
update public.products_catalog
set draft_family = 'base',
    draft_series = '100',
    draft_subfamily = case
      when description ilike '%Sink%' then 'sink_base'
      else 'base_standard'
    end
where sku ~ '^1[0-9]{1,2}M?-'
  and is_active = true
  and draft_family is null;

-- ─── 2. AWI 2xx — base with drawers ─────────────────────────────────────────
update public.products_catalog
set draft_family = 'base',
    draft_series = '200',
    draft_subfamily = case
      when description ilike '%Drawer Base%' then 'drawer_base'
      when description ilike '%Drawers%' then 'base_with_drawers'
      else 'base_with_drawers'
    end
where sku ~ '^2[0-9]{1,2}M?-'
  and is_active = true
  and draft_family is null;

-- ─── 3. AWI 3xx — wall hung ─────────────────────────────────────────────────
update public.products_catalog
set draft_family = 'wall',
    draft_series = '300',
    draft_subfamily = 'wall_standard'
where sku ~ '^3[0-9]{1,2}M?-'
  and is_active = true
  and draft_family is null;

-- ─── 4. AWI 4xx (400-459) — tall storage ────────────────────────────────────
update public.products_catalog
set draft_family = 'tall',
    draft_series = '400',
    draft_subfamily = case
      when description ilike '%Oven%' then 'oven_column'
      when description ilike '%Refrigerator%' or description ilike '%Fridge%' then 'fridge_column'
      when description ilike '%Pantry%' then 'pantry'
      when description ilike '%Open Tall%' then 'open_tall'
      else 'tall_standard'
    end
where sku ~ '^4[0-5][0-9]M?-'
  and is_active = true
  and draft_family is null;

-- ─── 5. 460 accessories (panels / fillers / toe kicks / crowns) ─────────────
update public.products_catalog
set draft_family = 'accessory',
    draft_series = '460',
    draft_subfamily = 'panel_filler_tk_crown'
where sku ~ '^46[0-9]'
  and is_active = true
  and draft_family is null;

-- ─── 6. Non-AWI: infer from description first ────────────────────────────────
-- 6a. Base cabinets (no drawers)
update public.products_catalog
set draft_family = 'base',
    draft_series = '100',
    draft_subfamily = 'base_nonawi'
where draft_family is null
  and is_active = true
  and description ilike '%Base Cabinet%'
  and has_drawers is not true;

-- 6b. Base cabinets with drawers
update public.products_catalog
set draft_family = 'base',
    draft_series = '200',
    draft_subfamily = 'base_drawer_nonawi'
where draft_family is null
  and is_active = true
  and description ilike '%Base Cabinet%'
  and has_drawers = true;

-- 6c. Wall cabinets
update public.products_catalog
set draft_family = 'wall',
    draft_series = '300',
    draft_subfamily = 'wall_nonawi'
where draft_family is null
  and is_active = true
  and (description ilike '%Wall Hung%'
       or description ilike '%Wall Cabinet%'
       or sku ~ '^W[0-9]');

-- 6d. Tall / hamper / oven column / pantry
update public.products_catalog
set draft_family = 'tall',
    draft_series = '400',
    draft_subfamily = case
      when description ilike '%Hamper%' or sku ~ '^HPT' then 'hamper'
      when description ilike '%Oven%' then 'oven_column'
      when description ilike '%Pantry%' then 'pantry'
      else 'tall_nonawi'
    end
where draft_family is null
  and is_active = true
  and (description ilike '%Tall Storage%'
       or description ilike '%Open Tall%'
       or description ilike '%Pantry%'
       or description ilike '%Hamper%'
       or sku ~ '^HPT'
       or sku ~ '^H[0-9]');

-- 6e. Closets inside products_catalog (legacy duplicates of closet_catalog)
update public.products_catalog
set draft_family = 'closet',
    draft_series = '500',
    draft_subfamily = case
      when description ilike '%Adjustable Shelves%' then 'closet_adjustable_shelves'
      when sku ~ '^CWR' then 'closet_wardrobe'
      when sku ~ '^CAS' then 'closet_adjustable_shelves'
      when sku ~ '^CHR' then 'closet_hanging_rod'
      when sku ~ '^CDB' then 'closet_drawer_base'
      else 'closet_generic'
    end
where draft_family is null
  and is_active = true
  and (description ilike '%Closet%'
       or sku ~ '^CAS'
       or sku ~ '^CWR'
       or sku ~ '^CHR'
       or sku ~ '^CDB');

-- 6f. Microwave base / drawer base legacy prefixes
update public.products_catalog
set draft_family = 'base',
    draft_series = '200',
    draft_subfamily = case
      when description ilike '%Microwave%' or sku ~ '^DMW' then 'microwave_base'
      when sku ~ '^DB' then 'drawer_base_legacy'
      else 'base_drawer_nonawi'
    end
where draft_family is null
  and is_active = true
  and (sku ~ '^D[BMW]'
       or description ilike '%Drawer Box%'
       or description ilike '%Microwave%');

-- 6g. Benches / openbox / misc tall
update public.products_catalog
set draft_family = case when height_in >= 60 then 'tall' else 'base' end,
    draft_series = case when height_in >= 60 then '400' else '100' end,
    draft_subfamily = case
      when sku ~ '^OPBOX' then 'openbox'
      when description ilike '%Bench%' or sku ~ '^Bench' then 'bench'
      else 'misc'
    end
where draft_family is null
  and is_active = true
  and (sku ~ '^B' or sku ~ '^OPBOX' or description ilike '%Bench%');

-- 6h. Generic fallback for remaining alphabetic prefixes
update public.products_catalog
set draft_family = case
      when sku ~ '^P' then 'tall'
      when sku ~ '^K' then 'base'
      when sku ~ '^G' then 'base'
      when sku ~ '^S' then 'base'
      when sku ~ '^J' then 'base'
      when sku ~ '^M' then 'wall'
      else 'base'
    end,
    draft_series = case
      when sku ~ '^P' then '400'
      else '100'
    end,
    draft_subfamily = 'generic_nonawi'
where draft_family is null
  and is_active = true
  and sku !~ '^[a-z]'
  and sku not in ('Empty')
  and sku !~ '^Test';

-- ─── 6i. Fix for "Open Micro Wave" anomaly ──────────────────────────────────
-- MW30.5x42.75x24 was captured by 6h as wall (sku ~ '^M'), but it's
-- really an open microwave base. Corrected here as part of the backfill
-- so the production DB and the migration file stay in sync.
update public.products_catalog
set draft_family = 'base',
    draft_series = '200',
    draft_subfamily = 'microwave_base'
where sku = 'MW30.5x42.75x24'
  and is_active = true;

-- ─── 7. Default hinge inference ─────────────────────────────────────────────
update public.products_catalog
set draft_default_hinge = case
  when description ilike '%2 Door%' or description ilike '%Double Door%' then 'double'
  when description ilike '%1 Door%' or description ilike '%Single Door%' then 'left'
  else null
end
where draft_family in ('base','wall','tall','closet')
  and draft_default_hinge is null;

-- ─── 8. Enablement flag ─────────────────────────────────────────────────────
-- Rows with family + width + height become enabled. Depth is required EXCEPT
-- for family='accessory' (460 panels can be 2D: width × height only).
update public.products_catalog
set draft_enabled = true
where draft_family is not null
  and width_in is not null
  and height_in is not null
  and (depth_in is not null or draft_family = 'accessory')
  and is_active = true;
