# Project decisions & current state

Shared context for every developer **and every AI coding agent** working on this repo.
Read this together with `AGENTS.md` (product rules, workflow). `AGENTS.md` says *what we want*;
this file records *what was actually decided and built*, and why. If the two disagree about
current behaviour, this file is newer — see "Known divergences" below.

Keep this file up to date: when you make a structural decision (data model, API shape, pipeline,
dependency), add a short entry in the same PR.

---

## 1. What exists today

```
User preferences (chat via LLM, or manual 0/25/50/75/100 importance per category)
        ↓
Weighted personal score  (deterministic, client side)   src/lib/scoring/
        ↓
Per-hex category scores (0–100)  ← Supabase table `hex_scores` (fallback: mock data)
        ↓
MapLibre map with H3 hexagons, area panel with data-backed explanations
```

- Kraków only. H3 resolution 8, ~460 cells (461), clipped to Kraków's administrative boundary
  (`src/lib/h3/grid.ts`, `krakow-boundary.json`).
- Categories: sport, culture, greenery, shopping, transport.
- Scores are **real**, derived from OpenStreetMap, and already loaded in Supabase.
  `supabase/seed.sql` contains the same 461 rows (verified identical to the live table).
- The LLM only converts text → importance values. It never scores or names places.

## 2. Database decisions (Supabase / Postgres / PostGIS)

- **One table, `public.hex_scores`**, one row per H3 cell. No user/auth tables (not needed).
- Columns: `h3_index text PK`, `geometry geometry(Polygon,4326)` (cell outline, GiST index),
  five `*_score numeric` columns with `CHECK (0..100)`, `district text` (OSM admin level 9
  containing the cell centre), `indicators jsonb` (the facts behind each score).
- **Why `indicators jsonb`:** explainability. Per category it stores the raw value, counts within
  500 m / 1 km, and the nearest feature (`kind`, `name`, `distanceM`); greenery stores cover share
  and nearest park (area in ha). The UI turns these into sentences
  (`src/lib/scoring/facts.ts`) — no LLM, no invented facts.
- **Why scores are stored, not computed per request:** expensive geometry is done offline once
  (AGENTS.md §19). Runtime only does the weighted sum.
- **Security:** RLS enabled, a single `select` policy for `anon, authenticated`. The app uses only
  the **publishable** key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Writes need an elevated
  credential (service role or Supabase MCP) — never put that key in client code or git.
- **Migrations** live in `supabase/migrations/` (apply in order):
  1. `…000000_hex_scores.sql` — table, PostGIS, GiST index, RLS + read policy
  2. `…000100_hex_scores_district_indicators.sql` — `district`, `indicators`
  3. `…000200_hex_scores_align_geometry.sql` — aligns a DB created from an earlier draft
     (smallint scores, no geometry); no-op on a fresh DB
- **Rebuilding the DB from the repo:** run the 3 migrations, then `supabase/seed.sql`
  (idempotent upsert on `h3_index`).
- `supabase/.temp/` is Supabase CLI state — do not commit it.

## 3. API boundary

- `GET /api/hexes` → `HexData[]` (`{ h3Index, scores, district? }`) — list columns only.
- `GET /api/hexes/[h3Index]` → district + `indicators` for one cell (area panel, loaded on click).
- `POST /api/chat` → LLM preference extraction (see §5). In-memory rate limit (30 / 10 min / IP).
- `/map` currently loads data **server-side** through `loadHexData()`
  (`src/lib/supabase/hex-scores.ts`) rather than through `/api/hexes`.
  Both paths share the same loader, so they return the same data.
- **Fallback:** `loadHexData()` validates rows with Zod and falls back to deterministic mock data
  (`src/lib/mock-data/`) if Supabase fails or is empty. The demo must never depend on a live
  external service (AGENTS.md §16).

## 4. Data pipeline (OpenStreetMap → hex scores)

Code: `scripts/osm/{fetch,compute,sample}.ts`, `src/lib/data/{osm,geo,score-hex}.ts`.

1. **Fetch** (`fetch.ts`): Overpass API, bbox with margin around Kraków, three queries — `pois`,
   `green`, `districts`. Mirrors are tried in turn, 120 s timeout per request.
2. **Compute** (`compute.ts`): for each H3 cell centre compute the five scores, write
   `supabase/seed.sql`.
3. **Sample** (`sample.ts`): writes a small deterministic subset to `data/osm/*.json`.

