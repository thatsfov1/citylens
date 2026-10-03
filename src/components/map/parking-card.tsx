"use client";

import { useEffect, useState } from "react";
import { Car, ExternalLink, Info } from "lucide-react";
import { kindLabel, type ParkingData, type ParkingFacts } from "@/lib/scoring/parking";

/** The parking snapshot, loaded the first time it is needed so the first map load does not carry it. `null` = loading, `false` = failed. */
export function useParkingData(enabled: boolean): ParkingData | null | false {
  const [data, setData] = useState<ParkingData | null | false>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    import("@/lib/data/parking-data.json")
      .then((m) => alive && setData(m.default as unknown as ParkingData))
      .catch(() => alive && setData(false));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return data;
}

const SOURCES = {
  osm: { label: "OpenStreetMap contributors (ODbL)", href: "https://www.openstreetmap.org/copyright" },
  msip: { label: "City of Kraków GIS (MSIP), parking meters", href: "https://msip.um.krakow.pl/arcgis/rest/services/Obserwatorium/K04_PARKOMETRY/MapServer" },
  zdmk: { label: "Official paid parking area, rates and rules (ZDMK)", href: "https://zdmk.krakow.pl/parkowanie/strefa-platnego-parkowania/informacje-ogolne-i-oplaty/" },
};

const monthLabel = (ym: string | null) => {
  if (!ym) return null;
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

/** Parking around the open area, for renters with a car. Information only: no score, and always with its caveats and sources. */
export function ParkingCard({ facts, data, district }: { facts: ParkingFacts | null; data: ParkingData | null | false; district: string | null }) {
  const place = district ? `around this hexagon in ${district}` : "around this hexagon";
  return (
    <div className="mt-5 rounded-2xl border border-border/70 p-4">
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <Car className="size-4" />
        Parking for renters with a car
      </div>

      <div className="mt-2 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-900">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          <b>No guarantee.</b> This is a rough guide from public map data, not a promise of a free space. Free spaces,
          resident permits, opening hours and prices are not in the data, and it may be out of date or incomplete. Check on
          site before you rent. A garage space or resident permit is usually an <b>extra monthly cost</b>, so check what the
          listing includes.
        </p>
      </div>

      {data === false ? (
        <p className="mt-3 text-sm text-muted-foreground">The parking data could not be loaded. Everything else on the map still works.</p>
      ) : !facts ? (
        <p className="mt-3 text-sm text-muted-foreground">{data === null ? "Loading parking data…" : "Open an area to see parking around it."}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <div className="font-medium">Car parks and garages</div>
            {facts.availability.osm ? (
              <div className="text-muted-foreground">
                {facts.carParks.within1000 === 0
                  ? `None found within 1 km ${place} (OpenStreetMap).`
                  : `${facts.carParks.within500} within 500 m, ${facts.carParks.within1000} within 1 km${
                      facts.carParks.nearest ? `. Nearest ${kindLabel(facts.carParks.nearest.kind)} about ${metres(facts.carParks.nearest.distanceM)} away${facts.carParks.nearest.fee === 1 ? ", paid" : facts.carParks.nearest.fee === 0 ? ", free" : ""}` : ""
                    }.`}
                {facts.carParks.restricted > 0 && ` ${facts.carParks.restricted} more are private or for customers only and are not counted.`}
              </div>
            ) : (
              <div className="text-muted-foreground">No OpenStreetMap parking data loaded.</div>
            )}
          </li>
          <li>
            <div className="font-medium">Street parking</div>
            {facts.availability.osm ? (
              <div className="text-muted-foreground">
                {facts.streets.within500 === 0
                  ? "No street parking is mapped within 500 m. That may only mean it is not mapped."
                  : `Street parking is mapped along ${facts.streets.within500} street segments within 500 m${
                      facts.streets.paid + facts.streets.free > 0 ? ` (${facts.streets.paid} tagged paid, ${facts.streets.free} tagged free)` : ""
                    }. Spaces and prices are not known.`}
              </div>
            ) : (
              <div className="text-muted-foreground">No OpenStreetMap parking data loaded.</div>
            )}
          </li>
          <li>
            <div className="font-medium">Parking meters</div>
            {facts.availability.meters ? (
              <div className="text-muted-foreground">
                {facts.meters.within500 === 0
                  ? `No meters within 500 m in the city data${data ? ` (state ${monthLabel(data.metersAsOf)})` : ""}, so street parking here may be free, but that is not certain.`
                  : `${facts.meters.within500} within 500 m, so street parking here is probably paid. The meter data is from ${data ? monthLabel(data.metersAsOf) : "2019"}.`}
              </div>
            ) : (
              <div className="text-muted-foreground">No parking meter data loaded.</div>
            )}
          </li>
          <li>
            <div className="font-medium">Park and ride</div>
            <div className="text-muted-foreground">
              {!facts.availability.osm
                ? "No OpenStreetMap parking data loaded."
                : facts.parkRide.nearest
                  ? `Nearest: ${facts.parkRide.nearest.name}, about ${metres(facts.parkRide.nearest.distanceM)} in a straight line.`
                  : "None mapped nearby."}
            </div>
          </li>
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        Sources:{" "}
        {[
          { ...SOURCES.osm, date: data ? data.retrieved.osm : null },
          { ...SOURCES.msip, date: data ? monthLabel(data.metersAsOf) : null },
        ].map((s, i) => (
          <span key={s.href}>
            {i > 0 && "; "}
            <a href={s.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
              {s.label}
            </a>
            {s.date ? ` (${s.date})` : ""}
          </span>
        ))}
        . Distances are straight lines from the hexagon centre.
      </p>
      <a
        href={SOURCES.zdmk.href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
      >
        {SOURCES.zdmk.label}
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </div>
  );
}
