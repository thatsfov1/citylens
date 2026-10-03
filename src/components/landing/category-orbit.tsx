"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, type Category } from "@/types";
import {
  CATEGORY_PL,
  CATEGORY_STYLE,
  LEVELS,
  LEVEL_NAMES,
  levelToPercent,
  type Level,
  type Levels,
} from "./landing-copy";

// Emoji render as Apple Color Emoji on macOS / iOS.
const EMOJI: Record<Category, string> = {
  sport: "🏃",
  culture: "🎭",
  greenery: "🌳",
  shopping: "🛍️",
  transport: "🚋",
};

/** How the panel was opened: hover closes it again when the pointer leaves, the others don't. */
export type OpenVia = "hover" | "click" | "external";
export type OpenState = { category: Category; via: OpenVia } | null;

type Props = {
  levels: Levels;
  open: OpenState;
  onOpenChange: (open: OpenState) => void;
  onConfirm: (category: Category, level: Level) => void;
};

export function CategoryOrbit({ levels, open, onOpenChange, onConfirm }: Props) {
  return (
    <ul aria-label="Kategorie" className="flex flex-wrap items-start justify-center gap-x-2 gap-y-3 sm:gap-x-4">
      {CATEGORIES.map((c, i) => (
        <li key={c}>
          <CategoryBubble
            category={c}
            index={i}
            value={levels[c]}
            open={open?.category === c ? open : null}
            onOpenChange={onOpenChange}
            onConfirm={onConfirm}
          />
        </li>
      ))}
    </ul>
  );
}

