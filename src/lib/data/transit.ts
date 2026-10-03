import { haversine, type LngLat } from "./geo";

// Public-transport planner over the official ZTP Kraków timetable (data/gtfs/timetable.json, built by
// scripts/gtfs/build-timetable.ts). A small round-based earliest-arrival search (RAPTOR): round k = best arrival
// using at most k rides. Pure and deterministic; the caller loads the timetable.

/** [name, lng, lat] */
type TStop = [string, number, number];
/** [line, mode (1 = tram, 0 = bus), headsign, stop indexes, arrival offsets (s from first departure), start times (s)] */
type TPattern = [string, 0 | 1, string, number[], number[], number[]];
export type Timetable = { source: string; serviceDate: string; window: string; stops: TStop[]; patterns: TPattern[] };

export type TransitLeg =
  | { type: "walk"; minutes: number; meters: number; to: string }
  | {
      type: "ride";
      mode: "bus" | "tram";
      line: string;
      headsign: string;
      boardStop: string;
      alightStop: string;
      /** Stops travelled (alight − board). */
      stops: number;
      minutes: number;
      departs: string;
      arrives: string;
      coordinates: [number, number][];
    };

export type TransitPlan = {
  /** Door to door, from leaving the origin to arriving; excludes waiting for the first vehicle. */
  totalMinutes: number;
  transfers: number;
  leaveAt: string;
  arriveAt: string;
  legs: TransitLeg[];
};

const WALK_MPS = 4.8 / 3.6;
const DETOUR = 1.3;
const MAX_ACCESS_M = 800;
const MAX_TRANSFER_M = 250;
const TRANSFER_BUFFER_S = 60;
const MAX_RIDES = 3;
/** Beyond this the trip is not a realistic walk, so a transit plan must exist. */
const MAX_WALK_ONLY_M = 2500;

