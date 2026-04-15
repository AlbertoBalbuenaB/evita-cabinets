-- Evita Draft Tool — Phase 1 Schema
-- Adds draft_* columns to products_catalog and creates the 4 drawing tables
-- (drawings, drawing_areas, drawing_elevations, drawing_elements).
-- Also forward-compat: adds nullable source_drawing_element_id to area_*
-- tables so Phase 3's mapping layer can tag generated rows without another
-- migration.
--
-- Non-destructive. Idempotent via IF NOT EXISTS. No FK on source_drawing_*
-- columns (we want SET NULL semantics later and don't want to couple the
-- quotation engine to drawing deletes).

-- ─── 1. products_catalog: draft_* columns ───────────────────────────────────

alter table public.products_catalog
  add column if not exists draft_family text,
  add column if not exists draft_subfamily text,
  add column if not exists draft_series text,
  add column if not exists draft_default_hinge text,
  add column if not exists draft_plan_svg text,
  add column if not exists draft_elevation_svg text,
  add column if not exists draft_detail_svg text,
  add column if not exists draft_enabled boolean not null default false;

create index if not exists idx_products_catalog_draft_family
  on public.products_catalog(draft_family) where draft_enabled = true;
create index if not exists idx_products_catalog_draft_series
  on public.products_catalog(draft_series) where draft_enabled = true;

-- ─── 2. Drawing tables ──────────────────────────────────────────────────────

create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.quotations(id) on delete cascade,
  name text not null,
  version text default 'V1.0',
  paper_size text default 'letter',
  export_language text default 'en' check (export_language in ('en','es')),
  lock_tags boolean not null default false,
  show_position_tags boolean not null default true,
  specs jsonb not null default '{}'::jsonb,
  created_by uuid references public.team_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_drawings_project_id on public.drawings(project_id);

create table if not exists public.drawing_areas (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references public.drawings(id) on delete cascade,
  name text not null,
  prefix text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_drawing_areas_drawing_id on public.drawing_areas(drawing_id);

create table if not exists public.drawing_elevations (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.drawing_areas(id) on delete cascade,
  letter text not null,
  wall_angle_deg numeric,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_drawing_elevations_area_id on public.drawing_elevations(area_id);

create table if not exists public.drawing_elements (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references public.drawings(id) on delete cascade,
  area_id uuid references public.drawing_areas(id) on delete cascade,
  elevation_id uuid references public.drawing_elevations(id) on delete set null,
  view_type text not null check (view_type in ('plan','elevation','detail')),
  element_type text not null check (element_type in ('wall','cabinet','custom_piece','countertop','dimension','note','keyplan_arrow')),
  product_id uuid references public.products_catalog(id) on delete set null,
  tag text,
  x_mm numeric not null,
  y_mm numeric not null,
  rotation_deg numeric not null default 0,
  width_mm numeric,
  height_mm numeric,
  depth_mm numeric,
  props jsonb not null default '{}'::jsonb,
  z_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_drawing_elements_drawing_id on public.drawing_elements(drawing_id);
create index if not exists idx_drawing_elements_area_view on public.drawing_elements(area_id, view_type);
create index if not exists idx_drawing_elements_element_type on public.drawing_elements(element_type);

-- ─── 3. Phase 3 forward-compat: source_drawing_element_id ───────────────────

alter table public.area_cabinets
  add column if not exists source_drawing_element_id uuid;
alter table public.area_items
  add column if not exists source_drawing_element_id uuid;
alter table public.area_countertops
  add column if not exists source_drawing_element_id uuid;

create index if not exists idx_area_cabinets_source_drawing
  on public.area_cabinets(source_drawing_element_id)
  where source_drawing_element_id is not null;
create index if not exists idx_area_items_source_drawing
  on public.area_items(source_drawing_element_id)
  where source_drawing_element_id is not null;
create index if not exists idx_area_countertops_source_drawing
  on public.area_countertops(source_drawing_element_id)
  where source_drawing_element_id is not null;

-- ─── 4. RLS (authenticated-users-full-access pattern) ──────────────────────

alter table public.drawings enable row level security;
alter table public.drawing_areas enable row level security;
alter table public.drawing_elevations enable row level security;
alter table public.drawing_elements enable row level security;

create policy "Authenticated users full access on drawings"
  on public.drawings for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "Authenticated users full access on drawing_areas"
  on public.drawing_areas for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "Authenticated users full access on drawing_elevations"
  on public.drawing_elevations for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "Authenticated users full access on drawing_elements"
  on public.drawing_elements for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
