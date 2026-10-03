import { cellPolygon, getDemoCells } from "@/lib/h3/grid";
import { getMockScores } from "@/lib/mock-data/mock-scores";

const WIDTH = 640;
const HEIGHT = 252;
const PAD = 18;

/** A static, data-shaped preview of the H3 map that users will explore. */
export function LandingMapPreview() {
  const cells = getDemoCells();
  const polygons = cells.map((id) => ({ id, points: cellPolygon(id), score: getMockScores(id).greenery }));
  const coords = polygons.flatMap(({ points }) => points);
  const minLng = Math.min(...coords.map(([lng]) => lng));
  const maxLng = Math.max(...coords.map(([lng]) => lng));
  const minLat = Math.min(...coords.map(([, lat]) => lat));
  const maxLat = Math.max(...coords.map(([, lat]) => lat));
  const scale = Math.min((WIDTH - PAD * 2) / (maxLng - minLng), (HEIGHT - PAD * 2) / (maxLat - minLat));
  const mapWidth = (maxLng - minLng) * scale;
  const mapHeight = (maxLat - minLat) * scale;
  const xOffset = (WIDTH - mapWidth) / 2;
  const yOffset = (HEIGHT - mapHeight) / 2;
  const project = ([lng, lat]: [number, number]) => `${xOffset + (lng - minLng) * scale},${yOffset + (maxLat - lat) * scale}`;

  return (
    <div className="mt-6 w-full max-w-2xl overflow-hidden border border-slate-200 bg-white/75 shadow-lg shadow-emerald-950/5 backdrop-blur">
      <div className="flex items-center justify-between px-4 pb-1 pt-3 sm:px-5">
        <div>
          <p className="text-sm font-normal text-slate-900">A city, seen your way</p>
          <p className="mt-0.5 text-xs text-slate-500">Every hexagon reflects a different area match</p>
        </div>
        <span className="inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 text-[11px] font-normal text-emerald-800">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Kraków
        </span>
      </div>
      <div className="relative px-2 sm:px-3">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Preview of Kraków divided into colored H3 area matches" className="h-auto w-full">
          <defs>
            <linearGradient id="preview-bg" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#f0fdfa" />
              <stop offset="1" stopColor="#eff6ff" />
            </linearGradient>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="url(#preview-bg)" />
          <path d="M30 215 C140 180 185 206 283 143 S451 116 612 52 M26 74 C136 117 228 94 330 157 S473 208 612 226" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 8" opacity=".5" />
          {polygons.map(({ id, points, score }) => (
            <polygon
              key={id}
              points={points.map(project).join(" ")}
              fill={score >= 70 ? "#10b981" : score >= 45 ? "#6ee7b7" : score >= 25 ? "#a7f3d0" : "#d1fae5"}
              fillOpacity={score >= 70 ? 0.9 : 0.72}
              stroke="white"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
          ))}
          <g transform="translate(335 136)">
            <circle r="19" fill="#047857" fillOpacity=".15" />
            <circle r="8" fill="#047857" stroke="white" strokeWidth="3" />
          </g>
        </svg>
        <div className="absolute bottom-4 right-4 flex items-center gap-2 border border-white/80 bg-white/90 px-3 py-2 shadow-lg shadow-slate-900/10 backdrop-blur">
          <span className="grid size-8 place-items-center bg-emerald-100 text-xs font-normal text-emerald-800">87</span>
          <span className="text-xs font-normal text-slate-700">Strong match</span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3 pt-1 sm:px-5">
        <span className="h-1.5 w-20 rounded-full bg-gradient-to-r from-emerald-100 via-emerald-400 to-emerald-700" />
        <span className="text-[11px] text-slate-500">Weaker fit</span>
        <span className="ml-auto text-[11px] text-slate-500">Stronger fit</span>
      </div>
    </div>
  );
}
