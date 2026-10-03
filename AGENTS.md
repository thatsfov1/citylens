<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Branching

Always use new branch for each feature

# Smart City Hackathon — Project Context

## 1. Project Overview

This project is being built for the **HackYeah Smart City hackathon**.

The application helps people understand **which areas of a city best match their lifestyle, needs, and preferences**.

Instead of presenting generic neighborhood rankings, the application generates a **personalized spatial suitability map**.

The initial supported city is:

- Kraków, Poland

The product should be designed so that additional cities could be supported later, but **multi-city support is NOT part of the current MVP**.

This is a hackathon project with a very limited implementation timeframe.

Prioritize:

1. working end-to-end functionality,
2. polished UX,
3. clear demo value,
4. explainability,
5. simplicity.

Avoid unnecessary abstractions and overengineering.

---

# 2. Core Product Idea

A user describes what they expect from the area in which they would like to live or spend time.

Example:

> "I want a lot of greenery, good public transport and places where I can run. I don't care much about shopping or culture."

The application converts those preferences into weights for predefined categories.

Current categories:

- Sport
- Culture
- Greenery
- Shopping
- Transport

Example:

```json
{
  "sport": 0.25,
  "culture": 0.05,
  "greenery": 0.35,
  "shopping": 0.1,
  "transport": 0.25
}
```

The city is divided into **H3 hexagons**.

Each hexagon has an independently calculated score for every category.

Example:

```json
{
  "h3Index": "891e2e...",
  "sport": 82,
  "culture": 43,
  "greenery": 91,
  "shopping": 67,
  "transport": 88
}
```

The personalized score is calculated deterministically from:

```text
personalScore =
    sportScore * sportWeight +
    cultureScore * cultureWeight +
    greeneryScore * greeneryWeight +
    shoppingScore * shoppingWeight +
    transportScore * transportWeight
```

The LLM MUST NOT decide which neighborhood is best.

The LLM is used only to interpret natural-language preferences into structured category weights.

Actual geographic scoring must be based on data.

---

# 3. Product Philosophy

The product does NOT answer:

> "What is the best neighborhood in Kraków?"

It answers:

> "Which areas of Kraków best match YOUR stated preferences?"

A low score does NOT mean that an area is objectively bad.

It means that the area is a weaker match for the current user's preferences.

All UI copy and explanations should preserve this distinction.

Prefer wording such as:

- "Match for you"
- "Matches your preferences"
- "Strong match"
- "Weak match"

Avoid wording such as:

- "Bad neighborhood"
- "Worst neighborhood"
- "Best neighborhood in Kraków"

---

# 4. Core MVP User Flow

The primary user flow should be extremely short.

## Step 1 — Landing

User enters the application.

The value proposition should immediately communicate something similar to:

> Find where the city fits you.

or:

> Discover which parts of Kraków match your lifestyle.

The user should be able to continue immediately.

No authentication is required.

---

## Step 2 — Preferences

The user describes their preferences in natural language.

Example:

> "I like running, parks and quiet areas. Public transport is very important to me. I don't care much about shopping."

The application should also support manual preference configuration.

Manual controls are important because the core product must continue working even if the LLM API is unavailable.

Categories:

- Sport
- Culture
- Greenery
- Shopping
- Transport

---

## Step 3 — Preference Interpretation

The LLM converts natural language into structured weights.

The result should be validated using Zod.

Example:

```json
{
  "sport": 0.25,
  "culture": 0.05,
  "greenery": 0.35,
  "shopping": 0.1,
  "transport": 0.25
}
```

Weights should sum approximately to `1`.

The user should be shown how their preferences were interpreted.

Example UI:

```text
We understood:

Greenery       35%
Sport          25%
Transport      25%
Shopping       10%
Culture         5%

[Adjust] [Show my map]
```

The user must be able to modify these values manually.

---

# 5. Main Map

The map is the core interface of the application.

Use:

- MapLibre GL JS
- H3 hexagonal spatial indexing

The map should display Kraków covered with hexagons.

Hexagon color/intensity represents the currently selected score.

Main modes:

```text
For You
Sport
Culture
Greenery
Shopping
Transport
```

### For You

Displays the personalized weighted score.

### Category modes

Display the raw score for the selected category.

Example:

Selecting:

```text
Greenery
```

should recolor the entire map according to the greenery score.

Selecting:

```text
Transport
```

should recolor it according to the transport score.

The transition should feel immediate.

This interaction is one of the primary visual elements of the demo.

---

# 6. Hexagon Details

Clicking a hexagon should open a side panel, drawer, or bottom sheet.

Example:

```text
Area match

87%

Greenery       92
Transport      89
Sport          81
Culture        72
Shopping       68
```

The interface should explain WHY the area received its score.

Example:

```text
Why it matches you

✓ High access to green areas
✓ Strong public transport availability
✓ Multiple sport facilities nearby

Things to consider

• Shopping availability is below your preference
```

Explanations should ultimately be derived from real underlying data.

Do not invent facts through the LLM.

---

# 7. Explainability

Explainability is a core product requirement.

