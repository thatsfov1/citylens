import { BAND_COLORS } from "@/lib/map/zones";

const COLS = 7;
const ROWS = 8;
const SQRT3 = Math.sqrt(3);
const GAP = 0.94;

/** Mixes a #rrggbb colour toward white, for the pastel look. */
function pastel(hex: string, amount = 0.35): string {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(v + (255 - v) * amount);
  };
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
}

/** Deterministic 0..1 hash, so server and client render the same field. */
function hash(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

type Hex = { key: string; points: string; color: string; delay: number; duration: number };

function buildHexes(): { hexes: Hex[]; minX: number; minY: number; width: number; height: number } {
  const hexes: Hex[] = [];
  const cx = (COLS * SQRT3) / 2;
  const cy = ROWS * 0.75;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * SQRT3 + (row % 2 ? SQRT3 / 2 : 0) + SQRT3 / 2;
      const y = row * 1.5 + 1;
      // Soft blob instead of a rectangle.
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      if (dx * dx + dy * dy > 1.05 + 0.25 * hash(col, row)) continue;

      // Smooth field -> heatmap band, like the match bands on the app map.
      const v = 0.5 + (Math.sin(0.75 * x) + Math.sin(0.6 * y + 1) + Math.sin(0.42 * (x + y) + 2)) / 6;
      const band = Math.min(BAND_COLORS.length - 1, Math.max(0, Math.floor(v * BAND_COLORS.length)));

      const points = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 180) * (60 * i - 30);
        return `${(x + Math.cos(a) * GAP).toFixed(3)},${(y + Math.sin(a) * GAP).toFixed(3)}`;
      }).join(" ");
      minX = Math.min(minX, x - 1);
      maxX = Math.max(maxX, x + 1);
      minY = Math.min(minY, y - 1);
      maxY = Math.max(maxY, y + 1);
      hexes.push({
        key: `${col}-${row}`,
        points,
        color: pastel(BAND_COLORS[band]),
        delay: -hash(row, col) * 9,
        duration: 5 + hash(col + 3, row + 7) * 5,
      });
    }
  }
  return { hexes, minX, minY, width: maxX - minX, height: maxY - minY };
}

const FIELD = buildHexes();

/** Large hexagons that light up and fade out one by one, coloured like the match bands of the map. Decorative. */
export function HexField() {
  const { hexes, minX, minY, width, height } = FIELD;
  return (
    <svg
      aria-hidden
      viewBox={`${minX.toFixed(2)} ${minY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`}
      className="w-full"
      style={{ aspectRatio: width / height }}
    >
      <g>
        {hexes.map((h) => (
          <polygon
            key={h.key}
            points={h.points}
            fill={h.color}
            className="animate-hex-glow"
            style={{ animationDelay: `${h.delay.toFixed(2)}s`, animationDuration: `${h.duration.toFixed(2)}s` }}
          />
        ))}
      </g>
    </svg>
  );
}
