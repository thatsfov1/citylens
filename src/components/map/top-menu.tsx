"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, EyeOff, Menu, SlidersHorizontal } from "lucide-react";

type Props = {
  preferencesHref: string;
  /** Omitted when the map has no filters to offer. */
  onFilters?: () => void;
  activeFilters: number;
  onMapOnly: () => void;
};

const item =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-muted";

/** Rarely used top-bar actions folded into one icon button; a badge keeps active filters visible. */
export function TopMenu({
  preferencesHref,
  onFilters,
  activeFilters,
  onMapOnly,
}: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={root} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu"
        title="Menu"
        className={`relative flex size-10 items-center justify-center rounded-full border shadow-lg shadow-black/5 backdrop-blur ${
          open
            ? "border-slate-800 bg-slate-800 text-white"
            : "border-border/70 bg-white/90 text-slate-700 hover:bg-white"
        }`}
      >
        <Menu className="size-4" />
        {activeFilters > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-semibold text-white">
            {activeFilters}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-2 w-56 rounded-2xl border border-border/70 bg-white/95 p-1.5 shadow-2xl backdrop-blur"
        >
          <Link role="menuitem" href={preferencesHref} className={item}>
            <ArrowLeft className="size-4" />
            Zmień preferencje
          </Link>
          {onFilters && (
            <button
              type="button"
              role="menuitem"
              onClick={run(onFilters)}
              className={item}
            >
              <SlidersHorizontal className="size-4" />
              Filtry{activeFilters > 0 ? ` · ${activeFilters}` : ""}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={run(onMapOnly)}
            className={item}
          >
            <EyeOff className="size-4" />
            Sama mapa
          </button>
        </div>
      )}
    </div>
  );
}