### Decisions & rules

- **Full extracts are NOT in git.** They are ~20 MB and live in `data/osm/full/` (gitignored).
  Regenerate with `OSM_DIR=data/osm/full npx tsx scripts/osm/fetch.ts`.
- **`data/osm/*.json` is only a ~750 KB sample** (600 POIs, 60 small green areas, 3 districts) for
  dev/tests. **Never compute real scores from the sample** — the map would be mostly empty.
  Real scores must come from `data/osm/full/` (`OSM_DIR=data/osm/full npx tsx scripts/osm/compute.ts`).
- The app never calls Overpass at runtime.
- **Overpass gotcha (fixed):** `out geom tags;` silently drops member geometry of *relations*
  (multipolygon forests/parks, district boundaries). Use `out geom;`. Before the fix ~238 large
  green areas were ignored and no hex had a district. `fetch.ts` also retries when a districts
  response has no geometry.
- **Distance weighting** (AGENTS.md §9): 0–250 m ×1, 250–500 m ×0.6, 500–1000 m ×0.25, beyond
  1 km ignored (culture: see below). Features outside the cell still count.
- **POI scoring:** sum of `feature weight × distance weight`. Feature weights by kind
  (`classifyPoi` in `osm.ts`), e.g. rail station 5, tram stop 2, bus stop 1; mall 4,
  supermarket 2, other shop 0.7 (vacant/disused shops excluded); sports centre/stadium 1.5, pitch 0.5;
  museum/theatre/cinema 1.5, library/gallery/historic 1, community centre 0.7.
- **Culture was expanded twice** because OSM has few classic culture venues. Tags: museum, gallery,
  theatre, cinema, arts centre, library, community centre, music venue, concert hall, nightclub,
  `tourism=attraction` (0.7) and `viewpoint` (0.5), plus `historic=castle|monument|manor|fort`.
  Places of worship and `tourism=artwork` are deliberately excluded (too numerous, would swamp the signal).
- **Culture reach is 2 km, other categories 1 km** (`CATEGORY_DISTANCE_SCALE` in `score-hex.ts`):
  the same bands stretched ×2 (0–500 m full, 500–1000 m ×0.6, 1–2 km ×0.25). `indicators.<cat>.radiusM`
  records the reach used. Result: hexes with culture score 0 dropped from 238/461 to 33/461.
- **Greenery is not a POI count:** `0.6 × cover share of the 500 m surroundings` (25 sample points
  tested against polygons) `+ 0.4 × proximity to the nearest ≥1 ha green area`.
- **Normalisation:** per category, `log1p(raw) / log1p(p95)` capped at 100, so a few dense hot
  spots don't flatten the rest of the city. Order of cells is preserved.
