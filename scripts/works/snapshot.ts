// Saves the readable text of the official pages listed in data/works/sources.json to data/works/snapshots/<key>.txt.
// build.ts checks every curated record's evidence quote against these files, so a record can only cite words
// that really appear on the official page. Re-run to refresh (the ZDMK works list changes daily).
// Usage: npx tsx scripts/works/snapshot.ts
import { readFileSync, writeFileSync } from "node:fs";

const sources = JSON.parse(readFileSync("data/works/sources.json", "utf8")) as Record<string, { url: string; name: string }>;

const entities: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&lt;": "<", "&gt;": ">", "&ndash;": "–" };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|nav|header|footer|noscript)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&(#\d+|[a-z]+);/gi, (m, g: string) =>
      entities[m] ?? (g.startsWith("#") ? String.fromCodePoint(Number(g.slice(1))) : m),
    )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n");
}

async function main() {
  const day = new Date().toISOString().slice(0, 10);
  for (const [key, s] of Object.entries(sources)) {
    const res = await fetch(s.url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`${s.url}: HTTP ${res.status}`);
    const text = htmlToText(await res.text());
    writeFileSync(`data/works/snapshots/${key}.txt`, `SOURCE: ${s.url}\nRETRIEVED: ${day}\n\n${text}`);
    console.log(`${key}: ${text.length} chars`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
