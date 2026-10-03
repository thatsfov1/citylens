import { chatRequestSchema } from "@/lib/llm/chat-schema";
import type { ChatResult } from "@/lib/llm/chat-schema";
import { chatTurn } from "@/lib/llm/gemini";
import { budgetToFilter } from "@/lib/scoring/rent";
import { DEFAULT_COMMUTE_MIN, type Workplace } from "@/lib/scoring/commute";
import { resolveAnchor } from "@/lib/supabase/anchors";

// Tiny in-memory per-IP limiter — enough to protect the demo key from accidental loops.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 30;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_REQUESTS;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return Response.json({ error: "Too many requests, please try again later." }, { status: 429 });
  }

  const body = chatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const { nearPlace, budget, workplace, ...output } = await chatTurn(body.data.messages);
    // Coordinates come from our data, never from the model; an unknown name is silently dropped.
    const anchor = nearPlace ? await resolveAnchor(nearPlace.query, nearPlace.radiusM) : null;
    const place = workplace ? await resolveAnchor(workplace.query, 1000) : null;
    const work: Workplace | null = place
      ? {
          name: place.name,
          lat: place.lat,
          lng: place.lng,
          mode: workplace?.mode ?? "transit",
          maxMin: workplace?.maxMin ?? DEFAULT_COMMUTE_MIN,
        }
      : null;
    return Response.json({ ...output, anchor, rent: budgetToFilter(budget), work } satisfies ChatResult);
  } catch (err) {
    console.error("chat failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "The assistant is unavailable right now." }, { status: 503 });
  }
}
