"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Bike,
  Landmark,
  ShoppingBag,
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
import { normalizeWeights } from "@/lib/scoring/weights";
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

export function PreferencesForm({ initial }: { initial?: Importance }) {
  const router = useRouter();
  const { control, handleSubmit, setValue } = useForm<Importance>({
    resolver: zodResolver(importanceSchema),
    defaultValues: snapAll(initial ?? DEFAULT_IMPORTANCE),
  });
  const values = useWatch({ control }) as Importance;
  const weights = normalizeWeights({ ...DEFAULT_IMPORTANCE, ...values });

  const onSubmit = (data: Importance) => {
    router.push(`/map?${importanceToQuery(data)}`);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-3xl border border-border/70 bg-white/80 p-6 shadow-xl shadow-emerald-900/5 backdrop-blur sm:p-8"
    >
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight">
          What matters to you?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set how important each thing is. We turn it into weights for your map.
        </p>
      </div>

      <PreferencesChat
        onImportance={(i) => {
          for (const c of CATEGORIES) setValue(c, snapImportance(i[c]), { shouldDirty: true });
        }}
      />

      <ul className="space-y-5">
        {CATEGORIES.map((c) => {
          const Icon = ICONS[c];
          return (
            <li key={c}>
              <div className="mb-2 flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{CATEGORY_LABELS[c]}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {HINTS[c]}
                  </div>
                </div>
                <span className="w-10 text-right text-sm font-semibold tabular-nums">
                  {Math.round(weights[c] * 100)}%
                </span>
              </div>
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

      <Button
        type="submit"
        size="lg"
        className="mt-8 h-11 w-full gap-2 rounded-xl bg-emerald-600 text-base text-white hover:bg-emerald-700"
      >
        Explore my Kraków
        <ArrowRight className="size-4" />
      </Button>
    </form>
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
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1">
        {IMPORTANCE_STEPS.map((step) => {
          const active = snapImportance(value) === step;
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(step)}
              className={
                "h-8 rounded-lg border text-xs font-medium tabular-nums transition-colors " +
                (active
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-border bg-white text-muted-foreground hover:border-emerald-300 hover:bg-emerald-50")
              }
            >
              {step}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>Don’t care</span>
        <span>Essential</span>
      </div>
    </div>
  );
}
