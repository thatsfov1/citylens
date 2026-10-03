// Evidence checks for curated works: a record may only cite words that appear on the official page and
// may only state dates that those words support. Pure, so it can be tested without network access.

// HTML tag boundaries leave stray spaces ("Bonarka , w"), so spaces before punctuation are dropped on both sides.
export const norm = (s: string) => s.replace(/\s+/g, " ").replace(/ ([,.;:)])/g, "$1").replace(/\( /g, "(").trim();

const PL_MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

export type EvidenceInput = {
  id: string;
  dateFrom: string | null;
  dateTo: string | null;
  whenLabel: string | null;
  evidence: string[];
};

/** Throws a descriptive error if a quote is not on the page or a stated date is not backed by the quotes. */
export function verifyEvidence(r: EvidenceInput, normalizedPageText: string): void {
  if (r.evidence.length === 0) throw new Error(`${r.id}: no evidence quote`);
  for (const quote of r.evidence) {
    if (!normalizedPageText.includes(norm(quote))) throw new Error(`${r.id}: evidence not found verbatim on the page: "${quote}"`);
  }
  if (r.whenLabel) return; // vague timing: wording was reviewed by a human against the quote
  const quotes = norm(r.evidence.join(" "));
  for (const iso of [r.dateFrom, r.dateTo]) {
    if (!iso) continue;
    const [y, m, d] = iso.split("-").map(Number);
    if (!quotes.includes(`${d} ${PL_MONTHS[m - 1]}`)) throw new Error(`${r.id}: date ${iso} is not backed by the evidence ("${d} ${PL_MONTHS[m - 1]}")`);
    if (/\b20\d\d\b/.test(quotes) && !quotes.includes(String(y))) throw new Error(`${r.id}: year ${y} is not backed by the evidence`);
  }
}
