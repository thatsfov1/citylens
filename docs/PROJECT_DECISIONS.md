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
- Categories: sport, culture, greenery, shopping, transport, education.
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
  Hexes below the minimum are greyed out and skipped by the first-match card; hexes with no data are never filtered out
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
  validated with Zod (`chat-schema.ts`). Max 4 follow-up questions; before returning importance it must have asked about (1) location, (2) category preferences, and (3) commute mode (public transport / bike / walk / car) when a workplace or study place was mentioned. The system prompt forbids naming
  places or claiming facts about Kraków.
- Retries, then falls back to a lighter model; if unavailable, the **manual controls still work**.
- The LLM never computes scores or explanations. Explanations come from stored indicators.

## 6. Scoring & UI conventions

- Preferences are an *importance* scale 0/25/50/75/100 per category (`src/lib/scoring/preferences.ts`),
  normalised to weights for the weighted sum. Defaults: sport 50, culture 10, greenery 70,
  shopping 20, transport 50. Preferences travel in the URL query string.
- Copy rule (AGENTS.md §3): "match for you", never "best/worst neighbourhood".
- Colours: 5 percentile bands (red → orange → yellow → light green → green, `src/lib/map/zones.ts`). Same-band neighbouring hexes are dissolved into one zone (`cellsToMultiPolygon`), so borders only appear where the band changes; the per-hex layer is an invisible hit target. In category modes a hex scoring 0 is grey "nothing nearby" (`NO_DATA_BAND`), not a weak match. Extras: hover tooltip, dimmed non-selected zones, , softened basemap. The map is veiled outside Kraków's boundary (airports stay visible).
- **Map view lock** (`src/components/map/hex-map.tsx`): the minimum zoom is the zoom at which the whole
  city fits beside the 380 px side panel (mobile: full width). At that view panning is disabled; zooming
  in enables panning, with the centre clamped to the city bbox (`KRAKOW_BOUNDS` in `src/lib/h3/mask.ts`).
  A "Center map" button appears once zoomed in by > 0.35 levels and flies back to the fit view.
  Do **not** use MapLibre `maxBounds` for this: it forces the bbox to cover the viewport and over-zooms.

### Landing page (Polish, chat-first)

- `/` is a centred Polish page (`src/components/landing/`): headline, five floating category icons, a chatbot panel, CTA „Pokaż moją mapę”. No nav bar; a dashed "logo" box is the logo placeholder.
- Each icon opens a panel with 5 levels = 20/40/60/80/100 % (hovering level N highlights 1..N). Confirming adds a chip to the chat panel; chips can be edited (click) or removed. The chat panel talks to the existing `POST /api/chat`; LLM importance (0/25/50/75/100) is mapped to levels with `importanceToLevel` (25→20 %, 50→60 %, 75→80 %).
- The CTA links to `/map?sport=…` with **unset categories = 0** so the map reflects only what was chosen. Levels stay compatible with the 0–100 query. Returning from the map (`/?sport=…`) prefills the chips.
- Background is a swappable layer (`background.tsx`, `videoSrc` prop + dark scrim) so a Kraków video can be added without layout changes. Animations are plain CSS (`globals.css`), disabled under `prefers-reduced-motion`. No new dependencies.
- **Landing look (serious, static):** the left half is Kraków's real boundary (`src/lib/h3/krakow-boundary.json`) as an SVG outline + `clip-path` with the looping city video inside (`krakow-shape.tsx`, `hero-stage.tsx`) and the wordmark; the right half has a plain `h1`, the chat and the CTA. Decorative motion (intro, hex canvas, cursor effects, scroll sections, minigame) was tried and **deliberately removed** — don't re-add without asking.
- `preferences-form.tsx` and `landing-map-preview.tsx` are no longer used by the landing page (kept in the repo).

### Polish UI (map side)

- The whole map UI is Polish: panels, explanations (`explain.ts`, `facts.ts`), rent/commute/share/works text, place kinds, `CATEGORY_LABELS` and band labels. `<html lang="pl">`.
- Plural forms and decimal commas come from `src/lib/format/pl.ts` (`plPlural`, `plCount`, `dec`). Category names are never inflected: sentences use „kategoria „zieleń”” style so no case endings are needed.
- In Polish copy "wynajem" = rent and "czynsz administracyjny" = the building fee (the English copy used "czynsz" for the fee).
- Unchanged on purpose: API error messages, the unused `preferences-form`/`preferences-chat`, and LLM prompts.

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

