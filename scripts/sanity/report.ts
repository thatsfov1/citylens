// npx tsx scripts/sanity/report.ts : prints the sanity checks and the top/bottom districts per category.
import { districtMeans, runChecks } from "./checks";
import { CATS, readSeed } from "./seed";

const rows = readSeed();
const checks = runChecks(rows);
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}  (${c.detail})`);
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed\n`);
for (const cat of CATS) {
  const m = districtMeans(rows, cat);
  const f = (xs: [string, number][]) => xs.map(([d, v]) => `${d} ${v.toFixed(0)}`).join(", ");
  console.log(`${cat.padEnd(10)} top: ${f(m.slice(0, 3))}\n${"".padEnd(10)} low: ${f(m.slice(-3))}`);
}
process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
