import boundary from "@/lib/h3/krakow-boundary.json";

/** Kraków's administrative outline (OSM), projected once to a 0..1 box with the right aspect ratio. */
const ring = boundary.coordinates[0] as number[][];
const lngs = ring.map((p) => p[0]);
const lats = ring.map((p) => p[1]);
const minLng = Math.min(...lngs);
const maxLng = Math.max(...lngs);
const minLat = Math.min(...lats);
const maxLat = Math.max(...lats);
const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
const widthKm = (maxLng - minLng) * Math.cos(midLat);
const heightKm = maxLat - minLat;
const ASPECT = widthKm / heightKm;

const PATH =
  ring
    .map(([lng, lat], i) => {
      const x = ((lng - minLng) / (maxLng - minLng)).toFixed(4);
      const y = ((maxLat - lat) / (maxLat - minLat)).toFixed(4);
      return `${i === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join("") + "Z";

/** The city outline with a looping video inside it. Decorative. */
export function KrakowShape({ videoSrc = "/videos/krakow.mp4" }: { videoSrc?: string }) {
  return (
    <div aria-hidden className="relative w-full" style={{ aspectRatio: ASPECT }}>
      <svg width="0" height="0" className="absolute">
        <defs>
          <clipPath id="krakow-clip" clipPathUnits="objectBoundingBox">
            <path d={PATH} />
          </clipPath>
        </defs>
      </svg>
      <div className="absolute inset-0 bg-black/10" style={{ clipPath: "url(#krakow-clip)" }}>
        <video
          className="size-full object-cover motion-reduce:hidden"
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      </div>
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
        <path d={PATH} fill="none" stroke="black" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
