-- Prefab Library schema (Venus + Northville reseller catalog)
-- Parallel to closet_catalog / area_closet_items but without despiece/waste/labor.
-- See data/prefab/README.md for seed context.

create table prefab_brand (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active bool not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create type prefab_item_type as enum ('cabinet','accessory','linear','panel');

create table prefab_catalog (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references prefab_brand(id) on delete restrict,
  category text not null,
  cabinet_code text not null,
  description text,
  item_type prefab_item_type not null default 'cabinet',
  width_in numeric,
  height_in numeric,
  depth_in numeric,
  dims_auto_parsed bool not null default false,
  dims_locked bool not null default false,
  is_active bool not null default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (brand_id, cabinet_code)
);
create index on prefab_catalog (brand_id, category);
create index on prefab_catalog (brand_id, is_active);

create table prefab_catalog_price (
  id uuid primary key default gen_random_uuid(),
  prefab_catalog_id uuid not null references prefab_catalog(id) on delete cascade,
  finish text not null,
  cost_usd numeric not null,
  effective_date date not null default current_date,
  is_current bool not null default true,
  created_at timestamptz default now(),
  unique (prefab_catalog_id, finish, effective_date)
);
create index on prefab_catalog_price (prefab_catalog_id, is_current);

create table area_prefab_items (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references project_areas(id) on delete cascade,
  prefab_catalog_id uuid not null references prefab_catalog(id) on delete restrict,
  finish text not null,
  quantity numeric not null default 1,
  cost_usd numeric not null,
  fx_rate numeric not null default 18,
  cost_mxn numeric not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on area_prefab_items (area_id);
create index on area_prefab_items (prefab_catalog_id);

insert into prefab_brand (name) values ('Venus'), ('Northville');
