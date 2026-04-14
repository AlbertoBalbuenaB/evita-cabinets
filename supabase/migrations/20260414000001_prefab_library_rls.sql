-- RLS policies for prefab library tables, mirroring closet_catalog/area_closet_items pattern.

alter table prefab_brand enable row level security;
alter table prefab_catalog enable row level security;
alter table prefab_catalog_price enable row level security;
alter table area_prefab_items enable row level security;

create policy "Authenticated users full access on prefab_brand"
  on prefab_brand for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Authenticated users full access on prefab_catalog"
  on prefab_catalog for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Authenticated users full access on prefab_catalog_price"
  on prefab_catalog_price for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Authenticated users full access on area_prefab_items"
  on area_prefab_items for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
