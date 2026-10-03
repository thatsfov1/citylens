import { z } from "zod";
import { CATEGORIES, type Category } from "../../types";

export const importanceSchema = z.object({
  sport: z.number().min(0).max(100),
  culture: z.number().min(0).max(100),
  greenery: z.number().min(0).max(100),
  shopping: z.number().min(0).max(100),
  transport: z.number().min(0).max(100),
  education: z.number().min(0).max(100),
});

export type Importance = z.infer<typeof importanceSchema>;

/** Importance is chosen on a 5-step scale. */
export const IMPORTANCE_STEPS = [0, 25, 50, 75, 100] as const;

/** Snaps any 0–100 value to the nearest step of the scale. */
export function snapImportance(value: number): number {
  return IMPORTANCE_STEPS.reduce((best, s) => (Math.abs(s - value) < Math.abs(best - value) ? s : best));
}

export const DEFAULT_IMPORTANCE: Importance = {
  sport: 50,
  culture: 10,
  greenery: 70,
  shopping: 20,
  transport: 50,
  education: 20,
};

export function importanceToQuery(importance: Importance): string {
  return CATEGORIES.map((c) => `${c}=${Math.round(importance[c])}`).join("&");
}

/** Parse URL search params, falling back to defaults for anything invalid. */
export function importanceFromQuery(
  params: Record<string, string | string[] | undefined>,
): Importance {
  const out = { ...DEFAULT_IMPORTANCE };
  for (const c of CATEGORIES as readonly Category[]) {
    const raw = params[c];
    if (typeof raw !== "string") continue;
    const parsed = importanceSchema.shape[c].safeParse(Number(raw));
    if (parsed.success) out[c] = parsed.data;
  }
  return out;
}

/** Minimum safety level filter: 0 = off. Not an importance weight; hexes below it are dimmed on the map. */
export const MIN_SAFETY_LEVELS = [
  { value: 0, label: "Wył." },
  { value: 25, label: "Niski" },
  { value: 50, label: "Średni" },
  { value: 75, label: "Wysoki" },
] as const;

export function minSafetyFromQuery(params: Record<string, string | string[] | undefined>): number {
  const raw = params.minSafety;
  const n = typeof raw === "string" ? Number(raw) : NaN;
  return MIN_SAFETY_LEVELS.some((l) => l.value === n) ? n : 0;
}
