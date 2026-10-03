// H3 resolution and initial view. The covered area is Kraków's boundary (see grid.ts).
// Res 8 ≈ 0.74 km² per cell (~460 m edge). Res 9 is ~7× smaller (~175 m edge).
export const H3_RESOLUTION = 8;

export const KRAKOW_CENTER = { lat: 50.0614, lng: 19.9372 } as const;
export const KRAKOW_INITIAL_ZOOM = 10.3;
