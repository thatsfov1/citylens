"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Bike,
  Landmark,
  ShoppingBag,
  Sparkles,
  SlidersHorizontal,
  TrainFront,
  Trees,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreferencesChat } from "./preferences-chat";
import {
  DEFAULT_IMPORTANCE,
  IMPORTANCE_STEPS,
  importanceSchema,
  snapImportance,
  importanceToQuery,
  type Importance,
} from "@/lib/scoring/preferences";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/types";

const ICONS: Record<Category, LucideIcon> = {
  sport: Bike,
  culture: Landmark,
  greenery: Trees,
  shopping: ShoppingBag,
  transport: TrainFront,
};

const HINTS: Record<Category, string> = {
  sport: "Gyms, pitches, pools, running spots",
  culture: "Museums, theatres, cinemas, libraries",
  greenery: "Parks, gardens, forests nearby",
  shopping: "Supermarkets, shops, malls",
  transport: "Public transport stops and links",
};

// One colour per step of the importance scale: red (don't care) → green (essential).
const STEP_COLORS = ["bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-lime-500", "bg-emerald-600"];
const STEP_NAMES = ["Don’t care", "Low", "Medium", "High", "Essential"];

type Tab = "chat" | "manual";

export function PreferencesForm({ initial }: { initial?: Importance }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("chat");
  const { control, handleSubmit, setValue } = useForm<Importance>({
    resolver: zodResolver(importanceSchema),
    defaultValues: snapAll(initial ?? DEFAULT_IMPORTANCE),
  });

  const onSubmit = (data: Importance) => {
    router.push(`/map?${importanceToQuery(data)}`);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-3xl border border-border/70 bg-white/80 p-5 shadow-xl shadow-emerald-900/5 backdrop-blur"
    >
      <h2 className="text-lg font-semibold tracking-tight">What matters to you?</h2>

      <div role="tablist" className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm font-medium">
        <TabButton active={tab === "chat"} onClick={() => setTab("chat")} icon={Sparkles}>
          Describe it
        </TabButton>
        <TabButton active={tab === "manual"} onClick={() => setTab("manual")} icon={SlidersHorizontal}>
          Choose manually
        </TabButton>
      </div>

      {/* Both panels stay mounted so the chat keeps its history when switching tabs. */}
      <div className="mt-4 h-[19rem]">
        <div className={tab === "chat" ? "h-full" : "hidden"}>
          <PreferencesChat
            onImportance={(i) => {
              for (const c of CATEGORIES) setValue(c, snapImportance(i[c]), { shouldDirty: true });
            }}
            onReview={() => setTab("manual")}
          />
        </div>

        <div className={tab === "manual" ? "h-full" : "hidden"}>
          <ul className="space-y-3.5">
            {CATEGORIES.map((c) => {
              const Icon = ICONS[c];
              return (
                <li key={c} className="flex items-center gap-3" title={HINTS[c]}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Icon className="size-4" />
                  </span>
                  <span className="w-20 shrink-0 text-sm font-medium">{CATEGORY_LABELS[c]}</span>
                  <Controller
                    control={control}
                    name={c}
                    render={({ field }) => (
                      <ScaleSelect
                        label={`${CATEGORY_LABELS[c]} importance`}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </li>
              );
            })}
          </ul>
          <p className="mt-4 flex justify-between text-[11px] text-muted-foreground">
            <span>Don’t care</span>
            <span>Essential</span>
          </p>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="mt-4 h-11 w-full gap-2 rounded-xl bg-emerald-600 text-base text-white hover:bg-emerald-700"
      >
        Explore my Kraków
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-colors " +
        (active ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
      }
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

function snapAll(i: Importance): Importance {
  return Object.fromEntries(CATEGORIES.map((c) => [c, snapImportance(i[c])])) as Importance;
}

function ScaleSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const current = snapImportance(value);
  return (
    <div role="radiogroup" aria-label={label} className="grid flex-1 grid-cols-5 gap-1">
      {IMPORTANCE_STEPS.map((step, i) => {
        const active = current === step;
        return (
          <button
            key={step}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={STEP_NAMES[i]}
            title={STEP_NAMES[i]}
            onClick={() => onChange(step)}
            className={
              "h-7 rounded-md transition " +
              STEP_COLORS[i] +
              (active ? " ring-2 ring-slate-900/70 ring-offset-1" : " opacity-30 hover:opacity-60")
            }
          />
        );
      })}
    </div>
  );
}
