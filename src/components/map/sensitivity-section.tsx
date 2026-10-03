import { BAND_LABELS } from "@/lib/map/zones";
import type { Sensitivity } from "@/lib/scoring/sensitivity";
import { CATEGORY_LABELS } from "@/types";

/** "Jak stabilne jest to dopasowanie?": does the area keep its band if one priority is nudged one step? */
export function SensitivitySection({ sensitivity }: { sensitivity: Sensitivity }) {
  return (
    <section className="mt-5 rounded-2xl border border-border/70 p-3.5">
      <h3 className="text-sm font-semibold">Jak stabilne jest to dopasowanie?</h3>
      {sensitivity.stable ? (
        <p className="mt-1.5 text-sm text-slate-700">
          Pasuje do Twojego profilu konsekwentnie: zostaje w paśmie „{BAND_LABELS[sensitivity.baseBand].toLowerCase()}”,
          jeśli zmienisz dowolny priorytet o jeden stopień w górę lub w dół.
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-slate-700">
            To dopasowanie zależy od dokładnej proporcji Twoich priorytetów:
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {sensitivity.fragile.map((n) => (
              <li key={`${n.category}-${n.direction}`}>
                Jeśli ważność kategorii „{CATEGORY_LABELS[n.category]}” {n.direction === "more" ? "wzrośnie" : "spadnie"}:{" "}
                <span className="font-medium">{BAND_LABELS[n.band].toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Na podstawie pozycji tego obszaru wśród wszystkich obszarów Krakowa. Inna pozycja to inne dopasowanie, a nie gorsze miejsce.
      </p>
    </section>
  );
}
