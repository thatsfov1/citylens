"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatResult } from "@/lib/llm/chat-schema";
import type { Anchor } from "@/lib/scoring/anchor";
import type { RentFilter } from "@/lib/scoring/rent";
import type { Workplace } from "@/lib/scoring/commute";
import type { Importance } from "@/lib/scoring/preferences";
import type { EducationStage } from "@/types";
import { GREETING } from "./landing-copy";

type Props = {
  /** Hold the greeting until the page intro is over. */
  enabled?: boolean;
  onImportance: (importance: Importance, stages: EducationStage[] | null, anchor: Anchor | null, rent: RentFilter | null, work: Workplace | null, car: boolean) => void;
};

export function ChatPanel({ onImportance, enabled = true }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<ChatResult["debug"] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const greeting = useTypewriter(GREETING, enabled);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, greeting.shown]);

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
      setDebug(data.debug ?? null);
      if (data.importance) onImportance(data.importance, data.stages, data.anchor, data.rent, data.work, data.car === true);
    } catch {
      setError("Asystent jest chwilowo niedostępny. Spróbuj ponownie za chwilę.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <section
      aria-label="Rozmowa z asystentem"
      className="w-full text-[#303731]"
    >
      <div ref={listRef} className="max-h-[40vh] min-h-40 space-y-4 overflow-y-auto pr-1" aria-live="polite">
        <div className="flex items-end gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center border border-stone-300 text-stone-500">
            <Bot className="size-4" aria-hidden />
          </span>
          <div className="max-w-[85%] border-l border-stone-300 py-1 pl-4 text-base font-light leading-relaxed text-[#303731]">
            {greeting.thinking ? (
              <TypingDots />
            ) : (
              <>
                <span className="sr-only">{GREETING}</span>
                <span aria-hidden>{greeting.shown}</span>
                {!greeting.done && <span aria-hidden className="animate-caret ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-stone-600" />}
              </>
            )}
          </div>
        </div>
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.text} />
        ))}
        {pending && (
          <div className="flex items-end gap-2">
            <span className="size-8 shrink-0" />
            <div className="border-l border-[#c2c8ac]/40 px-4 py-2">
              <span className="sr-only">Asystent pisze…</span>
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      {error && (
          <p role="alert" className="mt-2 border-l-2 border-stone-400 py-1 pl-3 text-sm text-stone-600">
            {error}
          </p>
      )}

      {debug && <DebugTab debug={debug} />}

      <form onSubmit={onSubmit} className="mt-5 flex gap-2 border-b border-stone-300 pb-2 focus-within:border-stone-700">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="Napisz tutaj…"
          aria-label="Opisz swoje preferencje"
          className="h-12 min-w-0 flex-1 bg-transparent px-1 text-base font-light text-[#222823] outline-none placeholder:text-stone-400"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="Wyślij"
          className="flex size-11 shrink-0 items-center justify-center bg-[#252d27] text-white outline-none transition hover:bg-[#39443b] focus-visible:ring-2 focus-visible:ring-stone-500 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
        >
          <Send className="size-5" aria-hidden />
        </button>
      </form>
    </section>
  );
}

/** Collapsible view of what the LLM extracted and how places were resolved from our data. */
function DebugTab({ debug }: { debug: NonNullable<ChatResult["debug"]> }) {
  return (
    <details className="mt-3 border border-stone-200 text-xs text-stone-600">
      <summary className="cursor-pointer select-none px-3 py-2 font-medium text-stone-700">
        Co przygotował model (podgląd)
      </summary>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-stone-200 bg-stone-50 p-3 font-mono text-[11px] leading-snug">
        {JSON.stringify(debug, null, 2)}
      </pre>
    </details>
  );
}

function Bubble({ role, text }: { role: ChatMessage["role"]; text: string }) {
  const user = role === "user";
  return (
    <div className={cn("animate-pop flex", user ? "justify-end" : "items-end gap-2")}>
      {!user && <span className="size-8 shrink-0" />}
      <div
        className={cn(
          "max-w-[85%] border-l px-4 py-2 text-base font-light leading-relaxed",
          user
            ? "border-stone-300 bg-stone-50 text-stone-600"
            : "border-stone-300 text-[#303731]",
        )}
      >
        {text}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span aria-hidden className="flex h-5 items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-typing-dot size-1.5 bg-stone-500"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

/** Types `text` character by character after a short "bot is typing" pause. Shows it at once with reduced motion. */
function useTypewriter(text: string, enabled: boolean) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: ReturnType<typeof setTimeout>;
    const step = (n: number) => {
      setCount(n);
      if (n >= text.length) return;
      const ch = text[n - 1] ?? "";
      const pause = ".!?".includes(ch) ? 260 : ch === "," ? 120 : 0;
      timer = setTimeout(() => step(n + 1), 24 + Math.random() * 30 + pause);
    };
    timer = setTimeout(
      () => {
        setStarted(true);
        step(reduce ? text.length : 1);
      },
      reduce ? 0 : 1000,
    );
    return () => clearTimeout(timer);
  }, [text, enabled]);

  return { shown: text.slice(0, count), done: count >= text.length, thinking: !started };
}