const walkSecs = (m: number) => Math.round((m * DETOUR) / WALK_MPS);
const hhmm = (s: number) => `${String(Math.floor(s / 3600) % 24).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;

type Index = {
  tt: Timetable;
  /** stop → [pattern, position] pairs that serve it */
  serving: [number, number][][];
  /** stop → nearby stops reachable on foot */
  transfers: { to: number; secs: number; m: number }[][];
};
const cache = new WeakMap<Timetable, Index>();

function indexOf(tt: Timetable): Index {
  const hit = cache.get(tt);
  if (hit) return hit;
  const serving: [number, number][][] = tt.stops.map(() => []);
  tt.patterns.forEach((p, pi) => p[3].forEach((s, pos) => serving[s].push([pi, pos])));

  // Grid of ~250 m cells (0.0025° lat ≈ 278 m, 0.004° lng ≈ 285 m at 50°N) to find walking transfers.
  const key = (lng: number, lat: number) => `${Math.floor(lng / 0.004)}|${Math.floor(lat / 0.0025)}`;
  const grid = new Map<string, number[]>();
  tt.stops.forEach((s, i) => {
    const k = key(s[1], s[2]);
    grid.set(k, [...(grid.get(k) ?? []), i]);
  });
  const transfers = tt.stops.map((s, i) => {
    const out: Index["transfers"][number] = [];
    const cx = Math.floor(s[1] / 0.004);
    const cy = Math.floor(s[2] / 0.0025);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const j of grid.get(`${cx + dx}|${cy + dy}`) ?? []) {
          if (j === i) continue;
          const m = haversine([s[1], s[2]], [tt.stops[j][1], tt.stops[j][2]]);
          if (m <= MAX_TRANSFER_M) out.push({ to: j, secs: walkSecs(m), m });
        }
    return out;
  });
  const index = { tt, serving, transfers };
  cache.set(tt, index);
  return index;
}

type Parent =
  | { kind: "access"; m: number }
  | { kind: "ride"; pattern: number; board: number; alight: number; start: number; from: number }
  | { kind: "walk"; from: number; m: number };

/** Stops within `radiusM` of a point, with the walking distance. */
function nearbyStops(tt: Timetable, at: LngLat, radiusM: number): { stop: number; m: number }[] {
  const out: { stop: number; m: number }[] = [];
  tt.stops.forEach((s, i) => {
    if (Math.abs(s[2] - at[1]) > radiusM / 111000 + 0.001) return;
    const m = haversine(at, [s[1], s[2]]);
    if (m <= radiusM) out.push({ stop: i, m });
  });
  return out;
}

/** First index in `starts` with starts[i] >= t (starts is sorted). */
function firstAtLeast(starts: number[], t: number): number {
  let lo = 0;
  let hi = starts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Fastest public-transport trip from `from` to `to` leaving at `departAt` (seconds after midnight), or null when no
 * bus/tram connection exists within walking reach of both ends. A plain walk is returned when it beats transit.
 */
export function planTransit(tt: Timetable, from: { lat: number; lng: number }, to: { lat: number; lng: number }, departAt: number): TransitPlan | null {
  const { serving, transfers } = indexOf(tt);
  const n = tt.stops.length;
  const origin: LngLat = [from.lng, from.lat];
  const dest: LngLat = [to.lng, to.lat];
  const directM = haversine(origin, dest);

  const best = new Array<number>(n).fill(Infinity);
  const tau: Float64Array[] = [];
  const parent: (Parent | null)[][] = [];
  tau.push(new Float64Array(n).fill(Infinity));
  parent.push(new Array<Parent | null>(n).fill(null));

  let marked = new Set<number>();
  for (const { stop, m } of nearbyStops(tt, origin, MAX_ACCESS_M)) {
    tau[0][stop] = departAt + walkSecs(m);
    parent[0][stop] = { kind: "access", m };
    best[stop] = tau[0][stop];
    marked.add(stop);
  }

  for (let k = 1; k <= MAX_RIDES && marked.size; k++) {
    tau.push(Float64Array.from(tau[k - 1]));
    parent.push([...parent[k - 1]]);
    // For each pattern, the earliest marked position to board at.
    const queue = new Map<number, number>();
    for (const s of marked)
      for (const [pi, pos] of serving[s]) {
        const cur = queue.get(pi);
        if (cur === undefined || pos < cur) queue.set(pi, pos);
      }
    const improved = new Set<number>();
    for (const [pi, firstPos] of queue) {
      const [, , , pstops, offs, starts] = tt.patterns[pi];
      let trip = -1;
      let boardPos = -1;
      for (let pos = firstPos; pos < pstops.length; pos++) {
        const s = pstops[pos];
        if (trip >= 0) {
          const arr = starts[trip] + offs[pos];
          if (arr < best[s] && arr < tau[k][s]) {
            tau[k][s] = arr;
            best[s] = arr;
            parent[k][s] = { kind: "ride", pattern: pi, board: boardPos, alight: pos, start: starts[trip], from: pstops[boardPos] };
            improved.add(s);
          }
        }
        // Can we board an earlier trip here? Only from a stop reached in the previous round.
        const ready = tau[k - 1][s];
        if (ready < Infinity) {
          const buffer = k > 1 ? TRANSFER_BUFFER_S : 0;
          const t = firstAtLeast(starts, ready + buffer - offs[pos]);
          if (t < starts.length && (trip < 0 || t < trip)) {
            trip = t;
            boardPos = pos;
          }
        }
      }
    }
    // Walking transfers from stops reached by a ride this round.
    const walked = new Set<number>();
    for (const s of improved)
      for (const tr of transfers[s]) {
        const arr = tau[k][s] + tr.secs;
        if (arr < best[tr.to] && arr < tau[k][tr.to]) {
          tau[k][tr.to] = arr;
          best[tr.to] = arr;
          parent[k][tr.to] = { kind: "walk", from: s, m: tr.m };
          walked.add(tr.to);
        }
      }
    marked = new Set([...improved, ...walked]);
  }

  // Egress: pick the earliest arrival at the destination over all rounds.
  const egress = nearbyStops(tt, dest, MAX_ACCESS_M);
  let pick: { k: number; stop: number; arrive: number; m: number } | null = null;
  for (let k = 1; k < tau.length; k++)
    for (const { stop, m } of egress) {
      if (!(parent[k][stop]?.kind === "ride" || parent[k][stop]?.kind === "walk")) continue;
      const arrive = tau[k][stop] + walkSecs(m);
      if (!pick || arrive < pick.arrive - 1) pick = { k, stop, arrive, m };
    }

  const walkOnlySecs = walkSecs(directM);
  if (!pick) return directM <= MAX_WALK_ONLY_M ? walkOnly(directM, walkOnlySecs, departAt) : null;

  // Rebuild legs, from the destination back to the origin.
  const legs: TransitLeg[] = [];
  if (pick.m >= 30) legs.push({ type: "walk", minutes: Math.max(1, Math.round(walkSecs(pick.m) / 60)), meters: Math.round(pick.m * DETOUR), to: "your workplace" });
  let k = pick.k;
  let stop = pick.stop;
  let firstDepart = departAt;
  let accessM = 0;
  for (let guard = 0; guard < 20; guard++) {
    const p = parent[k][stop];
    if (!p) return null;
    if (p.kind === "access") {
      accessM = p.m;
      break;
    }
    if (p.kind === "walk") {
      legs.push({ type: "walk", minutes: Math.max(1, Math.round(walkSecs(p.m) / 60)), meters: Math.round(p.m * DETOUR), to: tt.stops[stop][0] });
      stop = p.from;
      continue;
    }
    const [line, mode, headsign, pstops, offs] = tt.patterns[p.pattern];
    const departs = p.start + offs[p.board];
    const arrives = p.start + offs[p.alight];
    legs.push({
      type: "ride",
      mode: mode === 1 ? "tram" : "bus",
      line,
      headsign,
      boardStop: tt.stops[pstops[p.board]][0],
      alightStop: tt.stops[pstops[p.alight]][0],
      stops: p.alight - p.board,
      minutes: Math.max(1, Math.round((arrives - departs) / 60)),
      departs: hhmm(departs),
      arrives: hhmm(arrives),
      coordinates: pstops.slice(p.board, p.alight + 1).map((s) => [tt.stops[s][1], tt.stops[s][2]] as [number, number]),
    });
    firstDepart = departs;
    stop = p.from;
    k -= 1;
  }
  if (accessM >= 30) legs.push({ type: "walk", minutes: Math.max(1, Math.round(walkSecs(accessM) / 60)), meters: Math.round(accessM * DETOUR), to: tt.stops[stop][0] });
  legs.reverse();

  const leave = firstDepart - walkSecs(accessM);
  const total = pick.arrive - leave;
  if (directM <= MAX_WALK_ONLY_M && walkOnlySecs <= total) return walkOnly(directM, walkOnlySecs, departAt);
  return {
    totalMinutes: Math.max(1, Math.round(total / 60)),
    transfers: legs.filter((l) => l.type === "ride").length - 1,
    leaveAt: hhmm(leave),
    arriveAt: hhmm(pick.arrive),
    legs,
  };
}

function walkOnly(directM: number, secs: number, departAt: number): TransitPlan {
  return {
    totalMinutes: Math.max(1, Math.round(secs / 60)),
    transfers: 0,
    leaveAt: hhmm(departAt),
    arriveAt: hhmm(departAt + secs),
    legs: [{ type: "walk", minutes: Math.max(1, Math.round(secs / 60)), meters: Math.round(directM * DETOUR), to: "your workplace" }],
  };
}

/** Straight lines between legs: the polyline to draw for a plan (rides follow their stops, walks go direct). */
export function planPath(plan: TransitPlan, from: { lat: number; lng: number }, to: { lat: number; lng: number }): [number, number][] {
  const pts: [number, number][] = [[from.lng, from.lat]];
  for (const leg of plan.legs) if (leg.type === "ride") pts.push(...leg.coordinates);
  pts.push([to.lng, to.lat]);
  return pts;
}
