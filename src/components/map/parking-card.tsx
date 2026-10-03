"use client";

import { useEffect, useState } from "react";
import { Car, ExternalLink, Info } from "lucide-react";
import { dec } from "@/lib/format/pl";
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
  osm: { label: "współtwórcy OpenStreetMap (ODbL)", href: "https://www.openstreetmap.org/copyright" },
  msip: { label: "GIS Miasta Krakowa (MSIP), parkometry", href: "https://msip.um.krakow.pl/arcgis/rest/services/Obserwatorium/K04_PARKOMETRY/MapServer" },
  zdmk: { label: "Oficjalna strefa płatnego parkowania, opłaty i zasady (ZDMK)", href: "https://zdmk.krakow.pl/parkowanie/strefa-platnego-parkowania/informacje-ogolne-i-oplaty/" },
};

const monthLabel = (ym: string | null) => {
  if (!ym) return null;
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
};

const metres = (m: number) => (m >= 1000 ? `${dec(m / 1000)} km` : `${m} m`);

/** Parking around the open area, for renters with a car. Information only: no score, and always with its caveats and sources. */
export function ParkingCard({ facts, data, district }: { facts: ParkingFacts | null; data: ParkingData | null | false; district: string | null }) {
  const place = district ? `wokół tego sześciokąta (${district})` : "wokół tego sześciokąta";
  return (
    <div className="mt-5 rounded-2xl border border-border/70 p-4">
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <Car className="size-4" />
        Parkowanie dla najemców z samochodem
      </div>

      <div className="mt-2 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-900">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          <b>Bez gwarancji.</b> To orientacyjny przewodnik na podstawie publicznych danych mapowych, a nie obietnica wolnego
          miejsca. Wolnych miejsc, abonamentów dla mieszkańców, godzin otwarcia i cen nie ma w danych, a dane mogą być
          nieaktualne lub niepełne. Sprawdź na miejscu, zanim wynajmiesz. Miejsce w garażu lub abonament dla mieszkańców to
          zwykle <b>dodatkowy koszt miesięczny</b>, więc sprawdź, co obejmuje ogłoszenie.
        </p>
      </div>

      {data === false ? (
        <p className="mt-3 text-sm text-muted-foreground">Nie udało się wczytać danych o parkowaniu. Reszta mapy działa normalnie.</p>
      ) : !facts ? (
        <p className="mt-3 text-sm text-muted-foreground">{data === null ? "Wczytywanie danych o parkowaniu…" : "Otwórz obszar, aby zobaczyć parkowanie wokół niego."}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <div className="font-medium">Parkingi i garaże</div>
            {facts.availability.osm ? (
              <div className="text-muted-foreground">
                {facts.carParks.within1000 === 0
                  ? `Nie znaleziono w promieniu 1 km ${place} (OpenStreetMap).`
                  : `${facts.carParks.within500} w promieniu 500 m, ${facts.carParks.within1000} w promieniu 1 km${
                      facts.carParks.nearest ? `. Najbliżej: ${kindLabel(facts.carParks.nearest.kind)}, ok. ${metres(facts.carParks.nearest.distanceM)} stąd${facts.carParks.nearest.fee === 1 ? ", płatny" : facts.carParks.nearest.fee === 0 ? ", bezpłatny" : ""}` : ""
                    }.`}
                {facts.carParks.restricted > 0 && ` Kolejnych ${facts.carParks.restricted} jest prywatnych lub tylko dla klientów i nie są liczone.`}
              </div>
            ) : (
              <div className="text-muted-foreground">Nie wczytano danych o parkowaniu z OpenStreetMap.</div>
            )}
          </li>
          <li>
            <div className="font-medium">Parkowanie przy ulicy</div>
            {facts.availability.osm ? (
              <div className="text-muted-foreground">
                {facts.streets.within500 === 0
                  ? "W promieniu 500 m nie zmapowano parkowania przy ulicy. Może to oznaczać tylko brak w danych."
                  : `Parkowanie przy ulicy zmapowano na ${facts.streets.within500} odcinkach ulic w promieniu 500 m${
                      facts.streets.paid + facts.streets.free > 0 ? ` (${facts.streets.paid} oznaczonych jako płatne, ${facts.streets.free} jako bezpłatne)` : ""
                    }. Liczba miejsc i ceny nie są znane.`}
              </div>
            ) : (
              <div className="text-muted-foreground">Nie wczytano danych o parkowaniu z OpenStreetMap.</div>
            )}
          </li>
          <li>
            <div className="font-medium">Parkometry</div>
            {facts.availability.meters ? (
              <div className="text-muted-foreground">
                {facts.meters.within500 === 0
                  ? `Brak parkometrów w promieniu 500 m w danych miasta${data ? ` (stan: ${monthLabel(data.metersAsOf)})` : ""}, więc parkowanie przy ulicy może być tu bezpłatne, ale nie ma pewności.`
                  : `${facts.meters.within500} w promieniu 500 m, więc parkowanie przy ulicy jest tu prawdopodobnie płatne. Dane o parkometrach pochodzą z: ${data ? monthLabel(data.metersAsOf) : "2019"}.`}
              </div>
            ) : (
              <div className="text-muted-foreground">Nie wczytano danych o parkometrach.</div>
            )}
          </li>
          <li>
            <div className="font-medium">Parkuj i jedź (P+R)</div>
            <div className="text-muted-foreground">
              {!facts.availability.osm
                ? "Nie wczytano danych o parkowaniu z OpenStreetMap."
                : facts.parkRide.nearest
                  ? `Najbliżej: ${facts.parkRide.nearest.name}, ok. ${metres(facts.parkRide.nearest.distanceM)} w linii prostej.`
                  : "Brak zmapowanych w pobliżu."}
            </div>
          </li>
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        Źródła:{" "}
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
        . Odległości to linie proste od środka sześciokąta.
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