Every score should eventually be traceable to its components.

The application should conceptually support:

```text
Personal score
      ↓
Category scores
      ↓
Individual indicators
      ↓
Source geographic data
```

Example:

```text
Greenery: 87

because:

42% green area nearby
large park within 350 m
3 smaller green spaces within 1 km
```

Do not create opaque AI-generated neighborhood scores.

---

# 8. Data Sources

The intended primary data source for current city infrastructure is:

## OpenStreetMap

OSM should provide most Points of Interest and geographic features.

Examples:

### Sport

Potential OSM tags include:

```text
leisure=sports_centre
leisure=fitness_centre
leisure=pitch
leisure=swimming_pool
leisure=stadium
sport=*
```

### Culture

Potential data includes:

```text
tourism=museum
amenity=theatre
amenity=cinema
amenity=arts_centre
amenity=library
```

### Greenery

Potential data includes:

```text
leisure=park
leisure=garden
landuse=forest
natural=wood
nature_reserve
```

Greenery should NOT be scored only by counting POIs.

Polygon area and proximity to green spaces should eventually be considered.

### Shopping

Potential data includes:

```text
shop=*
shop=supermarket
shop=convenience
shop=mall
```

### Transport

OSM may provide stop locations.

Transport quality may later be enhanced with Kraków public transport / GTFS data.

---

# 9. Geographic Scoring

Avoid scoring based only on features physically located inside an H3 cell.

A feature located 20 meters outside the cell boundary is still relevant to the user.

Scores should conceptually consider the surrounding area.

Example distance weighting:

```text
0–250 m       high relevance
250–500 m     medium relevance
500–1000 m    lower relevance
>1000 m       usually ignored
```

Exact formulas are not finalized.

During early MVP development, deterministic mock scores are acceptable.

The architecture should allow mock scores to later be replaced by real calculated scores without rewriting the UI.

---

# 10. Future City / Timeline

A major potential differentiator of the product is showing not only:

> What is this area like today?

but also:

> What may this area be like in the future?

Potential data includes:

- planned infrastructure,
- public transport investments,
- road works,
- parks,
- urban development projects,
- city planning data.

Potential sources include official Kraków datasets and MSIP.

The intended UI is a timeline such as:

```text
Today ───────●──────── 2031
```

Changing the selected date/year may alter the map.

Example:

```text
Current match: 64%

Projected 2029 match: 81%

Why?

+ planned tram connection
+ planned green area
- temporary construction impact
```

IMPORTANT:

This feature is secondary to the core personalized map.

Do NOT prioritize timeline functionality until the current-city map works end-to-end.

Future projections must clearly distinguish:

- confirmed/official planned projects,
- assumptions,
- derived impact estimates.

Do not present uncertain future outcomes as facts.

---

# 11. Planned Technical Stack

Frontend:

```text
Next.js
TypeScript
App Router
Tailwind CSS
shadcn/ui
```

Mapping:

```text
MapLibre GL JS
h3-js
```

Validation/forms:

```text
Zod
React Hook Form
```

Backend/database:

```text
Supabase
PostgreSQL
PostGIS
```

Potential later addition:

```text
LLM API
```

Do NOT introduce additional backend frameworks unless there is a concrete technical requirement.

Do NOT add:

- NestJS
- Express
- separate PostgreSQL
- Redis
- Kafka
- RabbitMQ
- microservices

for the current MVP.

Next.js + Supabase is sufficient.

---

# 12. Current Development Stage

The repository starts essentially empty.

The immediate goal is NOT to integrate every external service.

The first milestone is a complete vertical slice using deterministic mock data.

Required first working version:

```text
Landing
   ↓
Preferences
   ↓
Manual category weights
   ↓
Map
   ↓
Kraków H3 hexagons
   ↓
Personalized coloring
   ↓
Switch category
   ↓
Map recolors
   ↓
Click hexagon
   ↓
Score breakdown
```

This must work before implementing:

- Supabase integration,
- OpenStreetMap imports,
- LLM integration,
- future city timeline,
- advanced scoring.

---

# 13. Mock Data Strategy

During the first development phase, generate deterministic mock scores for H3 cells covering the selected Kraków area.

Each cell should contain:

```ts
type CategoryScores = {
  sport: number;
  culture: number;
  greenery: number;
  shopping: number;
  transport: number;
};

type HexData = {
  h3Index: string;
  scores: CategoryScores;
};
```

Scores should be between:

```text
0–100
```

Mock data MUST be deterministic.

Do not generate random values on every page load.

The same hexagon should always receive the same mock scores.

This ensures predictable demos and testing.

---

# 14. Intended Database Model

Initial database design should remain minimal.

Conceptually:

```text
hex_scores

h3_index
geometry
sport_score
culture_score
greenery_score
shopping_score
transport_score
```

Additional tables may later include:

```text
pois
future_projects
data_sources
```

Do not build user/account tables unless authentication becomes an explicit requirement.

---

# 15. LLM Responsibilities

The LLM should have narrowly defined responsibilities.

## Allowed

Natural language:

```text
"I love parks and running and need good tram connections."
```

