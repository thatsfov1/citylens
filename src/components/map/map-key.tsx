"use client";

import { Plus, ShieldCheck, TriangleAlert, Wind } from "lucide-react";
import { keySections, type KeyContext, type KeySymbol } from "@/lib/map/key";

const BADGE = "grid h-5 min-w-5 place-items-center rounded-full border border-border/70 bg-white px-1 text-slate-900 shadow";

function Symbol({ symbol }: { symbol: KeySymbol }) {
  switch (symbol.kind) {
    case "dots":
      return (
        <span className="flex w-6 flex-wrap justify-center gap-0.5">
          {symbol.colors.map((c) => (
            <span key={c} className="size-1.5 rounded-full" style={{ background: c }} />
          ))}
        </span>
      );
    case "letter":
      return (
        <span className="grid h-5 min-w-5 place-items-center rounded-full border-2 border-white px-1 text-[8px] font-bold text-white shadow" style={{ background: symbol.bg }}>
          {symbol.text}
        </span>
      );
    case "dot":
      return <span className="size-2.5 rounded-full border border-white shadow" style={{ background: symbol.color }} />;
    case "badge":
      return (
        <span className={BADGE}>
          {symbol.icon === "safety" && <ShieldCheck className="size-3" />}
          {symbol.icon === "air" && <Wind className="size-3" />}
          {symbol.icon === "works" && <TriangleAlert className="size-3 text-amber-600" />}
          {symbol.icon === "compare" && <Plus className="size-3" />}
        </span>
      );
    case "line":
      return <span className="block h-0 w-6 border-t-2" style={{ borderColor: symbol.color, borderStyle: symbol.dashed ? "dashed" : "solid" }} />;
    case "ring":
      return <span className="block size-5 rounded-full border border-dashed border-slate-600" />;
    case "outline":
      return (
        <span
          className="block h-3.5 w-6 rounded-sm border-2"
          style={{ borderColor: symbol.color, borderStyle: symbol.dashed ? "dashed" : "solid" }}
        />
      );
  }
}

/** What each symbol on the map means; lists only what is on the map right now. */
export function MapKey({ ctx }: { ctx: KeyContext }) {
  const sections = keySections(ctx);
  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <section key={s.id} aria-label={s.title}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.title}</h3>
          <ul className="mt-1 space-y-1.5">
            {s.entries.map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <span className="mt-0.5 flex w-7 shrink-0 justify-center">
                  <Symbol symbol={e.symbol} />
                </span>
                <span className="min-w-0 text-[11px] leading-snug">
                  <span className="font-medium text-slate-900">{e.label}.</span> <span className="text-muted-foreground">{e.meaning}</span>
                </span>
              </li>
            ))}
          </ul>
          {s.note && <p className="mt-1 text-[10px] italic leading-snug text-muted-foreground">{s.note}</p>}
        </section>
      ))}
    </div>
  );
}
