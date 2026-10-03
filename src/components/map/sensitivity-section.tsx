import { BAND_LABELS } from "@/lib/map/zones";
import type { Sensitivity } from "@/lib/scoring/sensitivity";
import { CATEGORY_LABELS } from "@/types";

/** "How stable is this match?": does the area keep its band if one priority is nudged one step? */
export function SensitivitySection({ sensitivity }: { sensitivity: Sensitivity }) {
  return (
    <section className="mt-5 rounded-2xl border border-border/70 p-3.5">
      <h3 className="text-sm font-semibold">How stable is this match?</h3>
      {sensitivity.stable ? (
        <p className="mt-1.5 text-sm text-slate-700">
          Fits your profile consistently: it stays a {BAND_LABELS[sensitivity.baseBand].toLowerCase()} if you
          nudge any priority up or down one step.
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-slate-700">
            This fit depends on the exact balance of your priorities:
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {sensitivity.fragile.map((n) => (
              <li key={`${n.category}-${n.direction}`}>
                If {CATEGORY_LABELS[n.category]} matters {n.direction}:{" "}
                <span className="font-medium">{BAND_LABELS[n.band].toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Based on how this area ranks among all Kraków areas. A different rank is a different fit, not a worse place.
      </p>
    </section>
  );
}
