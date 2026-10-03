"use client";

import Link from "next/link";
import { plPlural } from "@/lib/format/pl";
import { Check, Users, X } from "lucide-react";

type Props = {
  compared: number;
  hasArea: boolean;
  /** Link back to the start page with the same preferences. */
  adjustHref: string;
  saved: boolean;
  onSave: () => void;
  onDismiss: () => void;
};

/** Shown once to someone who opened a shared link: what they are looking at, and what they can do with it. */
export function SharedBanner({ compared, hasArea, adjustHref, saved, onSave, onDismiss }: Props) {
  const parts = ["preferencje i filtry", compared > 0 ? `${compared} ${plPlural(compared, "porównywany obszar", "porównywane obszary", "porównywanych obszarów")}` : null, hasArea && compared === 0 ? "otwarty obszar" : null].filter(Boolean);
  return (
    <section
      role="status"
      className="pointer-events-auto absolute left-1/2 top-[7.75rem] z-20 flex w-[min(30rem,calc(100vw-1.5rem))] -translate-x-1/2 items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 shadow-xl backdrop-blur sm:top-[4.25rem]"
    >
      <Users className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium text-emerald-900">Udostępniono Tobie</div>
        <p className="text-xs text-emerald-900/80">Oglądasz czyjś wybór ({parts.join(", ")}). Możesz wszystko zmienić, nie wpłynie to na udostępniony link.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link href={adjustHref} className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800">
            Zmień preferencje
          </Link>
          <button
            type="button"
            onClick={onSave}
            disabled={saved}
            className="flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-70"
          >
            {saved && <Check className="size-3" />}
            {saved ? "Zapisano na tym urządzeniu" : "Zapisz kopię"}
          </button>
        </div>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Zamknij" className="rounded-full p-1 text-emerald-900/70 hover:bg-emerald-100">
        <X className="size-4" />
      </button>
    </section>
  );
}
