-- Education as a 6th category. `education_score` is the mean of four life-stage scores (kindergarten, primary,
-- secondary, university); the stage scores live in `education_stages` so the client can recompute the score for the
-- stages a user selected without a round-trip. Facts behind them are in indicators->'education'.
-- Apply BEFORE deploying code that selects these columns (loadHexes falls back to mock data otherwise).
alter table public.hex_scores add column if not exists education_score numeric not null default 0
  check (education_score >= 0 and education_score <= 100);
alter table public.hex_scores add column if not exists education_stages jsonb;
comment on column public.hex_scores.education_score is
  'Access to education (kindergartens, schools, universities from OSM), mean of the four stage scores, 0–100. Counts nearby places: not school quality, capacity or catchment.';
comment on column public.hex_scores.education_stages is
  'Per-stage access scores {kindergarten, primary, secondary, university}, 0–100.';

-- pois.category accepts 'education'.
alter table public.pois drop constraint if exists pois_category_check;
alter table public.pois add constraint pois_category_check
  check (category in ('sport','culture','shopping','transport','education'));

-- nearest_pois: education reach is 2 km (widest stage), like culture; ranked per kind so a dense centre
-- shows universities and kindergartens, not just the 10 nearest schools. Keep in sync with reachM in src/lib/data/places.ts.
create or replace function public.nearest_pois(p_lat double precision, p_lng double precision, p_per_group int default 10)
returns table (id bigint, category text, kind text, name text, lat double precision, lng double precision)
language sql stable
set search_path = public
as $$
  with d as (
    select p.id, p.category, p.kind, p.name, p.lat, p.lng,
           (p.category = 'transport' and p.kind = 'bus_stop') as is_bus,
           6371000 * 2 * asin(sqrt(
             power(sin(radians(p.lat - p_lat) / 2), 2) +
             cos(radians(p_lat)) * cos(radians(p.lat)) * power(sin(radians(p.lng - p_lng) / 2), 2)
           )) as dist_m
    from public.pois p
    where p.lat between p_lat - 0.019 and p_lat + 0.019
      and p.lng between p_lng - 0.03 and p_lng + 0.03
  ), ranked as (
    select d.*, row_number() over (partition by d.category, d.is_bus, case when d.category = 'education' then d.kind else '' end order by d.dist_m) as rn
    from d
    where d.dist_m <= case when d.category in ('culture', 'education') then 2000 else 1000 end
  )
  select r.id, r.category, r.kind, r.name, r.lat, r.lng
  from ranked r
  where r.rn <= p_per_group
  order by r.category, r.dist_m;
$$;