- **Transport = GTFS service frequency** (replaces OSM stop counts). `scripts/gtfs/build.ts` downloads the three
  official ZTP Kraków feeds (`GTFS_KRK_A` MPK buses, `GTFS_KRK_T` MPK trams, `GTFS_KRK_M` Mobilis suburban buses —
  M matters: without it outer districts like Nowa Huta lost whole bus lines), counts weekday departures per stop between
  06:00 and 22:00 on `SERVICE_DATE` (a normal Tuesday) and writes `data/gtfs/stops.json` (committed, ~0.5 MB; raw feeds in
  `data/gtfs/full/`, gitignored). Services running on that date come from `calendar_dates.txt` (weekday flags in
  `calendar.txt` are all 0). `compute.ts` turns each stop into a transport POI with weight `min(departures/h, 20) / 4`
  (4 departures/h ≈ the old bus-stop weight 1; cap so one hub can't dominate) and keeps only OSM **rail stations**
  (weight 5), since the city feeds have no trains. Without `data/gtfs/stops.json` it falls back to OSM stops.
  Indicators gain optional `departuresPerHourWithin500` and `nearest.departuresPerHour`; the UI sentence mentions
  "~N departures/h on weekdays". Result vs OSM-only: cells with transport 0 went 38 → 2; centre and tram corridors stay on top.
  Refresh when the timetable changes: `npx tsx scripts/gtfs/build.ts` (delete `data/gtfs/full/` first to re-download,
  and update `SERVICE_DATE` — the feeds only list a few weeks), then recompute the seed.
- **Safety is NOT a category.** It is an optional per-cell value (`hex_scores.safety_score`, nullable;
  `HexData.safety`; map mode `"safety"`), used as a **minimum-level filter** (`?minSafety=0|25|50|75`, control in the side
  panel) — good transport can't make up for feeling unsafe, so it never enters the weighted score or the LLM prompt.
  Hexes below the minimum are greyed out and skipped by "Strongest areas"; hexes with no data are never filtered out
  (unknown ≠ unsafe). The UI hides the mode and the control when no cell has safety data (e.g. mock fallback).
  Copy rule: "safety indicators", "below your minimum safety level" — never "dangerous".
- **Safety data actually used (public, OSM only; no crime data, no road/accident data).** Three scored indicators, each
  ranked as a percentile among built-up cells, weighted and renormalised (`SAFETY_WEIGHTS` in
  `src/lib/data/safety.ts`): **street lighting** 0.50 (share of tagged street segments that are lit within 700 m,
  `scripts/safety/build-lighting.ts` → `data/safety/lighting.json`), **CCTV** 0.25 (cameras mapped in OSM within 500 m)
  and **help nearby** 0.25 (distance to the nearest police 40% / fire station 30% / hospital or clinic 30% within 3 km).
  Camera, emergency and nightlife points come from `scripts/safety/build-features.ts` → `data/safety/features.json`
  (committed, ~30 KB: 30 police, 71 fire stations, 215 hospitals/clinics, 569 cameras, 304 nightlife venues; without it `compute.ts` scores lighting only). Overpass mirrors rate-limit (429/504); the
  script backs off and retries across mirrors. **Nightlife** (bars, pubs, clubs within 300 m) is shown in the panel as
  "After dark" context and is deliberately NOT scored: it cuts both ways (livelier streets vs. noise). Road safety
  (crossings, traffic calming, major roads, accidents) was dropped on purpose. Each indicator's own score and share
  are stored in `indicators.safety.parts`, so the side panel explains the result ("How is this measured?").
  Open land (no lighting data and no camera) has **no safety data** and is never filtered out.
- **Known limits (say them out loud):** these are *environment* proxies, not crime. They correlate with how built-up an
  area is, so ranking them per indicator matters. Lighting is optimistic (92% of tagged segments are lit: mappers rarely
  tag "unlit"); CCTV only counts cameras mapped in OSM (569, about the city's official 569).
  No official source for crime (partial press figures only) or road accidents (SEWiK is police-held; GPS missing in ~96%
  of cases in an NIK audit) or KMZB reports (no export) could be used.
- **Crime stats are wired in but NOT shipped.** `compute.ts` reads `data/safety/crime.json` (`CrimeFile`: police areas →
  district names, crimes, residents, source URL, year; normalised per 1,000 residents; weight 0.6 vs lighting 0.4)
  when the file exists. No machine-readable Kraków police dataset was found (only partial 2022 press figures for some
  precincts), and **KMZB has no public export** (the viewer's data service isn't documented). Do not enter numbers
  that you can't source; ask KMP Kraków / kmzb@policja.gov.pl for an export.
- **`loadHexDetails` must list every indicator field in `indicatorsSchema`** (src/lib/supabase/hex-scores.ts): Zod
  strips unknown keys, which silently dropped `radiusM` and the GTFS departure fields before this was fixed.
- **Attribution:** OSM © contributors, ODbL — in `readme.md`, the landing page and the map legend.

- **Air quality is NOT a category** (same pattern as safety). Optional per-cell `hex_scores.air_score` (nullable,
  0–100, higher = cleaner), `HexData.air`, map mode `"air"` (hidden when no cell has air data), a panel section with
  the facts and a caveat. It never enters the weighted score or the LLM prompt. Source: **GIOŚ** public API
  (`api.gios.gov.pl`, no key), built by `scripts/air/build-air.ts` into `data/air/stations.json` (committed, so the
  demo is offline). Only the last ~3 days of hourly values are served, so each station holds a **recent snapshot
  mean**, not an annual figure. Of Kraków's 9 stations only 6 report live PM (manual sensors return 400): PM10 at 5
  stations, PM2.5 at 2. **PM10 drives the score** (city-wide comparable); PM2.5 is shown where interpolated.
  `src/lib/data/air.ts`: inverse-distance² interpolation within `AIR_REACH_M` = 6 km (beyond it: no data, never
  "clean"); score is linear PM10 15 → 100 … 100 µg/m³ → 0. Map colours are percentile bands, like safety. Run
  `npx tsx scripts/air/compute.ts` to generate `supabase/air_seed.sql` (updates existing rows only; does not need the
  full OSM extracts); `scripts/osm/compute.ts` also writes air when `data/air/stations.json` exists.
  **Deploy order matters:** `loadHexes` selects `air_score`, so apply migration `20261003000600_air_score.sql`
  *before* deploying this code, otherwise the query fails and the app silently falls back to mock data.
  Refresh: `npx tsx scripts/air/build-air.ts`, then `scripts/air/compute.ts`. Copy: "air-quality indicators",
  "estimated between stations" — never "polluted area". Attribution: GIOŚ in the legend and panel caveat.

## 5. LLM (Gemini) decisions

- Server-only (`src/lib/llm/gemini.ts`, `GEMINI_API_KEY`, optional `GEMINI_MODEL`). Key never
  reaches the client.
- Narrow job: conversation → importance per category, each one of **0/25/50/75/100**,
  validated with Zod (`chat-schema.ts`). Max 3 follow-up questions. The system prompt forbids naming
  places or claiming facts about Kraków.
- Retries, then falls back to a lighter model; if unavailable, the **manual controls still work**.
- The LLM never computes scores or explanations. Explanations come from stored indicators.

## 6. Scoring & UI conventions

- Preferences are an *importance* scale 0/25/50/75/100 per category (`src/lib/scoring/preferences.ts`),
  normalised to weights for the weighted sum. Defaults: sport 50, culture 10, greenery 70,
  shopping 20, transport 50. Preferences travel in the URL query string.
- Copy rule (AGENTS.md §3): "match for you", never "best/worst neighbourhood".
- Colours: 5 percentile bands (red → orange → yellow → light green → green, `src/lib/map/zones.ts`). Same-band neighbouring hexes are dissolved into one zone (`cellsToMultiPolygon`), so borders only appear where the band changes; the per-hex layer is an invisible hit target. In category modes a hex scoring 0 is grey "nothing nearby" (`NO_DATA_BAND`), not a weak match. Extras: hover tooltip, dimmed non-selected zones, "Strongest areas" toggle (top 10% outline), softened basemap. The map is veiled outside Kraków's boundary (airports stay visible).
- **Map view lock** (`src/components/map/hex-map.tsx`): the minimum zoom is the zoom at which the whole
  city fits beside the 380 px side panel (mobile: full width). At that view panning is disabled; zooming
  in enables panning, with the centre clamped to the city bbox (`KRAKOW_BOUNDS` in `src/lib/h3/mask.ts`).
  A "Center map" button appears once zoomed in by > 0.35 levels and flies back to the fit view.
  Do **not** use MapLibre `maxBounds` for this: it forces the bbox to cover the viewport and over-zooms.

### Hexagon drill-down: places on the map

- Clicking a hex flies the camera in (zoom ≥ 14.2, padded for the side panel), draws dashed 500 m / 1 km
  rings and pins the real OSM places behind the scores; deselecting flies back. The full-city map has no icons.
- **Tables `pois` and `green_areas`** (migration `…000300_places.sql`, RLS read-only like `hex_scores`).
  `pois` = one row per classified OSM point (category, kind, name, lat, lng). `green_areas` = park/forest
  outlines ≥ 0.5 ha as simplified GeoJSON + bbox columns. Filled by `scripts/osm/export-places.ts`
  → `supabase/seed-places.sql` (run it with `OSM_DIR=data/osm/full`; the committed seed is built from the
  small sample and is only good for development).
- `GET /api/hexes/[h3Index]/places` → `PlacesResponse` (`src/types`). Selection logic is `selectPlaces`
  in `src/lib/data/places.ts`: within each category's reach (culture 2 km, others 1 km), nearest 10 per
  category; transport = up to 8 rail/tram + 6 bus stops. Failure ⇒ the panel just stays text-only.
- Pins: default categories = active map mode, or the two top-weighted in "For You"; chips in the panel toggle
  the rest. Greenery is shown as park outlines, not points. Pins are MapLibre symbol layers; per-kind badge icons are generated at runtime (src/lib/map/place-icons.ts), no static sprites.
- **Camera gotcha:** the view-lock in `sync()` (see "Map view lock") calls `jumpTo()` while the map is at the
  minimum zoom, which cancels any running `flyTo`. `hex-map.tsx` therefore sets `flyingRef` before our own
  `flyTo` and `sync()` skips the lock/clamp until `moveend`. Any new programmatic camera move from the
  fit-to-city view needs the same flag.
- **Why a new table instead of more `indicators`:** pins need every place's coordinates; storing them in
  `hex_scores.indicators` would duplicate the same POI across neighbouring hexes. Selection (reach, caps)
  happens at request time in `selectPlaces`, so the caps can change without recomputing anything.
- **Full-city places are loaded** (15,234 places, 2,490 green areas; transport pins = the same GTFS stops + OSM rail
  stations as the scores, via `combineTransport`). The full extracts live only on the backend dev's machine, so that
  person regenerates and loads them: `OSM_DIR=data/osm/full OUT_FILE=<somewhere outside git> npx tsx scripts/osm/export-places.ts`
  (≈4 MB; do not commit). The Supabase Management API rejects one 4 MB request (HTTP 413): split the file at statement
  boundaries into ≈1 MB parts and run them in order (first part holds the `truncate`). `supabase/seed-places.sql` in git
  stays the small dev sample.
- **`nearest_pois()` (migration `…000400`)**: `loadPlaces` no longer selects by bounding box. The API caps responses
  at 1000 rows, and in the dense centre a 2 km box holds thousands of places, so the "nearest 10" came out wrong (only
  one category showed). The SQL function ranks by distance per category (rail/tram separate from buses) and
  `selectPlaces` still makes the final selection. Constants (reach 2 km culture / 1 km others) are duplicated in the
  SQL — keep them in sync with `reachM` in `src/lib/data/places.ts`.

## 7. Code layout & ownership

| Area | Paths | Owner |
|---|---|---|
| Data / backend | `supabase/`, `scripts/`, `src/app/api/`, `src/lib/supabase/`, `src/lib/data/`, `src/lib/llm/` | backend dev |
| Frontend | `src/app/` pages, `src/components/`, `src/lib/map` & `h3` rendering | frontend dev |
| Shared contract | `src/types/index.ts` | **coordinate before changing** |

## 8. Git workflow (as currently practised)

- One branch per task (`feature/<name>`). Backend dev works from `zenszen`, merges back into it,
  and merges/pushes to `main` only when explicitly asked. Keep `zenszen` in sync with `main`.
- Commit messages: `feat:`, `fix:`, `docs:` …. Run `npm run build`, `npm run lint`, `npm test` after merges.
- Local files like `.env.local` are gitignored; `.mcp.json` (Supabase MCP) is committed.

## 9. Known divergences / gotchas

- `AGENTS.md` §27 shows a flat `HexScore { h3, sport, … }` contract. The code uses
  `HexData { h3Index, scores: { … }, district? }`. **The code is authoritative**; keep them aligned
  deliberately and tell the other developer before changing either.
- `/map` reads Supabase directly on the server instead of via `/api/hexes` (see §3).
- Culture is still the weakest category (OSM coverage); it is now much denser after the tag and radius expansion.
- `supabase/seed.sql` in the repo can be newer than the live Supabase table: after recomputing, the table must be reloaded by someone with write access.
- The live `pois`/`green_areas` tables currently hold only a tiny hand-made demo slice (28 POIs, one made-up park outline) — reload with the full `seed-places.sql`.
- Do not run `compute.ts` on the sample, and don't commit the full extracts.
- Next.js here has breaking changes vs older versions: read `node_modules/next/dist/docs/` before
  writing framework code (see `AGENTS.md`).

## 10. Not done yet (candidates)

- GTFS extras: weekend/night service, stop-to-stop travel time (e.g. to the centre), rail timetables (SKA/Koleje Małopolskie).
- Future-city **timeline** (a year slider / projected scores). Works *warnings* exist (see "Construction & planned works"); projections do not.
- Safety: real crime statistics (`data/safety/crime.json`) and KMZB reports; more lighting coverage on the outskirts.
- Rebuilding scores with better culture coverage or other data sources.
- Multiple cities, auth, saved preferences (P3).

## District overlay

- District borders and names are drawn by us from `hex_scores.district` (`districtLayers` in `src/lib/map/zones.ts`): a dissolved, hex-aligned outline per district plus a bold, haloed label above the colour zones. Basemap `place` labels are hidden so they no longer clash with the hexagons. Hexes without a district get no border/label.

## Gradient heatmap

- The map colouring is a smooth raster, not banded zones: `heatPixels` (`src/lib/map/heat-field.ts`) blends each hex's percentile with its neighbours (Gaussian, σ 0.4 km), maps it through the red→green ramp and clips it to the Kraków outline; shown as a MapLibre `image` source (`heat-raster`). No-data hexes stay grey and are not blended into coloured neighbours. Hexes remain the interaction unit (invisible `hex-fill` hit target, tooltips, selection). `bandOf`/`BAND_LABELS` are still used for labels.

## Construction & planned works (warnings in the hexagon panel)

Clicking a hexagon shows a "Construction nearby" block: ongoing and planned works within 1 km, each with its official
source link, e.g. "~400 m away · planned in about 3 months (track works planned for early 2027)". Information only: it never
changes a score.

- **Table `works`** (migration `…000600_works.sql`, RLS read-only) + SQL function `works_near(lat, lng, radius_m)`
  (PostGIS distance to the closest part of the geometry). `GET /api/hexes/[h3Index]/works` → `{ works: WorkNearby[] }`
  (`src/types`); failure ⇒ `[]`, the block simply doesn't appear. Loader: `loadWorks` in `src/lib/supabase/hex-scores.ts`.
- **The wording is deterministic** (`src/lib/data/works.ts`, tested): "in about N months/years", "lasting about …" are plain
  arithmetic on stored dates; a duration or end date is **never invented** (no end date ⇒ "end date not stated by the source").
  **The LLM writes nothing the user sees** and decides no dates (AGENTS.md §10, §15).
- **Sources, all official, each row stores `source_name` + `source_url`:**
  1. **Curated works** (`data/works/curated.json`, 12 records): taken from the ZDMK works list
     (`zdmk.krakow.pl/zestawienie-prac-w-miescie/`, ongoing + upcoming), ZDMK project pages (Starowiślna) and krakow.pl
     announcements (Azory tram, Domagały). Vague timing is kept as a reviewed `whenLabel` ("around mid-2027"); a 2024 statement
     is labelled as such.
  2. **MSIP permits** (`scripts/works/fetch-msip.ts` → `data/works/msip-permits.json`): tree-removal decisions *marked as
     investment-related* (`03/04 … INWESTYCJA`) from the city GIS, last 12 months, 88 decisions. Status `decision`: they mean an
     investment is being prepared, **no schedule is published**, so the panel summarises them in one line, never as dated works.
- **"No mistakes" gate (`scripts/works/build.ts`, `src/lib/data/works-verify.ts`, tested):** a curated record is loaded only if
  `reviewed` is true, every `evidence` quote appears **verbatim** in the saved official page (`data/works/snapshots/*.txt`, made by
  `scripts/works/snapshot.ts`), each stated date (day + month, year when quoted) is in the quotes, and every location resolves
  inside Kraków (city geocoder `epl/Lokalizator_Krakow`, or an official ZTP stop by name from `data/gtfs/stops.json`; cached in
  `data/works/geocode-cache.json`). Any failure aborts the build. Linear projects are the straight line between two geocoded points,
  and titles say "approximate" where the route is not exact (Azory, Domagały).
- **How the curated records were produced:** read from the saved official pages by an LLM-assisted human review (there was no
  Gemini key on the machine), then passed through the gate above. Automating it with Gemini is possible (same Zod + verbatim-quote
  gate) but not needed for the demo.
- **Refresh:** `npx tsx scripts/works/snapshot.ts && npx tsx scripts/works/fetch-msip.ts && npx tsx scripts/works/build.ts`, then load
  `supabase/seed-works.sql` (it truncates `works` first; `supabase db query --linked --project-ref <ref> -f supabase/seed-works.sql`).
  The ZDMK list changes daily and the snapshot is dated; the panel shows "Source: …, <date>".
- **Not used / known gaps:** the city investments map "Kraków w dobrym kierunku" (layer `SI_INWESTYCJE_BUDZET_PKT` on
  `msip3.um.krakow.pl`) has the best planned-works fields (`data_od`, `data_do`, `status`, `budzet`) but its REST endpoint answers
  HTTP 404 to scripts; ask msip@um.krakow.pl for an export. S7 expressway layers are route *variants*, not decisions: excluded.
  Metro (construction tender planned ≈2030) and tram to Mistrzejowice are not included (no reliable geometry/dates yet).
  OSM `highway=construction` and ZTP GTFS-RT ServiceAlerts (`gtfs.ztp.krakow.pl/ServiceAlerts_*.pb`, free-text diversions) are possible
  additions. Permits only count within the last 12 months. Open-ended "ongoing" rows stay visible until the snapshot is refreshed.
