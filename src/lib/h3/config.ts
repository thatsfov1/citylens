// Demo area (central Kraków) and H3 resolution. Change here to resize the grid.
// Res 9 ≈ 0.1 km² per cell (~175 m edge) — neighborhood scale.
export const H3_RESOLUTION = 9;

export const KRAKOW_CENTER = { lat: 50.0614, lng: 19.9372 } as const;
export const KRAKOW_INITIAL_ZOOM = 11.6;

export const KRAKOW_BBOX = {
  south: 50.015,
  north: 50.1,
  west: 19.84,
  east: 20.04,
} as const;
