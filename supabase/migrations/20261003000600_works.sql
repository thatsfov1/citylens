-- Construction / renovation works (ongoing, planned) and investment-related permits, shown as warnings
-- in the hexagon panel. Every row cites its official source (source_name + source_url); dates are only
-- stored when the source states them. Filled by scripts/works/build.ts -> supabase/seed-works.sql.
create table if not exists public.works (
  id            bigint generated always as identity primary key,
  ext_id        text not null unique,                 -- stable id from the curated file / source layer
  title         text not null,
  kind          text not null check (kind in ('road','tram','rail','building','green','utility','other')),
  status        text not null check (status in ('ongoing','planned','decision')),
  date_from     date,
  date_to       date,
  when_label    text,                                  -- reviewed English wording for vague timing ("around mid-2027")
  source        text not null check (source in ('zdmk','krakow_pl','zim','msip','osm')),
  source_name   text not null,
  source_url    text not null,
  published_at  date,                                  -- when the source page/record was published or issued
  evidence      text,                                  -- verbatim quote from the source backing the dates
  geometry      geometry(Geometry, 4326) not null
);
create index if not exists works_geometry_idx on public.works using gist (geometry);

alter table public.works enable row level security;
drop policy if exists "works are publicly readable" on public.works;
create policy "works are publicly readable" on public.works for select to anon, authenticated using (true);

-- Works within p_radius_m of a point, nearest first. Distance is to the closest part of the geometry.
create or replace function public.works_near(p_lat double precision, p_lng double precision, p_radius_m double precision default 1000)
returns table (
  id bigint, title text, kind text, status text, date_from date, date_to date, when_label text,
  source_name text, source_url text, published_at date, distance_m double precision
)
language sql stable
set search_path = public, extensions
as $$
  with pt as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g)
  select w.id, w.title, w.kind, w.status, w.date_from, w.date_to, w.when_label,
         w.source_name, w.source_url, w.published_at,
         st_distance(w.geometry::geography, pt.g) as distance_m
  from public.works w, pt
  where st_dwithin(w.geometry::geography, pt.g, p_radius_m)
  order by distance_m;
$$;
