"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage, ChatResult } from "@/lib/llm/chat-schema";
import type { Importance } from "@/lib/scoring/preferences";

const GREETING = "Hi! What would you like from the area you live in in Kraków?";
const EXAMPLES = [
  "Parks and running, good tram links",
  "Nightlife and culture, no car",
  "Quiet, green, near shops",
];

export function PreferencesChat({ onImportance }: { onImportance: (i: Importance) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, pending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const next: ChatMessage[] = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as ChatResult;
      setMessages([...next, { role: "assistant", text: data.reply }]);
      if (data.importance) onImportance(data.importance);
    } catch {
      setError("The assistant is unavailable — you can still set the sliders below.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-800">
        <Sparkles className="size-3.5" />
        Describe it in your own words
      </div>

      <div className="max-h-52 space-y-2 overflow-y-auto text-sm" aria-live="polite">
        <Bubble role="assistant" text={GREETING} />
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.text} />
        ))}
        {pending && <Bubble role="assistant" text="Thinking…" muted />}
        <div ref={endRef} />
      </div>

      {error && <p className="mt-2 text-xs text-amber-700">{error}</p>}

      {messages.length === 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => send(e)}
              className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs text-emerald-900 hover:bg-emerald-50"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send(input);
            }
          }}
          maxLength={500}
          placeholder="e.g. I love parks and running…"
          aria-label="Describe your preferences"
          className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
        />
        <Button
          type="button"
          size="icon"
          aria-label="Send"
          disabled={pending || !input.trim()}
          onClick={() => send(input)}
          className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Bubble({ role, text, muted }: { role: ChatMessage["role"]; text: string; muted?: boolean }) {
  const user = role === "user";
  return (
    <div className={user ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-3 py-1.5",
          user ? "bg-emerald-600 text-white" : "bg-white text-foreground shadow-sm",
          muted ? "text-muted-foreground" : "",
        ].join(" ")}
      >
        {text}
      </div>
    </div>
  );
}
