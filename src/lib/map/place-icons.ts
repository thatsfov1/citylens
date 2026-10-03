import type { Map as MapLibreMap } from "maplibre-gl";
import type { PlaceCategory } from "@/types";
import { PLACE_COLORS } from "./places";

/** Glyph markup on a 24x24 grid (lucide-style: 2px round strokes, no fill). */
const GLYPHS = {
  bus: '<path d="M8 6v6M15 6v6M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2s-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  tram: '<rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16M12 3v8M8 19l-2 3M18 22l-2-3M8 15h.01M16 15h.01"/>',
  train: '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3M16 19l2 3M9 15h.01M15 15h.01"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  pitch: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.5"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  stadium: '<ellipse cx="12" cy="12" rx="9" ry="6"/><ellipse cx="12" cy="12" rx="4" ry="2"/>',
  pool: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  landmark: '<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7"/><path d="M12 2 3 8h18Z"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  mask: '<path d="M4 4h16v7a8 8 0 0 1-16 0z"/><path d="M8.5 9h.01M15.5 9h.01"/><path d="M8.5 14c2 1.5 5 1.5 7 0"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.2-1.7-.4-1 .2-2.3 1.5-2.3H17a4 4 0 0 0 4-4c0-5-4-10-9-10z"/><path d="M7.5 11h.01M10 7.5h.01M14 7.5h.01"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  store: '<path d="m3 9 1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M10 20v-5h4v5"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  baby: '<path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>',
  school: '<path d="M14 22v-4a2 2 0 1 0-4 0v4"/><path d="m18 10 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.382a1 1 0 0 1 .553-.894L6 10"/><path d="M18 5v17"/><path d="m4 6 8-4 8 4"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
} as const;

type Glyph = keyof typeof GLYPHS;

/** `kind` -> glyph per category; anything not listed gets the category fallback. */
const ICONS: Record<PlaceCategory, { fallback: Glyph; kinds: Record<string, Glyph> }> = {
  transport: {
    fallback: "pin",
    kinds: { tram_stop: "tram", bus_stop: "bus", rail_station: "train" },
  },
  sport: {
    fallback: "dumbbell",
    kinds: {
      pitch: "pitch",
      stadium: "stadium",
      swimming_pool: "pool",
      fitness_centre: "dumbbell",
      sports_centre: "dumbbell",
    },
  },
  culture: {
    fallback: "landmark",
    kinds: {
      museum: "landmark",
      gallery: "palette",
      arts_centre: "palette",
      theatre: "mask",
      cinema: "film",
      library: "book",
      music_venue: "music",
      concert_hall: "music",
      nightclub: "music",
      viewpoint: "eye",
    },
  },
  shopping: {
    fallback: "bag",
    kinds: {
      supermarket: "cart",
      convenience: "cart",
      mall: "store",
      department_store: "store",
    },
  },
  education: {
    fallback: "cap",
    kinds: {
      kindergarten: "baby",
      childcare: "baby",
      primary_school: "school",
      secondary_school: "school",
      school: "school",
      university: "cap",
      college: "cap",
    },
  },
};

const imageId = (category: PlaceCategory, glyph: Glyph) => `place-${category}-${glyph}`;

/** MapLibre image id for a place's pin; registered by `registerPlaceIcons`. */
export function placeIconId(category: PlaceCategory, kind: string): string {
  const { fallback, kinds } = ICONS[category];
  return imageId(category, kinds[kind] ?? fallback);
}

const SIZE = 48; // logical px; rasterised at 2x

function badgeSvg(color: string, glyph: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE * 2}" height="${SIZE * 2}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<circle cx="24" cy="24" r="21.5" fill="#fff" stroke="${color}" stroke-width="3"/>` +
    `<g transform="translate(12 12)" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>` +
    `</svg>`
  );
}

function rasterise(svg: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image(SIZE * 2, SIZE * 2);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SIZE * 2;
      canvas.height = SIZE * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.drawImage(img, 0, 0, SIZE * 2, SIZE * 2);
      resolve(ctx.getImageData(0, 0, SIZE * 2, SIZE * 2));
    };
    img.onerror = () => reject(new Error("icon rasterisation failed"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Adds one badge image (category colour + white glyph) per category/glyph pair. Safe to call once per map. */
export async function registerPlaceIcons(map: MapLibreMap): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const category of Object.keys(ICONS) as PlaceCategory[]) {
    const { fallback, kinds } = ICONS[category];
    for (const glyph of new Set<Glyph>([fallback, ...Object.values(kinds)])) {
      const id = imageId(category, glyph);
      jobs.push(
        rasterise(badgeSvg(PLACE_COLORS[category], GLYPHS[glyph])).then((data) => {
          if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio: 2 });
        }),
      );
    }
  }
  await Promise.all(jobs);
}
