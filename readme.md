This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Running the project

Needs Node 20+ and npm.

```bash
git clone https://github.com/thatsfov1/winhackyeah.git && cd winhackyeah
npm install
cp .example.env .env.local     # then fill in the values below
npm run dev                    # http://localhost:3000
```

| Variable | What for | Without it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Hex scores, places and works from Supabase (read-only, publishable key) | The map falls back to deterministic mock data (no real scores, no area details) |
| `GEMINI_API_KEY` (optional `GEMINI_MODEL`) | The landing chat turns text into preference weights | The chat is unavailable; use the category icons, the map still works |

The Supabase values and the Gemini key come from the team (never commit them; `.env*` is gitignored).

Other commands: `npm test` (unit tests, no network), `npm run lint`, `npm run build && npm start` (production build).

What you see: `/` is the landing page (chat + category icons), **Pokaż moją mapę** opens `/map` with the hexagon map, filters, area panel, comparison and sharing.
The hidden chat word `isgudokei` shows the W Starej Kuchni lunch offer.

Live pieces and their fallbacks: `GET /api/air` reads GIOŚ live and falls back to the committed snapshot; routing for commute times uses a public OSRM server and falls back to an estimate.

### Rebuilding data (only when you change data, not needed to run the app)

The scores are precomputed and already loaded in Supabase; `docs/PROJECT_DECISIONS.md` has the details. Short version:
`scripts/osm/fetch.ts` then `scripts/osm/compute.ts` (needs `OSM_DIR=data/osm/full`), `scripts/gtfs/build.ts`, `scripts/air/build-air.ts` + `compute.ts`,
`scripts/health/*`, `scripts/rent/*`, `scripts/works/*`. Schema changes are in `supabase/migrations/` (apply in order); seeds are `supabase/*seed*.sql`.
Sanity-check the stored scores with `npx tsx scripts/sanity/report.ts`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Data & attribution

Points of interest, green areas and district boundaries come from
[OpenStreetMap](https://www.openstreetmap.org/copyright) — © OpenStreetMap contributors,
available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).

### OSM data pipeline

The demo never calls Overpass at runtime. Raw extracts are downloaded once, scored offline, and the
per-hex scores are stored in Supabase.

```bash
# 1. Download full extracts (gitignored, ~20 MB) from the Overpass API
OSM_DIR=data/osm/full npx tsx scripts/osm/fetch.ts [pois|green|districts]

# 2. Score every hex from the full data -> writes supabase/seed.sql
OSM_DIR=data/osm/full npx tsx scripts/osm/compute.ts

# 3. (Optional) refresh the small committed sample in data/osm/ used for dev/tests
npx tsx scripts/osm/sample.ts
```

`data/osm/*.json` is a small deterministic **sample** (not the whole city) so the pipeline can run
without the full download. Real scores must be computed from `data/osm/full/`.