## Education category (kindergartens, schools, universities)

- **Sixth weighted category** `education` (`CATEGORIES`, map mode, LLM importance, landing icon 🎓, default importance 20) with four
  **life stages**: `kindergarten`, `primary`, `secondary`, `university` (`EDUCATION_STAGES` in `src/types`). A parent of a toddler and a
  student want different maps, so the user picks the stages that matter; the score counts only those.
- **Data (OSM only):** `amenity=kindergarten|childcare|school|university|college` in the `pois` Overpass query. OSM rarely tags school
  level, so `classifyPoi` decides by `isced:level` (lowest listed level wins), else by Polish name (`Przedszkole|Żłobek`, `Podstawowa`,
  `Liceum|Technikum|Branżowa|Zespół Szkół`), else the POI is kind `school` (**level unknown**) and counts for both primary and
  secondary rather than being guessed. `EDUCATION_KIND_STAGES` (osm.ts) maps kind → stages.
- **Scoring:** same machinery as other POI categories, one score per stage with its own reach (`EDUCATION_STAGE_SCALE`): kindergarten 1 km,
  primary 1 km, secondary 2 km, university 2 km (the same distance bands stretched, like culture). Each stage is normalised on its own;
  `hex_scores.education_score` = rounded mean of the four stage scores.
- **Why `hex_scores.education_stages jsonb`** (not inside `indicators`): the map list query deliberately omits `indicators`, and the client must
  recompute the education score for the selected stages on every hexagon. `educationScore` / `withEducationStages`
  (`src/lib/scoring/education.ts`, tested) do the mean of the selected stage scores; deterministic, no round-trip. Mock data has no stages
  and the stage filter is hidden then. `indicators.education` holds the facts (combined + per stage) for the panel; it is optional in the Zod
  schema because older rows lack it.
- **URL:** `?edu=kg,pr,se,un` (default: all, omitted). The landing page sets it only when the assistant returns stages (`ChatResult.stages`,
  Zod enum array or null; prompt: toddler → kindergarten, school-age children → primary/secondary, studying → university). The map's
  "Adjust preferences" link does not carry `edu` back yet.
- **Places/pins:** `PlaceCategory` includes `education`; `selectPlaces` caps **per kind** (5) and uses the stage's own reach
  (`placeReachM`), so a dense centre still shows the university next to many kindergartens. `nearest_pois()` was redefined (reach 2 km for
  education, ranked per kind) — keep it in sync with `placeReachM`. Pins are filtered client-side to the selected stages.
- **Copy rule:** "education access", never "good schools". The panel states the limits (`EDUCATION_CAVEAT`): counts of nearby places only —
  **not quality, free places, or the school catchment (rejon) of an address.** Out of scope: rankings, capacity, tuition, travel time.
- **Migration** `20261003000700_education.sql` adds `education_score` (not null default 0), `education_stages`, widens `pois.category`
  and redefines `nearest_pois`. **Apply it before deploying this code** (`loadHexes` selects the new columns; otherwise the app silently
  falls back to mock data). The real numbers need the full OSM extracts (`OSM_DIR=data/osm/full npx tsx scripts/osm/fetch.ts pois`, then
  `compute.ts` and `export-places.ts`); the committed sample `data/osm/pois.json` predates the education tags and has no schools.

## Area panel: overview + per-category detail
- The side panel (`area-panel.tsx`) has two views. **Overview:** match %, six clickable category bars, small chips for works / safety / air,
  "Why it matches you", "Things to consider". **Detail** (`PanelView` = a category, `safety`, `air` or `works`): one category's score, its
  data-backed fact, its places (`CategoryPlaces`, `places-list.tsx`) and, for education, the stage filter and caveat. "← Overview" goes back.
- Open detail state lives in `MapExperience` and is tied to the selected hexagon (resets on a new click). Pins follow the map mode / top
  weights by default; each overview bar has a dot that toggles that category's pins (multi-select; kept across hexagons, resets when the map mode changes).
  Opening a category detail adds its pins to the selection.
- The education stage filter and the safety filter sit at the top of the overview only (the stage filter is also inside the education detail).

## Caching of per-hexagon responses
- Client: `src/lib/map/hex-cache.ts` (`fetchCached`) keeps successful `/api/hexes/[h3]`, `/places` and `/works` responses in memory for the
  session, so clicking back to a hexagon makes no requests. Not persisted to web storage (reload clears it; failures are never cached).