to structured data:

```json
{
  "sport": 0.3,
  "culture": 0.05,
  "greenery": 0.35,
  "shopping": 0.05,
  "transport": 0.25
}
```

Potentially later:

structured geographic facts → concise human-readable explanation.

## Not allowed

The LLM should NOT:

- invent neighborhood data,
- invent POIs,
- decide geographic scores,
- generate arbitrary match percentages,
- determine objectively "good" or "bad" neighborhoods,
- replace deterministic scoring logic.

Geographic facts and scores must come from data.

---

# 16. Reliability

The demo must remain functional if external APIs fail.

Therefore:

### LLM fallback

Manual preference controls must always work.

### Data fallback

The application should have a known working dataset for Kraków.

Do not make the primary demo dependent on live OpenStreetMap queries.

### Demo behavior

Prefer deterministic behavior over impressive but fragile integrations.

---

# 17. UX Principles

The product should feel:

- modern,
- map-first,
- visual,
- simple,
- trustworthy,
- fast.

Avoid dashboard overload.

The map is the primary visualization.

Preference controls and explanations should support the map rather than compete with it.

Mobile responsiveness is required, but the hackathon presentation will likely primarily use desktop.

Use shadcn/ui components where appropriate.

Do not create unnecessary custom component systems.

---

# 18. Visual Hierarchy

Primary visual element:

```text
MAP + HEXAGON SUITABILITY LAYER
```

Secondary:

```text
category selector
```

Then:

```text
selected-area explanation
```

The user should immediately understand:

```text
green / high intensity = stronger match
red / low intensity = weaker match
```

while remembering that this represents personal fit, not objective neighborhood quality.

---

# 19. Performance

Avoid recalculating expensive spatial operations on every frontend render.

Preferred eventual architecture:

```text
DATA INGESTION

OpenStreetMap
GTFS
Kraków datasets
      ↓
normalization
      ↓
PostGIS
      ↓
H3 aggregation
      ↓
precomputed category scores
```

Runtime:

```text
User preferences
      ↓
category weights
      ↓
weighted calculation
      ↓
existing H3 category scores
      ↓
MapLibre visualization
```

The expensive geographic processing should happen before user requests whenever possible.

---

# 20. Hackathon Priorities

Implementation priority:

## P0 — Must work

- Next.js application
- polished basic UI
- Kraków map
- H3 visualization
- deterministic mock category scores
- category switching
- manual preference weights
- personalized weighted score
- clickable hexagon
- score breakdown

## P1 — Strong MVP

- real OSM data
- Supabase/PostGIS
- preference text input
- LLM structured preference extraction
- explanation based on real data

## P2 — Differentiators

- GTFS/public transport scoring
- future city data
- timeline
- planned investments
- richer explanation
- negative preferences / things to avoid

## P3 — Only if everything else is stable

- multiple cities
- authentication
- saved preferences
- saved areas
- comparisons
- advanced AI
- sophisticated predictive models

Never sacrifice P0/P1 stability to implement P2/P3.

---

# 21. Development Rules for AI Coding Agents

When implementing features:

1. Read this document before making architectural decisions.
2. Prefer the simplest implementation satisfying the requirement.
3. Do not introduce dependencies without a concrete reason.
4. Do not implement speculative infrastructure.
5. Keep domain logic separate from UI components.
6. Keep scoring functions deterministic and testable.
7. Prefer small reusable functions over large abstractions.
8. Maintain strict TypeScript types.
9. Validate external/LLM data with Zod.
10. Never expose API keys in client-side code.
11. Never hardcode secrets.
12. Preserve a working application after each meaningful change.
13. Do not refactor unrelated code while implementing a feature.
14. Do not replace working functionality merely for architectural elegance.
15. Optimize for hackathon delivery, demo reliability, and understandable code.

If a requirement is unclear, prefer the implementation that is:

```text
simpler
→ more deterministic
→ easier to demo
→ easier for another team member to understand
```

---

# 22. Current Immediate Goal

The next engineering milestone is:

> Build a polished vertical slice of the application using mock data.

Specifically:

1. initialize Next.js,
2. configure shadcn/ui,
3. integrate MapLibre,
4. display Kraków,
5. generate H3 cells for the demo area,
6. assign deterministic mock scores,
7. implement manual preference weights,
8. calculate personalized scores,
9. color H3 cells according to selected map mode,
10. implement category switching,
11. implement clickable hexagons,
12. display score breakdown.

Do NOT integrate Supabase or an LLM until this vertical slice works reliably.

---

# 23. Definition of Done for First Milestone

The milestone is complete when a user can:

1. open the application,
2. configure preferences,
3. open the Kraków map,
4. see a colored H3 suitability map,
5. switch between:
   - For You,
   - Sport,
   - Culture,
   - Greenery,
   - Shopping,
   - Transport,
6. observe the map recolor immediately,
7. click any visible hexagon,
8. see its category scores,
9. understand why its personalized score differs from another hexagon.

At this point the project has a complete working product loop.

Only then should real datasets and AI integrations replace the mocked components.
