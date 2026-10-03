<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Branching

Always use new branch for each feature

# Read first: decisions & current state

Before changing data, database, API, scoring or pipeline code, read `docs/PROJECT_DECISIONS.md`.
It records what was actually built and why (database schema, OSM pipeline, API shape, LLM
role, known divergences from this file). When you make a structural decision, update it in the same PR.

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


---

# 24. Team Structure & Development Workflow

This project is being developed by two developers during a time-limited hackathon.

Both developers may use multiple AI coding agents, including Claude Code and Codex.

The most important collaboration rule is:

> Agents must have clearly separated responsibilities and must not modify the same files or architectural areas simultaneously.

---

## 24.1 Developer Responsibilities

### Developer A — Data / Backend / Geographic Processing

Developer A owns the data and backend layer.

Primary responsibilities:

```text
Supabase
PostgreSQL
PostGIS
database migrations
data ingestion
OpenStreetMap
H3
geographic aggregation
category scoring
API routes
server-side data access
future city project data

Typical files/directories:

supabase/
scripts/
src/app/api/
src/lib/supabase/
src/lib/data/
src/lib/scoring/

Developer A should focus on:

real city data
      ↓
normalization
      ↓
H3
      ↓
category scores
      ↓
Supabase
      ↓
Next.js API

Developer A should NOT modify frontend components unless explicitly necessary.

Developer B — Frontend / UX / Visualization

Developer B owns the user-facing application.

Primary responsibilities:

UI
UX
shadcn/ui
Tailwind
MapLibre
H3 visualization
preference controls
map interactions
hexagon details
responsive design
visual polish

Typical files/directories:

src/app/
src/components/
src/features/
src/hooks/
src/lib/map/

Developer B should initially use deterministic mock data where the backend is not ready.

The frontend should be developed against the shared TypeScript data contract.

Developer B should NOT modify database schema or data ingestion logic unless explicitly coordinated.

25. Agent Ownership

Multiple coding agents may be active at the same time.

Agents must be treated as specialists, not autonomous project owners.

Each agent receives:

a specific objective,
an explicit scope,
allowed files/directories,
files/directories it must not touch,
a definition of done.

Example:

Task:
Implement the H3 scoring pipeline.

Allowed:
scripts/scoring/**
src/lib/scoring/**
src/types/** only if required

Do not modify:
src/components/**
src/app/**
supabase/migrations/**

Definition of done:
- deterministic scoring function
- typed input/output
- basic tests or verification
- no frontend changes
26. Parallel Agent Rules

Before starting an agent, check which files another agent is currently modifying.

Do NOT run two agents simultaneously if they may modify:

the same file,
the same component,
the same migration,
the same API route,
the same shared type definitions.

If two tasks depend on the same file, serialize the work.

Prefer:

Agent A
  ↓
commit
  ↓
Agent B

over:

Agent A ─────┐
             ├── same files
Agent B ─────┘
27. Shared Contract

The following files are shared between frontend and backend:

src/types/**

Changes to shared types affect multiple developers.

Do not modify shared types casually.

If a change is necessary:

inform the other developer,
make the smallest possible change,
commit it separately,
tell the other developer to update their branch.

The current core contract is:

export type Category =
  | "sport"
  | "culture"
  | "greenery"
  | "shopping"
  | "transport";

export type HexScore = {
  h3: string;
  sport: number;
  culture: number;
  greenery: number;
  shopping: number;
  transport: number;
};

export type UserPreferences = {
  sport: number;
  culture: number;
  greenery: number;
  shopping: number;
  transport: number;
};

Do not change the semantic meaning of these fields without coordination.

28. API Is the Frontend/Backend Boundary

The frontend should consume backend data through a stable API.

Initial endpoint:

GET /api/hexes

The frontend should not depend directly on internal Supabase tables.

Conceptually:

Frontend
    ↓
Next.js API
    ↓
Supabase
    ↓
PostgreSQL/PostGIS

This allows the backend/data layer to evolve without forcing frontend rewrites.

The API response should conform to the shared HexScore contract.

29. Git Workflow

The repository uses GitHub.

main is the integration branch.

Never work directly on main.

The rule is:

Every meaningful feature/task gets its own branch.

Examples:

feature/supabase-schema
feature/hex-api
feature/osm-import
feature/h3-scoring
feature/map-ui
feature/preferences-ui
feature/hex-details

Keep branches small and short-lived.

Do not maintain huge feature branches for many hours if the work can be split into smaller units.

30. Branch Workflow

Before starting a task:

git switch main
git pull origin main
git switch -c feature/<task-name>

Work only on that branch.

When the task is complete:

git status
git add <relevant-files>
git commit -m "feat: <description>"
git push -u origin feature/<task-name>

Then merge the branch into main.

After merging:

git switch main
git pull origin main

The next task starts from the updated main.

31. Commit Frequently

Commits should represent logical units of work.

Good:

feat: add Supabase server client
feat: add hex scores migration
feat: add hexes API
feat: add H3 aggregation
feat: add OSM importer
fix: normalize transport scores

Bad:

changes
stuff
final
final2
hackathon

Prefer several small recoverable commits over one huge commit.

32. Push Frequently

Push completed logical units to GitHub.

This provides:

backup,
visibility,
easier collaboration,
easier recovery,
easier rollback.

Do not wait until the end of the hackathon to push.

33. Merge Coordination

Only one person should merge a particular branch at a time.

Before merging:

git switch main
git pull origin main

If another feature was merged while the branch was being developed, update the feature branch before merging if necessary.

The goal is to keep:

main

in a continuously working state.

After every meaningful merge, quickly verify:

npm run build

and/or the relevant lint/typecheck commands.

34. Do Not Rewrite Other People's Work

An agent must not:

rewrite another developer's component,
refactor unrelated code,
rename unrelated files,
change architecture for aesthetic reasons,
"clean up" code outside its task.

If existing code is sufficient for the requested feature, build on it.

If an architectural problem is discovered, report it before making a broad refactor.

35. Dangerous Git Operations

Never execute automatically:

git reset --hard
git clean -fd
git checkout -- .
git push --force

These commands can destroy another developer's work.

Only execute them when explicitly requested by the human developer.

36. Agent Handoff Protocol

When finishing a task, report:

Implemented:
- ...

Files changed:
- ...

Tests/checks:
- ...

Assumptions:
- ...

Known limitations:
- ...

Recommended next step:
- ...

Do not claim functionality was tested if it was not actually tested.

37. Current Parallel Work Plan

The frontend and backend can progress in parallel.

Backend/Data track
Supabase setup
    ↓
schema
    ↓
hex_scores
    ↓
API
    ↓
H3
    ↓
OSM
    ↓
scoring
Frontend track
landing
    ↓
preferences
    ↓
MapLibre
    ↓
mock H3 data
    ↓
category switching
    ↓
hex details
    ↓
visual polish

The frontend does NOT need to wait for real data.

It should initially use deterministic mock HexScore[].

The backend does NOT need to wait for the final UI.

It should initially make the API/data contract work.

The two tracks converge at:

GET /api/hexes
38. Current Immediate Backend Task

Developer A is currently responsible for establishing the backend/data foundation.

The immediate sequence is:

1. inspect repository
2. inspect existing Next.js setup
3. create shared types if missing
4. configure Supabase
5. create database migration
6. create hex_scores table
7. create server-side Supabase access
8. create GET /api/hexes
9. verify API response
10. commit and push

Do NOT immediately implement the entire OSM pipeline.

Do NOT implement future projects yet.

Do NOT introduce a separate backend framework.

The first backend milestone is:

Supabase
   ↓
hex_scores
   ↓
GET /api/hexes
   ↓
valid HexScore[]
39. Current Immediate Frontend Task

Developer B can work independently on:

MapLibre
H3 visualization
deterministic mock HexScore[]
category switching
manual preferences
personalized score
hexagon details

The frontend should eventually replace mock data with:

fetch("/api/hexes")

without requiring a major rewrite.

40. Important Hackathon Principle

This is a 24-hour hackathon.

Optimize for:

working
→ understandable
→ deterministic
→ demoable
→ visually convincing

Do not optimize for:

perfect architecture
→ production scalability
→ abstraction
→ infrastructure

When choosing between two technically valid solutions, prefer the one that can be implemented, tested, explained to judges, and demoed reliably within the hackathon timeframe.


### Jedna korekta względem obecnego `CLAUDE.md`

Wasz obecny dokument mówi:

> **First milestone = mock frontend → dopiero potem Supabase/LLM/OSM.**

To jest OK jako **priorytet produktu**, ale przy pracy równoległej nie oznacza, że Ty masz czekać.

Możecie robić jednocześnie:

```text
             MAIN
               │
       ┌───────┴────────┐
       ↓                ↓
 frontend            backend
 mock data            Supabase
 MapLibre             API
 H3 UI                H3/scoring
       │                │
       └───────┬────────┘
               ↓
          real integration