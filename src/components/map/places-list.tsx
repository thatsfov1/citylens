"use client";

import { CATEGORY_LABELS, type Category, type PlacesResponse } from "@/types";
import { GREEN_COLOR, PLACE_COLORS, formatDistance, kindLabel, placeTitle } from "@/lib/map/places";
import { cn } from "@/lib/utils";

const COLORS: Record<Category, string> = { ...PLACE_COLORS, greenery: GREEN_COLOR };

type Props = {
  category: Category;
  places: PlacesResponse;
  hovered: number | null;
  onHover: (id: number | null) => void;
  onFocus: (id: number) => void;
};

/** The real places behind one category's score (the same ones pinned on the map). */
export function CategoryPlaces({ category: c, places, hovered, onHover, onFocus }: Props) {
  const parks = places.green.features;
  const items = c === "greenery" ? [] : places.places.filter((p) => p.category === c);
  const count = c === "greenery" ? parks.length : items.length;

  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold">
        Places behind this score <span className="font-normal text-muted-foreground">({count})</span>
      </h3>
      {count === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{CATEGORY_LABELS[c]}: nothing within reach.</p>
      ) : (
        <ul className="mt-1.5">
          {c === "greenery"
            ? parks.map((f, i) => (
                <li key={i} className="flex justify-between gap-3 py-1 text-sm">
                  <span className="truncate">{(f.properties?.name as string | null) ?? "Green area"}</span>
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                    {Number(f.properties?.areaHa).toFixed(1)} ha
                  </span>
                </li>
              ))
            : items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseEnter={() => onHover(p.id)}
                    onMouseLeave={() => onHover(null)}
                    onClick={() => onFocus(p.id)}
                    className={cn(
                      "flex w-full items-baseline justify-between gap-3 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted",
                      hovered === p.id && "bg-muted",
                    )}
                  >
                    <span className="min-w-0 truncate">
                      <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: COLORS[c] }} />
                      {placeTitle(p)}
                      {p.name && <span className="ml-1.5 text-xs text-muted-foreground">{kindLabel(p.kind)}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {formatDistance(p.distanceM)}
                    </span>
                  </button>
                </li>
              ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Dashed rings mark 500 m and 1 km from the area’s centre. Source: OpenStreetMap.
      </p>
    </section>
  );
}
