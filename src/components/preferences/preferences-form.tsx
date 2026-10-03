"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Bike,
  GraduationCap,
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
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/types";

const ICONS: Record<Category, LucideIcon> = {
  sport: Bike,
  culture: Landmark,
  greenery: Trees,
  shopping: ShoppingBag,
  transport: TrainFront,
  education: GraduationCap,
};

const HINTS: Record<Category, string> = {
  sport: "Gyms, pitches, pools, running spots",
  culture: "Museums, theatres, cinemas, libraries",
  greenery: "Parks, gardens, forests nearby",
  shopping: "Supermarkets, shops, malls",
  transport: "Public transport stops and links",
  education: "Kindergartens, schools, universities nearby",
};

// One colour per step of the importance scale: red (don't care) → green (essential).
const STEP_COLORS = ["bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-lime-500", "bg-emerald-600"];
const STEP_NAMES = ["Don’t care", "Low", "Medium", "High", "Essential"];

export function PreferencesForm({ initial }: { initial?: Importance }) {
  const router = useRouter();
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
      className="border border-slate-200 bg-white/90 p-4 shadow-lg shadow-emerald-950/5 backdrop-blur sm:p-5"
    >
      <div className="mb-3">
        <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-emerald-700">Make it yours</p>
        <h2 className="mt-1 text-xl font-normal tracking-tight">What matters to you?</h2>
        <p className="mt-1 text-sm font-light text-slate-500">Tell us in your own words, or set each priority below.</p>
      </div>

      <div className="h-48">
        <PreferencesChat
          onImportance={(i) => {
            for (const c of CATEGORIES) setValue(c, snapImportance(i[c]), { shouldDirty: true });
          }}
        />
      </div>

      <p className="mt-4 text-xs font-normal text-slate-500">Fine-tune your priorities</p>
      <ul className="mt-2 space-y-3">
        {CATEGORIES.map((c) => {
          const Icon = ICONS[c];
          return (
            <li key={c} className="flex items-center gap-2.5" title={HINTS[c]}>
              <span className="flex size-7 shrink-0 items-center justify-center bg-emerald-50 text-emerald-700">
                <Icon className="size-3.5" />
              </span>
              <Controller
                control={control}
                name={c}
                render={({ field }) => (
                  <>
                    <span className="w-[4.5rem] shrink-0">
                      <span className="block text-sm font-normal leading-tight">{CATEGORY_LABELS[c]}</span>
                      <span className="mt-1 block text-[10px] leading-tight text-slate-500">
                        {STEP_NAMES[IMPORTANCE_STEPS.findIndex((step) => step === snapImportance(field.value))]}
                      </span>
                    </span>
                    <ScaleSelect
                      label={`${CATEGORY_LABELS[c]} importance`}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </>
                )}
              />
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex justify-between pl-[calc(1.75rem+0.625rem+4.5rem+0.625rem)] text-[10px] text-muted-foreground">
        <span>Don’t care</span>
        <span>Essential</span>
      </p>

      <Button
        type="submit"
        size="lg"
        className="mt-4 h-10 w-full gap-2 rounded-none bg-emerald-700 text-sm font-normal text-white hover:bg-emerald-800"
      >
        Explore my Kraków
        <ArrowRight className="size-4" />
      </Button>
      <p className="mt-2 text-center text-[11px] font-light text-slate-500">Your map updates to match the priorities you choose.</p>
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
              "h-6 rounded-none transition " +
              STEP_COLORS[i] +
              (active ? " ring-2 ring-slate-900/70 ring-offset-1" : " opacity-30 hover:opacity-60")
            }
          />
        );
      })}
    </div>
  );
}
