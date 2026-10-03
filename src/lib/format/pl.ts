/** Polish plural form: 1 → `one`, 2–4 (not 12–14) → `few`, everything else → `many`. */
export function plPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const last = abs % 10;
  const lastTwo = abs % 100;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? few : many;
}

/** `${n} ${form}` with the right Polish plural form. */
export const plCount = (n: number, one: string, few: string, many: string) => `${n} ${plPlural(n, one, few, many)}`;

/** Decimal with a comma, as written in Polish: 1.2 -> "1,2". */
export const dec = (n: number, digits = 1) => n.toFixed(digits).replace(".", ",");
