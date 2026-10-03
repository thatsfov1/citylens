// Per-hexagon API responses (details, places, works) never change within a session, so repeat clicks reuse them.
// In memory only: cleared on reload, no serialisation or size limits. Failures are not cached.
const cache = new Map<string, unknown>();

export async function fetchCached<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  if (cache.has(url)) return cache.get(url) as T;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as T;
  cache.set(url, data);
  return data;
}
