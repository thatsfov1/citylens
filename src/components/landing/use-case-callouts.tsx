"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";

const EXAMPLES = [
  {
    message: "Czy w tej okolicy będą remonty?",
    answer: "Znaleziono 1 planowany remont w promieniu 1 km. Start: za około rok.",
    tone: "border-amber-200 bg-amber-50 text-amber-950",
    icon: "bg-amber-500",
  },
  {
    message: "Która okolica najlepiej odpowiada moim potrzebom?",
    answer: "Krowodrza to jedno z mocniejszych dopasowań — szczególnie pod kątem transportu i zieleni.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-600",
  },
  {
    message: "Gdzie znajdę mieszkanie w moim budżecie?",
    answer: "Mapa wyróżni obszary, w których więcej ofert mieści się w podanym przedziale cenowym.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-600",
  },
  {
    message: "Czy zdążę do pracy w 30 minut?",
    answer: "Porównamy przybliżony czas dojazdu pieszo, rowerem, autem lub komunikacją.",
    tone: "border-sky-200 bg-sky-50 text-sky-950",
    icon: "bg-sky-600",
  },
  {
    message: "Gdzie powietrze jest dziś lepsze?",
    answer: "Zobaczysz aktualny szacunek jakości powietrza oparty na pomiarach stacji GIOŚ.",
    tone: "border-sky-200 bg-sky-50 text-sky-950",
    icon: "bg-sky-600",
  },
  {
    message: "Szukam okolicy dobrej dla rodziny.",
    answer: "Dopasujemy mapę do dostępu do przedszkoli, szkół lub uczelni — zależnie od Twoich potrzeb.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-600",
  },
  {
    message: "Chcę mieć park blisko domu.",
    answer: "Wskażemy obszary z większym udziałem zieleni i krótszym dystansem do najbliższego parku.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-600",
  },
  {
    message: "Co naprawdę odróżnia te dwie okolice?",
    answer: "Porównanie pokaże, które kategorie najmocniej wpływają na różnicę w dopasowaniu.",
    tone: "border-slate-200 bg-slate-50 text-slate-900",
    icon: "bg-slate-700",
  },
  {
    message: "Czy w pobliżu łatwo zaparkować?",
    answer: "Sprawdzimy pobliskie parkingi, P+R i parkomaty — bez obiecywania wolnego miejsca.",
    tone: "border-amber-200 bg-amber-50 text-amber-950",
    icon: "bg-amber-500",
  },
  {
    message: "Chcę pokazać tę mapę bliskiej osobie.",
    answer: "Udostępniony link zachowa Twoje priorytety, filtry i porównywane obszary.",
    tone: "border-slate-200 bg-slate-50 text-slate-900",
    icon: "bg-slate-700",
  },
] as const;

const POSITIONS = [
  "left-6 top-6 sm:left-[10%] lg:top-[10%]",
  "right-6 top-6 sm:right-[10%] lg:top-[20%]",
  "left-6 top-6 sm:left-[15%] lg:top-[35%]",
  "right-6 top-6 sm:right-[12%] lg:top-[48%]",
] as const;

export function UseCaseCallouts() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [positionIndex, setPositionIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [answerVisible, setAnswerVisible] = useState(false);

  useEffect(() => {
    let answerTimer: ReturnType<typeof setTimeout>;
    let resetTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;
    let nextTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const showMessage = (index: number) => {
      if (cancelled) return;

      setMessageIndex(index);
      setPositionIndex(Math.floor(Math.random() * POSITIONS.length));
      setVisible(true);

      const answerAfter = 1500 + Math.floor(Math.random() * 701);
      answerTimer = setTimeout(() => setAnswerVisible(true), answerAfter);

      const visibleFor = answerAfter + 3200 + Math.floor(Math.random() * 1301);
      hideTimer = setTimeout(() => {
        setVisible(false);
        resetTimer = setTimeout(() => setAnswerVisible(false), 520);
        nextTimer = setTimeout(
          () => showMessage((index + 1) % EXAMPLES.length),
          800,
        );
      }, visibleFor);
    };

    const showTimer = setTimeout(() => showMessage(0), 700);

    return () => {
      cancelled = true;
      clearTimeout(showTimer);
      clearTimeout(answerTimer);
      clearTimeout(resetTimer);
      clearTimeout(hideTimer);
      clearTimeout(nextTimer);
    };
  }, []);

  const example = EXAMPLES[messageIndex];

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={`pointer-events-none absolute z-10 w-[min(21rem,calc(100%-3rem))] rounded-2xl border border-white/80 bg-white/92 p-4 text-[#252d27] shadow-[0_18px_60px_rgba(37,45,39,0.2)] backdrop-blur-md transition-[opacity,transform] duration-500 ease-out motion-reduce:transform-none motion-reduce:transition-none ${POSITIONS[positionIndex]} ${
        visible
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-3 scale-95 opacity-0"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#252d27] text-white">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Twoje pytanie
          </span>
          <p className="text-sm font-medium leading-snug sm:text-base">
            {example.message}
          </p>
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none ${
          answerVisible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className={`mt-3 flex gap-3 rounded-xl border p-3 ${example.tone}`}>
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-white ${example.icon}`}>
              <Check className="size-3.5" aria-hidden="true" />
            </span>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-65">
                Odpowiedź Citylens
              </span>
              <p className="mt-0.5 text-xs font-medium leading-relaxed sm:text-sm">
                {example.answer}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
