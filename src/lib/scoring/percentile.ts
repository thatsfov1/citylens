/**
 * Percentile rank (0–1) of each value within the array. Ties share their
 * mid-rank, so a constant array maps to 0.5 everywhere.
 */
export function percentileRanks(values: number[]): number[] {
  const n = values.length;
  if (n <= 1) return values.map(() => 0.5);
  const sorted = [...values].sort((a, b) => a - b);
  const first = new Map<number, number>();
  const last = new Map<number, number>();
  sorted.forEach((v, i) => {
    if (!first.has(v)) first.set(v, i);
    last.set(v, i);
  });
  return values.map((v) => ((first.get(v)! + last.get(v)!) / 2) / (n - 1));
}
