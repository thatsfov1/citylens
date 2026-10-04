import boundary from "@/lib/h3/krakow-boundary.json";

// Kraków's real boundary, projected (equirectangular, longitude scaled by cos(lat)) and normalised to
// 0..1 so the same path serves as an objectBoundingBox clip-path and as the SVG outline.
const ring = boundary.coordinates[0] as number[][];
const lngs = ring.map((c) => c[0]);
const lats = ring.map((c) => c[1]);
const [minLng, maxLng, minLat, maxLat] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
const width = (maxLng - minLng) * Math.cos(midLat);
const height = maxLat - minLat;

export const KRAKOW_ASPECT = width / height;
const toPath = (xScale: number) =>
  ring
    .map(([lng, lat], i) => {
      const x = (((lng - minLng) / (maxLng - minLng)) * xScale).toFixed(4);
      const y = ((maxLat - lat) / height).toFixed(4);
      return `${i ? "L" : "M"}${x} ${y}`;
    })
    .join("") + "Z";
const PATH = toPath(1); // 0..1 box, for the clip-path
const OUTLINE = toPath(KRAKOW_ASPECT); // true proportions, so strokes are not distorted

const CLIP_ID = "krakow-clip";

/** A small map of Kraków's outline with the looping city video playing inside it. */
export function KrakowMap({ videoSrc = "/videos/krakow.mp4" }: { videoSrc?: string }) {
  return (
    <div className="relative" style={{ aspectRatio: KRAKOW_ASPECT, width: `min(100cqw, calc(100cqh * ${KRAKOW_ASPECT}))` }}>
      <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
        <clipPath id={CLIP_ID} clipPathUnits="objectBoundingBox">
          <path d={PATH} />
        </clipPath>
      </svg>

      <div className="absolute inset-0 overflow-hidden bg-ink" style={{ clipPath: `url(#${CLIP_ID})` }}>
        <video
          aria-hidden="true"
          tabIndex={-1}
          disablePictureInPicture
          className="size-full object-cover motion-reduce:hidden"
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      </div>

      <svg viewBox={`0 0 ${KRAKOW_ASPECT} 1`} className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
        <path d={OUTLINE} fill="none" stroke="#E9F1F4" strokeOpacity={0.7} strokeWidth={0.004} strokeLinejoin="round" />
      </svg>
    </div>
  );
}
