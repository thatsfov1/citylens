"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, RefreshCw, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatResult } from "@/lib/llm/chat-schema";
import type { Importance } from "@/lib/scoring/preferences";
import { CATEGORIES, type Category } from "@/types";
import {
  CATEGORY_PL,
  CATEGORY_STYLE,
  GREETING,
  SUGGESTIONS,
  SUGGESTIONS_VISIBLE,
  levelToPercent,
  type Levels,
} from "./landing-copy";

type Props = {
  levels: Levels;
  onImportance: (importance: Importance) => void;
  onEditCategory: (category: Category) => void;
  onRemoveCategory: (category: Category) => void;
};

export function ChatPanel({ levels, onImportance, onEditCategory, onRemoveCategory }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionStart, setSuggestionStart] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const greeting = useTypewriter(GREETING);

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
      if (data.importance) onImportance(data.importance);
    } catch {
      setError("Asystent jest chwilowo niedostępny — możesz ustawić kategorie samodzielnie, klikając ikony powyżej.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const visibleSuggestions = Array.from(
    { length: SUGGESTIONS_VISIBLE },
    (_, i) => SUGGESTIONS[(suggestionStart + i) % SUGGESTIONS.length],
  );
  const chips = CATEGORIES.filter((c) => levels[c]);

  return (
    <section
      aria-label="Rozmowa z asystentem"
      className="w-full rounded-[2rem] border-2 border-emerald-200 bg-white/90 p-3 shadow-xl shadow-emerald-900/10 backdrop-blur sm:p-4"
    >
      <div ref={listRef} className="max-h-60 min-h-28 space-y-2.5 overflow-y-auto pr-1" aria-live="polite">
        <div className="flex items-end gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Bot className="size-5" aria-hidden />
          </span>
          <div className="max-w-[85%] rounded-3xl rounded-bl-md bg-emerald-50 px-4 py-2.5 text-[15px] leading-relaxed text-slate-900">
            {greeting.thinking ? (
              <TypingDots />
            ) : (
              <>
                <span className="sr-only">{GREETING}</span>
                <span aria-hidden>{greeting.shown}</span>
                {!greeting.done && <span aria-hidden className="animate-caret ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-emerald-700" />}
              </>
            )}
          </div>
        </div>
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.text} />
        ))}
        {pending && (
          <div className="flex items-end gap-2">
            <span className="size-9 shrink-0" />
            <div className="rounded-3xl rounded-bl-md bg-emerald-50 px-4 py-3">
              <span className="sr-only">Asystent pisze…</span>
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      {chips.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">Twoje parametry</p>
          <ul className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <li
                key={c}
                className={cn(
                  "animate-pop flex items-center rounded-full border-2 text-sm font-semibold",
                  CATEGORY_STYLE[c].chip,
                )}
              >
                <button
                  type="button"
                  onClick={() => onEditCategory(c)}
                  aria-label={`${CATEGORY_PL[c].label}: ${levelToPercent(levels[c]!)}%. Zmień`}
                  className="flex items-center gap-1.5 rounded-full py-1 pl-3 pr-1.5 outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/40"
                >
                  <span className={cn("size-2.5 rounded-full", CATEGORY_STYLE[c].dot)} aria-hidden />
                  {CATEGORY_PL[c].label} · {levelToPercent(levels[c]!)}%
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveCategory(c)}
                  aria-label={`Usuń parametr: ${CATEGORY_PL[c].label}`}
                  className="mr-1 rounded-full p-1 outline-none hover:bg-black/10 focus-visible:ring-4 focus-visible:ring-emerald-600/40"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2">
        <ul
          key={suggestionStart}
          aria-label="Propozycje"
          className="flex min-w-0 flex-1 flex-wrap gap-2"
        >
          {visibleSuggestions.map((s, i) => (
            <li key={s} className="animate-pop" style={{ animationDelay: `${i * 50}ms` }}>
              <button
                type="button"
                disabled={pending}
                onClick={() => void send(s)}
                className="rounded-full border-2 border-emerald-200 bg-white px-3.5 py-1.5 text-sm text-emerald-950 outline-none transition hover:-translate-y-0.5 hover:bg-emerald-50 focus-visible:ring-4 focus-visible:ring-emerald-600/40 active:scale-95 disabled:opacity-50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setSuggestionStart((s) => (s + SUGGESTIONS_VISIBLE) % SUGGESTIONS.length)}
          aria-label="Pokaż inne propozycje"
          title="Pokaż inne propozycje"
          className="group flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-emerald-200 bg-white text-emerald-800 outline-none transition hover:bg-emerald-50 focus-visible:ring-4 focus-visible:ring-emerald-600/40"
        >
          <RefreshCw className="size-4 transition-transform duration-300 group-hover:rotate-180 motion-reduce:transition-none" aria-hidden />
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="Napisz, czego szukasz w okolicy…"
          aria-label="Opisz swoje preferencje"
          className="h-12 min-w-0 flex-1 rounded-full border-2 border-slate-200 bg-white px-5 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-600/20"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="Wyślij"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white outline-none transition hover:bg-emerald-800 focus-visible:ring-4 focus-visible:ring-emerald-600/40 active:scale-90 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
        >
          <Send className="size-5" aria-hidden />
        </button>
      </form>
    </section>
  );
}

function Bubble({ role, text }: { role: ChatMessage["role"]; text: string }) {
  const user = role === "user";
  return (
    <div className={cn("animate-pop flex", user ? "justify-end" : "items-end gap-2")}>
      {!user && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Bot className="size-5" aria-hidden />
        </span>
      )}
      <div
        className={cn(
          "max-w-[85%] px-4 py-2.5 text-[15px] leading-relaxed",
          user
            ? "rounded-3xl rounded-br-md bg-emerald-700 text-white"
            : "rounded-3xl rounded-bl-md bg-emerald-50 text-slate-900",
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
          className="animate-typing-dot size-2 rounded-full bg-emerald-600"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

/** Types `text` character by character after a short "bot is typing" pause. Shows it at once with reduced motion. */
function useTypewriter(text: string) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: ReturnType<typeof setTimeout>;
    const step = (n: number) => {
      setCount(n);
      if (n >= text.length) return;
      const ch = text[n - 1] ?? "";
      const pause = ".!?—".includes(ch) ? 260 : ch === "," ? 120 : 0;
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
  }, [text]);

  return { shown: text.slice(0, count), done: count >= text.length, thinking: !started };
}
