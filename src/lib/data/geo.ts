export type LngLat = [number, number];
export type Ring = LngLat[];

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres between [lng, lat] points. */
export function haversine(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ray-casting point-in-ring test ([lng, lat]). */
export function pointInRing(p: LngLat, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Polygon = outer ring + holes. */
export type Polygon = Ring[];

export function pointInPolygon(p: LngLat, poly: Polygon): boolean {
  if (!pointInRing(p, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) if (pointInRing(p, poly[i])) return false;
  return true;
}

/** [minLng, minLat, maxLng, maxLat] */
export type BBox = [number, number, number, number];

export function ringBBox(ring: Ring): BBox {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Joins unordered way segments into closed rings (for multipolygon relations). */
export function assembleRings(segments: Ring[]): Ring[] {
  const rings: Ring[] = [];
  const pool = segments.filter((s) => s.length > 1).map((s) => [...s]);
  const same = (a: LngLat, b: LngLat) => a[0] === b[0] && a[1] === b[1];
  while (pool.length) {
    let cur = pool.pop()!;
    let grew = true;
    while (grew && !same(cur[0], cur[cur.length - 1])) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i];
        const end = cur[cur.length - 1];
        if (same(end, s[0])) cur = cur.concat(s.slice(1));
        else if (same(end, s[s.length - 1])) cur = cur.concat([...s].reverse().slice(1));
        else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (cur.length >= 4 && same(cur[0], cur[cur.length - 1])) rings.push(cur);
  }
  return rings;
}
