create table if not exists public.hex_scores (
  h3_index text primary key,
  sport_score smallint not null check (sport_score between 0 and 100),
  culture_score smallint not null check (culture_score between 0 and 100),
  greenery_score smallint not null check (greenery_score between 0 and 100),
  shopping_score smallint not null check (shopping_score between 0 and 100),
  transport_score smallint not null check (transport_score between 0 and 100)
);

alter table public.hex_scores enable row level security;

create policy "hex_scores are publicly readable"
  on public.hex_scores for select
  to anon, authenticated
  using (true);
