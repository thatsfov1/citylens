import { isValidCell } from "h3-js";
import { CATEGORIES, type MapMode } from "../../types";
import { MAX_COMPARED } from "../scoring/compare";
import { RENT_MAX, RENT_MIN, formatZl, type RentFilter } from "../scoring/rent";
import type { Importance } from "../scoring/preferences";

// What a shared link carries beyond the filters that already live in the URL (weights, minSafety, edu, near,
// rent/rooms/czynsz): the map tab, the open area and the areas being compared. Everything is in the link, no backend.

export const MAP_MODES: readonly MapMode[] = ["forYou", ...CATEGORIES, "safety"];

export type ShareState = {
  mode: MapMode;
  /** The area that is open, if any. */
  selected: string | null;
  /** Areas being compared (at most MAX_COMPARED). */
  compared: string[];
};

export const DEFAULT_SHARE: ShareState = { mode: "forYou", selected: null, compared: [] };

/** The URL parameters this module owns, in the order they are written. */
const SHARE_KEYS = ["mode", "sel", "cmp", "shared"] as const;

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Reads mode / sel / cmp from the URL. Anything invalid, unknown or not in the loaded grid is dropped; never throws. */
export function parseShareState(params: Params, validIds?: ReadonlySet<string>): ShareState & { shared: boolean } {
  const ok = (id: string) => isValidCell(id) && (!validIds || validIds.has(id));
  const mode = first(params.mode);
  const sel = first(params.sel);
  const cmp = first(params.cmp)?.split(",") ?? [];
  return {
    mode: MAP_MODES.includes(mode as MapMode) ? (mode as MapMode) : "forYou",
    selected: sel && ok(sel) ? sel : null,
    compared: [...new Set(cmp)].filter(ok).slice(0, MAX_COMPARED),
    shared: first(params.shared) === "1",
  };
}

/** Writes the share keys into a copy of `search`, in a fixed order, leaving every other parameter untouched. */
export function applyShareState(search: string | URLSearchParams, state: ShareState, opts: { shared?: boolean } = {}): URLSearchParams {
  const out = new URLSearchParams(search);
  for (const k of SHARE_KEYS) out.delete(k);
  if (state.mode !== "forYou") out.set("mode", state.mode);
  if (state.selected) out.set("sel", state.selected);
  if (state.compared.length > 0) out.set("cmp", state.compared.slice(0, MAX_COMPARED).join(","));
  if (opts.shared) out.set("shared", "1");
  return out;
}

/** The link to hand out: the current map parameters plus the share state, marked `shared=1` for the receiver. */
export function buildShareUrl(origin: string, search: string, state: ShareState): string {
  return `${origin}/map?${applyShareState(search, state, { shared: true })}`;
}

/** The same parameters without the receiver marker: what a saved map stores. */
export function savedQuery(search: string, state: ShareState): string {
  return applyShareState(search, state).toString();
}

/** Parameters that only describe the map view (tab, open area, compared areas, timeline year, shared marker). */
const VIEW_KEYS = [...SHARE_KEYS, "rok"] as const;

/** What the landing page needs to reopen the preferences: every filter in `search`, without the map-view state. */
export function preferencesQuery(search: string | URLSearchParams): string {
  const out = new URLSearchParams(search);
  for (const k of VIEW_KEYS) out.delete(k);
  return out.toString();
}

const LABEL_PL: Record<(typeof CATEGORIES)[number], string> = {
  sport: "sport",
  culture: "kultura",
  greenery: "zieleń",
  shopping: "zakupy",
  transport: "transport",
  education: "edukacja",
};

/** "zieleń 100%, transport 75%": the strongest preferences, for link previews and the share summary. */
export function topPreferences(importance: Importance, limit = 3): string[] {
  return CATEGORIES.filter((c) => importance[c] > 0)
    .sort((a, b) => importance[b] - importance[a])
    .slice(0, limit)
    .map((c) => `${LABEL_PL[c]} ${Math.round(importance[c])}%`);
}

export function rentPhrase(rent: RentFilter | null): string | null {
  if (!rent) return null;
  const range =
    rent.min <= RENT_MIN ? `do ${formatZl(rent.max)}` : rent.max >= RENT_MAX ? `od ${formatZl(rent.min)}` : `${formatZl(rent.min)} – ${formatZl(rent.max)}`;
  return `czynsz ${range}${rent.fees ? "" : " (bez opłat)"}`;
}
