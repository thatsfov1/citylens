import { EDUCATION_STAGES, type EducationStage, type HexData } from "../../types";

// Education is one category with four life stages. The stored `scores.education` is the mean of all four;
// when the user selects only some stages, the score is recomputed here from the stored per-stage scores.
// Deterministic and client-side: no LLM, no extra query.

/** URL codes for `?edu=`; short and stable. */
export const STAGE_CODES: Record<EducationStage, string> = {
  kindergarten: "kg",
  primary: "pr",
  secondary: "se",
  university: "un",
};

/** Parses `?edu=kg,pr`; missing/invalid input means every stage. Unknown codes are ignored. */
export function parseStages(raw: string | null | undefined): EducationStage[] {
  if (!raw) return [...EDUCATION_STAGES];
  const codes = new Set(raw.split(","));
  const picked = EDUCATION_STAGES.filter((s) => codes.has(STAGE_CODES[s]));
  return picked.length ? picked : [...EDUCATION_STAGES];
}

/** `null` when every stage is selected (the default needs no query parameter). */
export function stagesToParam(stages: readonly EducationStage[]): string | null {
  if (stages.length === 0 || stages.length === EDUCATION_STAGES.length) return null;
  return EDUCATION_STAGES.filter((s) => stages.includes(s)).map((s) => STAGE_CODES[s]).join(",");
}

/** Education score for the selected stages (mean of their stage scores). Falls back to the stored score. */
export function educationScore(hex: Pick<HexData, "scores" | "educationStages">, stages: readonly EducationStage[]): number {
  const own = hex.educationStages;
  if (!own || stages.length === 0 || stages.length === EDUCATION_STAGES.length) return hex.scores.education;
  return Math.round(stages.reduce((sum, s) => sum + own[s], 0) / stages.length);
}

/** Same hexes with `scores.education` recomputed for the selected stages; returns the input when nothing changes. */
export function withEducationStages(hexes: HexData[], stages: readonly EducationStage[]): HexData[] {
  if (stages.length === 0 || stages.length === EDUCATION_STAGES.length) return hexes;
  return hexes.map((h) => (h.educationStages ? { ...h, scores: { ...h.scores, education: educationScore(h, stages) } } : h));
}
