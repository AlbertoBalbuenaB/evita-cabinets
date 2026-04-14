-- View: prefab_catalog_with_prices
--
-- Returns one row per prefab_catalog SKU with all current prices
-- pre-aggregated as a JSONB array sorted by finish name.
--
-- Why this exists:
--   The client-side two-query pattern (prefab_catalog + prefab_catalog_price)
--   is subject to PostgREST's per-request row cap (default 1 000, configurable
--   but not overridable by the JS client when max-rows is set server-side).
--   Northville has ~2 338 current prices; Venus has ~4 084 — both exceed the
--   cap, silently truncating results and causing "0 finishes / — price" in the UI.
--
--   By aggregating here, the client fetches ≤ 650 rows (one per SKU) regardless
--   of how many finish/price combinations exist.

create or replace view public.prefab_catalog_with_prices
  with (security_invoker = true)
as
select
  pc.id,
  pc.brand_id,
  pc.category,
  pc.cabinet_code,
  pc.description,
  pc.item_type,
  pc.width_in,
  pc.height_in,
  pc.depth_in,
  pc.dims_auto_parsed,
  pc.dims_locked,
  pc.is_active,
  pc.notes,
  pc.created_at,
  pc.updated_at,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',                pcp.id,
        'prefab_catalog_id', pcp.prefab_catalog_id,
        'finish',            pcp.finish,
        'cost_usd',          pcp.cost_usd,
        'effective_date',    pcp.effective_date,
        'is_current',        pcp.is_current,
        'created_at',        pcp.created_at
      )
      order by pcp.finish
    ) filter (where pcp.id is not null and pcp.is_current = true),
    '[]'::jsonb
  ) as prices
from public.prefab_catalog pc
left join public.prefab_catalog_price pcp on pcp.prefab_catalog_id = pc.id
group by pc.id;
