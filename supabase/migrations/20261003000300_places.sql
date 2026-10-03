-- Individual OSM places behind the scores, shown as pins when a hexagon is opened.
-- Filled from the same extracts as hex_scores (scripts/osm/export-places.ts).
create table if not exists public.pois (
  id        bigint generated always as identity primary key,
  category  text not null check (category in ('sport','culture','shopping','transport')),
  kind      text not null,
  name      text,
  lat       double precision not null,
  lng       double precision not null
);
create index if not exists pois_lat_lng_idx on public.pois (lat, lng);

create table if not exists public.green_areas (
  id       bigint generated always as identity primary key,
  name     text,
  area_ha  numeric not null,
  min_lat  double precision not null,
  max_lat  double precision not null,
  min_lng  double precision not null,
  max_lng  double precision not null,
  geometry jsonb not null -- GeoJSON (Multi)Polygon, simplified
);
create index if not exists green_areas_bbox_idx on public.green_areas (min_lat, max_lat);

alter table public.pois enable row level security;
alter table public.green_areas enable row level security;

drop policy if exists "pois are publicly readable" on public.pois;
create policy "pois are publicly readable" on public.pois for select to anon, authenticated using (true);
drop policy if exists "green_areas are publicly readable" on public.green_areas;
create policy "green_areas are publicly readable" on public.green_areas for select to anon, authenticated using (true);