function CategoryBubble({
  category,
  index,
  value,
  open,
  onOpenChange,
  onConfirm,
}: {
  category: Category;
  index: number;
  value: Level | undefined;
  open: OpenState;
  onOpenChange: (open: OpenState) => void;
  onConfirm: (category: Category, level: Level) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Focusing the trigger programmatically (after closing) must not reopen the panel.
  const suppressFocusOpen = useRef(false);
  const style = CATEGORY_STYLE[category];
  const { label } = CATEGORY_PL[category];

  // Opened from outside (e.g. a chip in the chat): bring the icon into view and focus it.
  useEffect(() => {
    if (open?.via !== "external") return;
    suppressFocusOpen.current = true;
    triggerRef.current?.focus();
    suppressFocusOpen.current = false;
    wrapperRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [open]);

  function close() {
    onOpenChange(null);
    suppressFocusOpen.current = true;
    triggerRef.current?.focus();
    suppressFocusOpen.current = false;
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex w-[4.25rem] flex-col items-center sm:w-20"
      onPointerEnter={(e) => {
        // Below lg the panel is a centred overlay, so hover-to-open would close as the mouse crosses the gap.
        if (e.pointerType === "mouse" && !open && window.matchMedia("(min-width: 1024px)").matches) onOpenChange({ category, via: "hover" });
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse" && open?.via === "hover") onOpenChange(null);
      }}
      onBlur={(e) => {
        if (open && !wrapperRef.current?.contains(e.relatedTarget as Node | null)) onOpenChange(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={!!open}
        aria-label={
          value
            ? `${label}: ${levelToPercent(value)}% ważności. Zmień ustawienie`
            : `${label}. Ustaw ważność`
        }
        onFocus={() => {
          if (!suppressFocusOpen.current && !open) onOpenChange({ category, via: "click" });
        }}
        onClick={() => {
          if (!open) onOpenChange({ category, via: "click" });
          else if (open.via === "hover") onOpenChange({ category, via: "click" });
        }}
        className="group flex flex-col items-center gap-1.5 rounded-3xl p-1 outline-none focus-visible:ring-4 focus-visible:ring-coral/60"
      >
        <span
          className={cn(
            "animate-float relative flex size-12 items-center justify-center rounded-full border-2 shadow-md shadow-black/30 backdrop-blur transition-transform group-hover:scale-110 group-active:scale-95 sm:size-14",
            style.tile,
          )}
          style={{ animationDelay: `${-index * 1.1}s` }}
        >
          <span aria-hidden className="text-2xl leading-none sm:text-3xl">{EMOJI[category]}</span>
          {value && (
            <span className="animate-pop absolute -right-2 -top-2 rounded-full border-2 border-ink bg-coral px-1.5 text-[11px] font-semibold leading-5 text-ink">
              {levelToPercent(value)}%
            </span>
          )}
        </span>
        <span className="text-xs font-semibold text-mist [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">{label}</span>
      </button>

      {open && (
        <LevelPanel
          category={category}
          saved={value}
          onClose={close}
          onConfirm={(level) => {
            onConfirm(category, level);
            close();
          }}
        />
      )}
    </div>
  );
}

function LevelPanel({
  category,
  saved,
  onClose,
  onConfirm,
}: {
  category: Category;
  saved: Level | undefined;
  onClose: () => void;
  onConfirm: (level: Level) => void;
}) {
  const [draft, setDraft] = useState<Level | null>(saved ?? null);
  const [hovered, setHovered] = useState<Level | null>(null);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const style = CATEGORY_STYLE[category];
  const { label, hint } = CATEGORY_PL[category];
  const shown = hovered ?? draft;

  function onRadioKey(e: KeyboardEvent<HTMLDivElement>) {
    const dir = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = Math.min(5, Math.max(1, (draft ?? (dir > 0 ? 0 : 6)) + dir)) as Level;
    setDraft(next);
    radioRefs.current[next - 1]?.focus();
  }

  return (
    <div
      role="dialog"
      aria-label={`Ważność kategorii ${label}`}
      className={cn(
        "animate-expand fixed left-1/2 top-1/2 z-40 w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border-2 bg-ink p-4 text-mist shadow-2xl shadow-black/50",
        "lg:absolute lg:left-1/2 lg:top-0 lg:translate-y-[-1rem]",
        style.tile.split(" ")[1],
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full border-2", style.tile)}>
          <span aria-hidden className="text-2xl leading-none">{EMOJI[category]}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-mist">{label}</p>
          <p className="text-xs leading-snug text-mist/70">{hint}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="-mr-1 -mt-1 rounded-full p-1.5 text-mist/70 outline-none hover:bg-white/10 focus-visible:ring-4 focus-visible:ring-coral/60"
        >
          <X className="size-4" />
        </button>
      </div>

      <p className="mt-3 text-sm font-medium text-mist">Jak ważna jest dla Ciebie ta kategoria?</p>
      <div
        role="radiogroup"
        aria-label={`Ważność: ${label}`}
        onKeyDown={onRadioKey}
        onPointerLeave={() => setHovered(null)}
        className="mt-2 flex items-end justify-between gap-1.5"
      >
        {LEVELS.map((n) => {
          const filled = shown !== null && n <= shown;
          return (
            <button
              key={n}
              ref={(el) => {
                radioRefs.current[n - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={draft === n}
              aria-label={`${levelToPercent(n)}%, ${LEVEL_NAMES[n]}`}
              tabIndex={(draft ?? 1) === n ? 0 : -1}
              onClick={() => setDraft(n)}
              onPointerEnter={() => setHovered(n)}
              onFocus={() => setHovered(null)}
              className={cn(
                "flex-1 rounded-xl border-2 outline-none transition-all duration-150 focus-visible:ring-4 focus-visible:ring-coral/60",
                filled ? cn(style.fill, "border-white/20") : "border-white/20 bg-white/10 hover:bg-white/20",
                draft === n && "ring-2 ring-mist ring-offset-2 ring-offset-ink",
              )}
              style={{ height: `${1.75 + n * 0.5}rem` }}
            />
          );
        })}
      </div>
      <p aria-live="polite" className="mt-2 h-5 text-center text-sm font-semibold text-mist">
        {shown ? `${levelToPercent(shown)}% ważności, ${LEVEL_NAMES[shown]}` : "Wybierz poziom"}
      </p>

      <button
        type="button"
        disabled={draft === null}
        onClick={() => draft && onConfirm(draft)}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-coral text-sm font-semibold text-ink outline-none transition hover:bg-coral/85 focus-visible:ring-4 focus-visible:ring-coral/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-mist/50"
      >
        <Check className="size-4" />
        {saved ? "Zaktualizuj" : "Zatwierdź"}
      </button>
    </div>
  );
}
