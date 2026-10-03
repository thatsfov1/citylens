import { cellToLatLng } from "h3-js";
import { BAND_COLORS, BAND_COUNT, NO_DATA_COLOR } from "./zones";

/** Overlay opacity of the match colours / the "no data" grey (0–255). */
const ALPHA = Math.round(0.62 * 255);
const NO_DATA_ALPHA = Math.round(0.45 * 255);
/** Gaussian smoothing radius around each hex centre (km); neighbouring centres are ~0.8 km apart at res 8. */
const SIGMA_KM = 0.4;

export type HeatBounds = { west: number; south: number; east: number; north: number };
export type HeatInput = {
  cells: string[];
  /** Percentile rank 0–1 per cell. */
  values: number[];
  /** Cells with nothing to rate (shown grey, never blended into coloured neighbours). */
  noData: boolean[];
};

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const RAMP = BAND_COLORS.map(rgb);
const NO_DATA_RGB = rgb(NO_DATA_COLOR);

/** Continuous red → green colour for a percentile (band colours sit at the band mid-points). */
export function rampColor(v: number): [number, number, number] {
  const pos = Math.min(BAND_COUNT - 1, Math.max(0, v * BAND_COUNT - 0.5));
  const i = Math.min(BAND_COUNT - 2, Math.floor(pos));
  const t = pos - i;
  return [0, 1, 2].map((k) => Math.round(RAMP[i][k] + (RAMP[i + 1][k] - RAMP[i][k]) * t)) as [number, number, number];
}

/**
 * Rasterise per-hex values into a smooth RGBA field (Gaussian blend of nearby hex centres).
 * Pixels with no hex nearby stay transparent. Row 0 is the northern edge.
 */
export function heatPixels(
  { cells, values, noData }: HeatInput,
  bounds: HeatBounds,
  width: number,
): { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> } {
  const midLat = (bounds.south + bounds.north) / 2;
  const kmLng = 111.32 * Math.cos((midLat * Math.PI) / 180);
  const kmLat = 110.57;
  const height = Math.max(1, Math.round((width * (bounds.north - bounds.south) * kmLat) / ((bounds.east - bounds.west) * kmLng)));
  const data = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  const k = 1 / (2 * SIGMA_KM * SIGMA_KM);
  const pxKmX = ((bounds.east - bounds.west) * kmLng) / width;
  const pxKmY = ((bounds.north - bounds.south) * kmLat) / height;
  const rx = Math.ceil((SIGMA_KM * 3) / pxKmX);
  const ry = Math.ceil((SIGMA_KM * 3) / pxKmY);
  // Splat each hex's Gaussian onto the pixels around its centre.
  const wSum = new Float32Array(width * height);
  const wData = new Float32Array(width * height);
  const vSum = new Float32Array(width * height);
  cells.forEach((cell, i) => {
    const [lat, lng] = cellToLatLng(cell);
    const cx = Math.floor(((lng - bounds.west) / (bounds.east - bounds.west)) * width);
    const cy = Math.floor(((bounds.north - lat) / (bounds.north - bounds.south)) * height);
    for (let y = Math.max(0, cy - ry); y <= Math.min(height - 1, cy + ry); y++) {
      const dy = (y + 0.5 - ((bounds.north - lat) / (bounds.north - bounds.south)) * height) * pxKmY;
      for (let x = Math.max(0, cx - rx); x <= Math.min(width - 1, cx + rx); x++) {
        const dx = (x + 0.5 - ((lng - bounds.west) / (bounds.east - bounds.west)) * width) * pxKmX;
        const w = Math.exp(-(dx * dx + dy * dy) * k);
        const j = y * width + x;
        wSum[j] += w;
        if (!noData[i]) {
          wData[j] += w;
          vSum[j] += w * values[i];
        }
      }
    }
  });
  for (let j = 0; j < width * height; j++) {
    if (wSum[j] < 1e-3) continue;
    const o = j * 4;
    if (wData[j] < wSum[j] / 2) {
      [data[o], data[o + 1], data[o + 2]] = NO_DATA_RGB;
      data[o + 3] = NO_DATA_ALPHA;
    } else {
      [data[o], data[o + 1], data[o + 2]] = rampColor(vSum[j] / wData[j]);
      data[o + 3] = ALPHA;
    }
  }
  return { width, height, data };
}

/** Browser only: the field as a PNG data URL, clipped to the given outline ring ([lng, lat][]). */
export function heatDataUrl(input: HeatInput, bounds: HeatBounds, ring: number[][], width = 520): string {
  const { height, data } = heatPixels(input, bounds, width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(new ImageData(data, width, height), 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ring.forEach(([lng, lat], i) => {
    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * width;
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  return canvas.toDataURL("image/png");
}
