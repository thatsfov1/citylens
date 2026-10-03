-- Nearest places around a point, picked in the database. A plain bbox select is capped at 1000 rows by the
-- API, which in the dense centre drops most places. Reach mirrors src/lib/data/places.ts (culture 2 km, others 1 km);
-- groups keep rail/tram separate from buses like selectPlaces does. selectPlaces() still makes the final selection.
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
    select d.*, row_number() over (partition by d.category, d.is_bus order by d.dist_m) as rn
    from d
    where d.dist_m <= case when d.category = 'culture' then 2000 else 1000 end
  )
  select r.id, r.category, r.kind, r.name, r.lat, r.lng
  from ranked r
  where r.rn <= p_per_group
  order by r.category, r.dist_m;
$$;
