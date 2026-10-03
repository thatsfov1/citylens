import { z } from "zod";
import { CATEGORIES, type Category } from "../../types";

export const importanceSchema = z.object({
  sport: z.number().min(0).max(100),
  culture: z.number().min(0).max(100),
  greenery: z.number().min(0).max(100),
  shopping: z.number().min(0).max(100),
  transport: z.number().min(0).max(100),
});

export type Importance = z.infer<typeof importanceSchema>;

export const DEFAULT_IMPORTANCE: Importance = {
  sport: 50,
  culture: 10,
  greenery: 70,
  shopping: 20,
  transport: 50,
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
