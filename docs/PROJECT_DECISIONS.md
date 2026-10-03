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
- **Transport = OSM stops only** (bus, tram, rail stations/halts). GTFS is a possible later upgrade.
- **Attribution:** OSM © contributors, ODbL — in `readme.md`, the landing page and the map legend.

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
- Colours: 5 percentile bands (red → orange → yellow → light green → green, `src/lib/map/zones.ts`). Same-band neighbouring hexes are dissolved into one zone (`cellsToMultiPolygon`), so borders only appear where the band changes; the per-hex layer is an invisible hit target. The map is veiled outside Kraków's boundary (airports stay visible).
- **Map view lock** (`src/components/map/hex-map.tsx`): the minimum zoom is the zoom at which the whole
  city fits beside the 380 px side panel (mobile: full width). At that view panning is disabled; zooming
  in enables panning, with the centre clamped to the city bbox (`KRAKOW_BOUNDS` in `src/lib/h3/mask.ts`).
  A "Center map" button appears once zoomed in by > 0.35 levels and flies back to the fit view.
  Do **not** use MapLibre `maxBounds` for this: it forces the bbox to cover the viewport and over-zooms.

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
- Do not run `compute.ts` on the sample, and don't commit the full extracts.
- Next.js here has breaking changes vs older versions: read `node_modules/next/dist/docs/` before
  writing framework code (see `AGENTS.md`).

## 10. Not done yet (candidates)

- GTFS-based transport scoring (departures per stop).
- Future-city timeline / planned investments (P2, lower priority than a stable core).
- Rebuilding scores with better culture coverage or other data sources.
- Multiple cities, auth, saved preferences (P3).