- Server: those routes send `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` (works: 900 / 3600, since the snapshot is
  refreshed daily; a failed works load answers `no-store`). **After reseeding `hex_scores`, `pois` or `works`, browsers may serve the old
  copy for up to an hour** (a hard reload bypasses it).

## "Your first match" (map load)
- With real data (`source === "supabase"`, never the simulated demo scores) the map opens by selecting the top-scoring area, via the same fly-in
  as a click. `strongestAreas` (`src/lib/scoring/first-match.ts`) ranks the top 10% by personal score (the same share the map highlights),
  skips cells below the minimum safety level, and breaks ties by h3 index (deterministic). The ranking is fixed at that moment.
- `FirstMatchCard` (top of the side panel, overview only) shows score, district, the first `explainMatch` reason, one trade-off only if the data
  yields one, and one real contributing place (`topContributor`: nearest place of the highest-weighted category, or the largest park). It appears
  only once the area's indicators have loaded, so it never shows generic text. Copy: "one of the stronger matches", never "best".
- "Compare another area" walks the ranked list (wraps); dismissing the card (×) ends it. No side-by-side comparison yet.

## Preference sensitivity ("How stable is this match?")
- Overview-panel card (`sensitivity-section.tsx`) fed by `computeSensitivity` (`src/lib/scoring/sensitivity.ts`, tested). It nudges each category's
  importance ±25 (clamped, no-op nudges skipped), recomputes every hexagon's personal score and percentile band (same bands as the map colours) and
  reports whether the selected area changes band. Stable = same band under all nudges; otherwise it lists "if X matters more/less → <band>".
- Deterministic, client-side, from stored scores only (no LLM, no API). Ignores the safety filter, like the map colouring. Returns null when all importances are 0.

## Works time view ("What's changing nearby")
- The works detail view groups the existing sourced records with `groupWorks` (`src/lib/data/works.ts`, tested): **Under way now** (nearest first), **Planned**
  (earliest stated start first, undated last) and **Permit issued, no schedule** (one summary line). No cap, same deterministic wording, sources always shown.
- Information only: works never change a score and no impact on the match is implied (no defensible impact model). The overview chip counts under-way + planned.

## Compare areas
- "Add to comparison" in the area panel keeps up to 3 areas (`MAX_COMPARED`); `CompareTray` shows match % and the six category scores side by side, higher value per row in green
  (no leader on ties). Tap a column to open that area, × removes it. `compareAreas` (`src/lib/scoring/compare.ts`, tested) uses stored scores and the current weights only: deterministic, client-side,
  state lives in `MapExperience` and resets on reload (not in the URL yet). Copy: "a different fit, not a worse place".
