import type { WorksCollection } from "../data/works-map";

type Coords = number[] | Coords[];

/** [west, south, east, north] of every geometry belonging to one work id, or null if the id is unknown. */
export function workBounds(collection: Pick<WorksCollection, "features">, id: string): [number, number, number, number] | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const visit = (c: Coords) => {
    if (typeof c[0] === "number") {
      const [lng, lat] = c as number[];
      w = Math.min(w, lng); e = Math.max(e, lng); s = Math.min(s, lat); n = Math.max(n, lat);
    } else (c as Coords[]).forEach(visit);
  };
  for (const f of collection.features) {
    if (f.properties.id !== id) continue;
    const g = f.geometry as { coordinates?: Coords; geometries?: { coordinates: Coords }[] };
    if (g.coordinates) visit(g.coordinates);
    g.geometries?.forEach((x) => visit(x.coordinates));
  }
  return Number.isFinite(w) ? [w, s, e, n] : null;
}
