import { z } from "zod";

// Named snapshots of the map, kept in this browser only (no accounts). A snapshot is the map's query string, so it keeps
// working as long as the URL parameters do. Storage can be missing or blocked (private mode): callers get `ok: false`.

export const SAVED_KEY = "krakow-saved-maps-v1";
export const MAX_SAVED = 10;

const savedSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(60),
  createdAt: z.number().int().nonnegative(),
  query: z.string().max(2000),
});
export type SavedMap = z.infer<typeof savedSchema>;

type Store = Pick<Storage, "getItem" | "setItem">;

const defaultStore = (): Store | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Saved maps, newest first. Corrupt or foreign data is ignored entry by entry. */
export function loadSaved(store: Store | null = defaultStore()): SavedMap[] {
  try {
    const raw = store?.getItem(SAVED_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .flatMap((d) => {
        const r = savedSchema.safeParse(d);
        return r.success ? [r.data] : [];
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

function write(list: SavedMap[], store: Store | null): boolean {
  try {
    if (!store) return false;
    store.setItem(SAVED_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Adds a snapshot (replacing an older one with the same query), keeping at most MAX_SAVED. */
export function saveMap(
  entry: { name: string; query: string },
  now: number = Date.now(),
  store: Store | null = defaultStore(),
): { ok: boolean; list: SavedMap[] } {
  const current = loadSaved(store);
  const next: SavedMap = { id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: entry.name.trim().slice(0, 60) || "Saved map", createdAt: now, query: entry.query };
  const list = [next, ...current.filter((s) => s.query !== entry.query)].slice(0, MAX_SAVED);
  return { ok: write(list, store), list };
}

export function deleteSaved(id: string, store: Store | null = defaultStore()): SavedMap[] {
  const list = loadSaved(store).filter((s) => s.id !== id);
  write(list, store);
  return list;
}