- The comparison is its own floating window left of the side panel (stays open while browsing areas and detail views; stacked under the top bar on mobile).
- Row order and summary: rows are sorted by weight × spread between the areas (what actually decides the comparison), then by weight; zero-weight rows are dimmed. A one-line summary
  names the stronger match and the category adding most to its lead (weight × lead over the others' average), or says "about equally" when match scores are within 3 points. Deterministic, no LLM.

## Hexagon badges (safety, air, works, compare)
- The selected hexagon carries badges on its corners (MapLibre markers in `hex-map.tsx`, shown from zoom 12.5 so they don't overlap at city zoom): safety and air with their score, works with a count
  (only if > 0), and a +/✓ compare button. Native tooltips on hover. Safety, air and works open a floating info window (same `SafetySection` / `AirSection` / `WorksWarnings` content);
  the compare badge adds/removes the area (max 3). They replace the chip row and the "Add to comparison" button that used to be in the side panel.
- Areas in the comparison keep a dashed outline on the map (`hex-compared` layer) while another area is selected.
- Compared areas also keep their places on the map: `MapExperience` fetches `/api/hexes/[h3]/places` for each compared area (cached) and merges them with the selected area's before passing them to `HexMap`
  (deduped by place id / park). The side-panel place lists still show only the selected area.
- **Filters window:** the minimum safety level and the education stage filter moved out of the side panel (which stays a summary) into a "Filters" button + floating window at the top left
  (count of active filters on the button). The stage filter is still also inside the education category detail.


## "Near a place" (location anchor)

- The chat LLM may copy a place the user named (university, station, landmark…) into `nearPlace {query, radiusM}`
  (radius 500/1000/1500/2000 m). It never produces coordinates. `POST /api/chat` resolves the name from our own `pois`
  table (`src/lib/supabase/anchors.ts`, ranking in `src/lib/data/anchors.ts`) and returns `anchor {name, lat, lng, radiusM}`
  or `null` (unknown names are silently dropped).
- The anchor travels in the URL as `?near=lat,lng,radiusM,name`. On the map it is a **filter, not a score term**: hexes
  whose centre is beyond the radius are dimmed like the safety filter and left out of the first match
  (`src/lib/scoring/anchor.ts`, deterministic, client-side). Weights and stored scores are untouched.
- Streets/addresses: when `pois` has no match, `src/lib/data/nominatim.ts` does one bounded Nominatim lookup (Kraków
  box, 4 s timeout, best-effort: failure = no anchor). It returns a single point (the street's centre), so for a long
  street the radius is measured from its middle. The demo path (named POIs) stays offline-safe.
- Limits: a place missing from `pois` resolves only if Nominatim is reachable; the best match is picked automatically
  (exact name, then anchor-like kind), no disambiguation UI; no pin for the anchor on the map; "Adjust preferences"
  does not carry the anchor back to the landing page.


## Rent budget

- A **filter, not a score term** (like safety and "near a place"): the user sets a monthly rent range and a flat size
  (1 / 2 / 3+ rooms); the map fades toward grey where few of the district's offers fit, and those districts are left out of
  (the "Strongest areas" button was removed). Weights and stored scores are untouched. Logic and tests: `src/lib/scoring/rent.ts`,
  `src/lib/__tests__/rent.test.ts`. UI: `src/components/map/rent-filter.tsx` (Filters window; a rent card in the area panel).
- **Data:** `src/lib/data/rent-data.json` is a one-off snapshot of Otodom rental *asking prices* (about 1,600 listings,
  2026-10-03), built by `scripts/rent/build.ts` (45 result pages, 2 s apart, no per-listing requests; raw rows in
  `data/rent/listings.json`; `FETCH=0` re-aggregates only). Per district and flat size it keeps `n / p25 / median / p75`,
  the typical **czynsz** (`fee`) and every offer as `[base rent, czynsz | null]`. Buckets with fewer than 5 listings are
  left out (e.g. Wzgórza Krzesławickie has none). Asking prices run above signed rents.
- **Fit = share of a district's offers inside the range** (not the median: all 2-room medians lie between 2 400 and
  3 350, so the first version greyed nothing for ordinary budgets). The map overlay fades from full grey at 0% to none at
  50% (`FULL_SHARE`); below 20% (`OUT_SHARE`) a district counts as outside the budget (skipped for the first match and
  the first-match pick). A handle at the end of the slider (1 500 / 7 000+) means no limit on that side; the full range
  means no filter. Districts with no estimate are **unknown**: a light shade, never in or out.
- **Czynsz (building fee):** ads show the base rent; the czynsz administracyjny is a separate field (stated in about 94% of
  ads, median about 520 / 700 / 900 zł for 1 / 2 / 3+ rooms). The filter has a switch "Budget includes czynsz (estimated)",
  **on by default**: each offer costs base rent plus its czynsz, or the district's typical one when the ad does not state it.
  The UI warns that ads usually show base rent only and that utilities (media) are often extra again; the area card shows
  base + czynsz = about a month. Otodom filters on base rent, so the "See current offers" link lowers the price limits by
  the typical czynsz when the switch is on.
- **Granularity is the district** (`hex_scores.district`); hexes inherit it. No Supabase table: the file is bundled and the
  join happens client-side. The slider value is deferred (`useDeferredValue`) so dragging stays smooth.
- URL: `?rent=min-max&rooms=n` (omitted when the full range), plus `czynsz=0` when the switch is off. The chat LLM may copy a
  stated budget into `budget {min, max, rooms}`; `POST /api/chat` validates and snaps it (`budgetToFilter`, czynsz counted)
  and returns `rent`; the landing page appends it to the map URL. The model never suggests a budget.
- Source links: the area card and the filter link to Otodom.pl with the district, flat size and price range applied
  (`otodomUrl`, `otodomDistrictSlug`).
- Limits: asking prices per district, not per street; listing mix (new builds, furnished) is not controlled for;
  "Adjust preferences" does not carry the budget back to the landing page.

## Workplace & commute

- A **filter, not a score term** (like rent, safety and "near a place"): the user may mention where they work, how they travel
  (walk / bike / public transport / car) and a maximum commute in the landing chat. The model copies it into
  `workplace {query, mode, maxMin}` (null = not stated; defaults transit / 30 min) and `POST /api/chat` resolves the address and
  returns `work`. Hexes whose commute exceeds the limit are dimmed and left out of the first match;
  weights and stored scores are untouched. A strongly matching area can therefore be impractical without the score hiding it.
- URL: `?work=lat,lng,mode,maxMin,name` (`src/lib/scoring/commute.ts`, tested in `commute.test.ts`).
- Address -> coordinates: `resolveAnchor` in the chat route (own `pois`, then bounded Nominatim); unknown addresses are dropped.
- **Minutes come from data, never from the LLM.** `POST /api/commute {lat,lng,mode,cells}` -> `{ minutes, source }` via the OSRM
  *table* service on `routing.openstreetmap.de` (foot / bike / car, 100 cells per request, 8 s timeout; `src/lib/data/routing.ts`).
  **Public transport has no free routing**, so it (and any failed chunk) uses a deterministic estimate: straight line x detour
  / typical speed (+ wait). The map starts from that estimate and swaps in routed times when they arrive; the UI says
  "approximate estimate" unless every cell was routed.
- If **no** hex is within the limit, nothing is dimmed (empty map helps nobody); the top chip says so and shows the nearest option.
  The hex panel shows "~N min <mode> to <place>" and how far over/under the limit it is. We do not call an area "meeting
  expectations" without a user-set threshold.
- **Route line:** selecting a hex draws its path to the workplace (`POST /api/commute/route-line` -> OSRM `/route`; solid for
  walk/bike/car, a dashed straight line for public transport) and the panel then uses the routed minutes and km. Bulk routing only
  sends cells whose estimate is within 1.6x the limit (all ~2,800 at once timed out). Verified: parsers (unit tests) and the
  fallback path; the live server was unreachable at the end of the session, so routed output was only seen on a 3-point request.
- **Transit itinerary (selected area only):** `scripts/gtfs/build-timetable.ts [YYYYMMDD]` turns the official ZTP GTFS feeds into
  `data/gtfs/timetable.json` (~360 KB, committed: stops + patterns of weekday 06:30-10:30 departures; default date 20261006, pass
  a weekday inside the feed window to refresh). `src/lib/data/transit.ts` is a small RAPTOR-style planner (walk <=800 m to/from
  stops, <=250 m walking transfers, max 3 rides, 08:00 departure). `POST /api/commute/route-line` with mode `transit` returns
  `source: "gtfs"` plus `transit` (legs: line, headsign, board/alight stop and time, stops, minutes; door-to-door minutes
  without the wait for the first vehicle); the area panel lists the steps. No plan or no timetable falls back to the old
  estimate and dashed line. The map-wide commute filter still uses the estimate. Not real-time (no GTFS-RT), no rail
  (SKA/Koleje Malopolskie), dwell times ignored.
- Limits / not done: no minimum-suitability threshold input; no LLM explanation of the trade-off yet (if added, give it the
  computed candidates only: suitability, minutes, reasons); "Adjust preferences" does not
  carry the workplace back; the public routing server is best-effort and has no SLA.

## Sharing and saved maps

- **Everything is in the link, no backend.** On top of the filters that already live in the URL (weights, `minSafety`, `edu`,
  `near`, `rent` / `rooms` / `czynsz`) the map keeps `mode` (tab), `sel` (open area) and `cmp` (up to 3 compared areas) in the
  address bar (one `replaceState` effect in `map-experience.tsx`). Parse/build/validate: `src/lib/share/state.ts`
  (unknown tabs, invalid H3 ids, ids outside the loaded grid and a 4th `cmp` id are dropped, never an error); tests in
  `src/lib/__tests__/share.test.ts`. A link with `sel` skips the automatic "first match" jump.
- **Share button** (top-right of the map, `share-menu.tsx`): lists what the link reopens, Copy link (clipboard, with a
  select-the-text fallback), native Share on devices that have it, and "Save on this device". The copied link carries
  `shared=1`; the owner's own address bar does not.
- **Receiving:** `shared=1` shows a dismissible "Shared with you" banner (`shared-banner.tsx`) with Adjust preferences and
  Save a copy. Dismissing removes `shared` from the URL.
- **Saved maps** (`src/lib/share/saved.ts`): up to 10 named snapshots in `localStorage` (`krakow-saved-maps-v1`), each
  stored as the map's query string so it keeps working as parameters evolve. No accounts; if the browser blocks storage the
  UI says so. The landing page shows "Wróć do: <name>" for the latest one (`saved-map-link.tsx`).
- **Link preview:** `generateMetadata` in `src/app/map/page.tsx` describes the weights and rent budget in the link.
- Limits: saved maps live in one browser only; a long link (weights + near + compared areas) is a few hundred characters.
- **"Zmień preferencje" keeps the filters:** the map builds the landing link from its state (weights, `minSafety`, `edu`, rent, `car`, `near`, `work`;
  `preferencesHref` in `map-experience.tsx`) and `src/app/page.tsx` parses them into `Landing`'s `initialFilters`. A new chat answer replaces them
  (and clears `minSafety`, which the chat never sets). Compared areas, tab and open area are not carried back.


## Parking for renters with a car

- **Information only**: parking never enters the scores, never recolours or dims the map, and is for **renters** (no purchase,
  garage ownership or permit logic). It appears only when the user switches on **"I have a car"** (Filters window; `?car=1`;
  the landing chat can switch it on when the user says they drive: `hasCar`, which only copies the statement). With a workplace
  and no stated travel mode, a driver gets mode `car`.
- **Data is a committed snapshot, no runtime network call.** `scripts/parking/build.ts` fetches OpenStreetMap `amenity=parking`
  (Overpass, same mirrors as `scripts/osm/fetch.ts`) and the city GIS (MSIP) parking meters layer
  `Obserwatorium/K04_PARKOMETRY` (946 points, **state May 2019**), keeps the raw files in `data/parking/` and writes
  `src/lib/data/parking-data.json` (about 300 KB, loaded lazily the first time the switch is on). A failed fetch keeps the old raw
  file; `FETCH=0` rebuilds offline. Each source degrades on its own: a missing one shows "no data", never 0.
- **What the card says** (`src/components/map/parking-card.tsx`, logic in `src/lib/scoring/parking.ts`): publicly usable
  off-street car parks within 500 m / 1 km and the nearest; street parking (mapped as ~10,000 short segments, pooled per ~100 m
  cell and counted as segments, not spaces, with how many are tagged paid or free); parking meters within 500 m ("probably paid",
  dated); nearest park and ride. Private, customers-only and permit lots are counted separately and left out. Distances are
  straight lines from the hexagon centre. No tariffs: the MSIP has no paid-zone (SPP) polygons and rates change, so the card links to the
  official page (ZDMK, the former ZIKiT: `zdmk.krakow.pl/parkowanie/strefa-platnego-parkowania/...`).
- **Always shown with the card:** a "No guarantee" notice (free spaces, permits, hours and prices are not in the data; it may be
  out of date; check on site), the warning that a garage space or resident permit is usually an extra monthly cost (also in the
  rent note when the switch is on), and a Sources line with links and dates (OpenStreetMap contributors / ODbL, MSIP meters, ZDMK).
- Map: "P", "P+R" and meter pins around the open area (separate `parking-pins` source in `hex-map.tsx`, not part of the category pins),
  with a legend entry and the same caveat.
- Limits: OSM access/fee tags are incomplete (untagged lots count as public); street parking is not a space count; meters are from
  2019; no pin tooltips yet; refresh the snapshot by re-running the script.


## Map key and the Filters window

- **Map key:** the legend card has a "Map key" button that expands a list of what each symbol means. It is data
  (`src/lib/map/key.ts`, tested in `map-key.test.ts`) drawn by `map-key.tsx`, and only lists what is on the map now: places and
  green outlines when an area is open, **P / P+R / parking meter (the grey dot)** only with "I have a car", the hexagon badges
  (safety, air, works, compare), rings, compared outline, route and work marker. The "District borders" row is
  always listed because those toggles live inside `HexMap`. Parking pins show a tooltip (hover on desktop, tap on touch) with their
  name and the no-guarantee reminder; taps on pins do not select the hexagon under them. Pin colours and the caveat text are shared
  constants in `src/lib/scoring/parking.ts`.
- **Filters window** (`filters-window.tsx`, `filter-group.tsx`): one collapsible group per filter (Rent budget, Car and parking,
  Minimum safety level, Education stages) with the current value in the header; groups with a value set start open, otherwise the
  first one does. The window scrolls on short screens and has "Reset all" (rent range, safety, education stages; not the car switch).
  `SafetyFilter` / `StageFilter` moved out of `map-experience.tsx`.

## Source badges
- One registry, `src/lib/sources.ts`: every data source (OSM, GIOŚ, ZTP GTFS, MSIP, ZDMK, krakow.pl, Otodom, OSRM, Nominatim) with what it provides, kind, licence, URL and `asOf`. `SOURCES_BY_TOPIC` says which sources stand behind each category/air/safety/rent/parking/commute. `SourceBadge`/`SourceBadges` (`src/components/map/source-badge.tsx`, Base UI popover) show chip + date + licence/link in the area panel, rent filter and parking card; the map legend lists all sources.
- **`asOf` is only a date we stored.** `sources.test.ts` checks the registry against the data files (air `fetched`, GTFS `serviceDate`, rent `snapshot`). OSM has no recorded date yet -> badge says "data pobrania nieznana" until `data/osm/meta.json` exists. It now holds 2026-10-03, taken from the modification time of `data/osm/full/*.json`; `fetch.ts` overwrites it with the real date, then update `SOURCES.osm.asOf` (the test enforces they match). Air uses the live `indicators.air.asOf`.
- Works keep their per-item `SourceLink` (name + publication date + link) because their source/date is per record, not per dataset.

## Future-city timeline ("Plany miasta")
- **Informational only: the year never changes a score.** A bottom bar (`timeline-bar.tsx`, button "Plany miasta") offers *Dziś, 2027–2030* (`TIMELINE_YEARS`); URL `?rok=2028` (omitted for Dziś). It filters the official works / plans / permits on the map (`works-*` layers in `hex-map.tsx`) and in the area panel's works view.
- Logic is deterministic in `src/lib/data/works.ts`: `placeAtYear` / `placement` / `worksAtYear` -> `active` (stated dates cover the year; a start-only item counts in its start year only), `outside`, `unknown` (no dates, or started earlier with no stated end), `permit` (never placed on a year: the permit date is not the works date). `certainty()` labels each item: *termin ze źródła / termin orientacyjny / brak terminu w źródle / pozwolenie, brak harmonogramu*. Nothing is extended or guessed.
- **Map data is static, not a DB query:** `scripts/works/build.ts` also writes `src/lib/data/works-map.json` (same verified records as `supabase/seed-works.sql`, no evidence text); `GET /api/works` serves it (`works-map.ts`, zod). No migration was needed and the layer works without Supabase. Re-run the build after refreshing works data and commit both outputs.
- Known gaps shown in the bar: the list is incomplete (metro, the Mistrzejowice tram and the MSIP investments layer are not in the data).

## Removed: "Najmocniejsze obszary" button
- The map button that outlined the top 10% of cells (and its layer, `topZone`, legend entry) was **removed on request**. The separate first-match card (`strongestAreas` in `src/lib/scoring/first-match.ts`) stays.
- **Interactive (follow-up):** the bar has "Pokaż listę (N)" — every work for the selected year (active, "termin nieznany", permits collapsed by count), each row with status pill, timing text (`describeTiming`, no distance), certainty label and, when selected, the source link. Clicking a row highlights it on the map and frames it (`workBounds`, `workFocus` in `hex-map.tsx`); clicking a work on the map selects its row and wins over the hexagon under it. Titles/`whenLabel` of curated works are Polish (translated in `data/works/curated.json`; the evidence quotes and the gate are unchanged). After editing them reload `supabase/seed-works.sql`, the panel reads titles from the DB.
- Gotcha fixed: `HexMap` keeps the latest works layer in `worksRef` *before* the readiness check, otherwise data that arrives before the map is ready is lost; map fly-ins must set `flyingRef` or the view-lock `sync()` jumps back.


## 3D buildings

- A "3D" icon button in the legend's icon row (`map-experience.tsx`) toggles `HexMap`'s `tilt` prop: the camera eases to pitch 55° (centre/zoom kept) and a `fill-extrusion` layer (`buildings-3d`, OpenFreeMap `building` source-layer, `render_height` with an 8 m fallback, visible from zoom 14) is shown above the heat raster. Default is top-down 2D with the layer hidden. No new data or dependency.
