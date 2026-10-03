"use client";

import { CATEGORY_LABELS, type Category, type PlacesResponse } from "@/types";
import { GREEN_COLOR, PLACE_COLORS, formatDistance, kindLabel, placeTitle } from "@/lib/map/places";
import { cn } from "@/lib/utils";

const COLORS: Record<Category, string> = { ...PLACE_COLORS, greenery: GREEN_COLOR };
const ORDER: Category[] = ["greenery", "sport", "culture", "shopping", "transport"];

type Props = {
  places: PlacesResponse;
  active: ReadonlySet<Category>;
  onToggle: (c: Category) => void;
  hovered: number | null;
  onHover: (id: number | null) => void;
  onFocus: (id: number) => void;
};

/** Category chips (what is pinned on the map) + the places grouped by category. */
export function PlacesList({ places, active, onToggle, hovered, onHover, onFocus }: Props) {
  const parks = places.green.features;
  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold">Places behind these scores</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ORDER.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={active.has(c)}
            onClick={() => onToggle(c)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              active.has(c) ? "border-slate-800 bg-slate-800 text-white" : "border-border bg-white hover:bg-muted",
            )}
          >
            <span className="size-2 rounded-full" style={{ background: COLORS[c] }} />
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {ORDER.filter((c) => active.has(c)).map((c) => {
        const items = c === "greenery" ? [] : places.places.filter((p) => p.category === c);
        if (c === "greenery" ? parks.length === 0 : items.length === 0) {
          return (
            <p key={c} className="mt-3 text-xs text-muted-foreground">
              {CATEGORY_LABELS[c]}: nothing within reach.
            </p>
          );
        }
        return (
          <div key={c} className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABELS[c]}
            </div>
            <ul className="mt-1">
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
          </div>
        );
      })}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Dashed rings mark 500 m and 1 km from the area’s centre. Source: OpenStreetMap.
      </p>
    </section>
  );
}
