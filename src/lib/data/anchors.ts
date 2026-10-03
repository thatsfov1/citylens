// Picks the best match for a place name the user typed among candidate POIs. Pure, so it is testable;
// the database lookup lives in src/lib/supabase/anchors.ts.

export type AnchorCandidate = { name: string; kind: string; lat: number; lng: number };

// Bigger, more "anchor-like" places first when several share a name (e.g. a station vs. a bus stop).
const KIND_RANK = ["university", "college", "rail_station", "stadium", "mall", "museum", "tram_stop", "bus_stop"];

const norm = (s: string) => s.toLocaleLowerCase("pl").trim();

export function pickCandidate(query: string, candidates: AnchorCandidate[]): AnchorCandidate | null {
  const q = norm(query);
  const score = (c: AnchorCandidate) => {
    const n = norm(c.name);
    const match = n === q ? 0 : n.startsWith(q) ? 1 : 2;
    const rank = KIND_RANK.indexOf(c.kind);
    return [match, rank === -1 ? KIND_RANK.length : rank, n.length] as const;
  };
  const sorted = [...candidates].sort((a, b) => {
    const [sa, sb] = [score(a), score(b)];
    return sa[0] - sb[0] || sa[1] - sb[1] || sa[2] - sb[2];
  });
  return sorted[0] ?? null;
}
