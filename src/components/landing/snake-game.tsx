"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// Palette = the category hues from globals.css.
const MINT = "#5FE3A1";
const FOOD_COLORS = ["#FFB547", "#F58FB2", "#5FE3A1", "#7CC4FF", "#B9A2FF", "#FF8A6B"];
const BOT_COLORS = ["#FFB547", "#F58FB2", "#7CC4FF", "#B9A2FF", "#FF8A6B"];
const SEG = 9; // distance between body segments
const BASE_SPEED = 105;
const BOOST_SPEED = 200;
const START_LEN = 12;
const MIN_BOOST_LEN = 8;
const BEST_KEY = "cl-snake-best";

type Pt = { x: number; y: number };
type Snake = {
  segs: Pt[];
  angle: number;
  len: number;
  color: string;
  bot: boolean;
  alive: boolean;
  respawnAt: number;
  wander: number;
  boost: boolean;
  invuln: number;
};
type Food = { x: number; y: number; r: number; color: string; value: number };

const radiusOf = (s: Snake) => 5 + Math.min(6, s.len / 12);
const head = (s: Snake) => s.segs[0];

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Slither-style minigame for the landing hero: steer with the pointer, hold to boost, eat the coloured
 * dots, make bots crash into your body. Purely decorative — it never touches preferences or map data.
 */
export function SnakeGame({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLParagraphElement>(null);
  const [run, setRun] = useState(0);
  const [over, setOver] = useState<{ score: number; best: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const area = w * h;
    const botCount = area > 220_000 ? 5 : 3;
    const foodTarget = Math.round(Math.min(90, Math.max(28, area / 8000)));
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function makeSnake(bot: boolean, color: string, avoid?: Pt): Snake {
      let x = w / 2;
      let y = h / 2;
      if (bot) {
        for (let tries = 0; tries < 20; tries++) {
          x = rand(80, Math.max(81, w - 80));
          y = rand(80, Math.max(81, h - 80));
          if (!avoid || Math.hypot(x - avoid.x, y - avoid.y) > 220) break;
        }
      }
      const angle = rand(0, Math.PI * 2);
      const len = bot ? rand(10, 18) : START_LEN;
      return {
        segs: Array.from({ length: Math.floor(len) }, (_, i) => ({ x: x - Math.cos(angle) * SEG * i, y: y - Math.sin(angle) * SEG * i })),
        angle,
        len,
        color,
        bot,
        alive: true,
        respawnAt: 0,
        wander: rand(-1, 1),
        boost: false,
        invuln: bot ? 0 : 1.6,
      };
    }

    const player = makeSnake(false, MINT);
    const bots = Array.from({ length: botCount }, (_, i) => makeSnake(true, BOT_COLORS[i % BOT_COLORS.length], head(player)));
    const all = [player, ...bots];
    const foods: Food[] = [];
    const spawnFood = (): Food => ({
      x: rand(16, Math.max(17, w - 16)),
      y: rand(16, Math.max(17, h - 16)),
      r: rand(2.6, 4.6),
      color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
      value: 1,
    });
    while (foods.length < foodTarget) foods.push(spawnFood());

    const pointer: Pt = { x: w * 0.8, y: h / 2 };
    let kills = 0;
    let best = readBest();
    let done = false;
    let last = performance.now();
    let hudAt = 0;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    };
    const onDown = (e: PointerEvent) => {
      onMove(e);
      player.boost = true;
    };
    const onUp = () => (player.boost = false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);

    function kill(s: Snake, now: number) {
      s.alive = false;
      s.respawnAt = now + 3000;
      // The body turns into food for whoever is nearby.
      s.segs.forEach((p, i) => {
        if (i % 2 === 0) foods.push({ x: p.x, y: p.y, r: 4.5, color: FOOD_COLORS[i % FOOD_COLORS.length], value: 2 });
      });
    }

    function steer(s: Snake, dt: number) {
      const hd = head(s);
      let target: number;
      let turn = 4.4;
      if (!s.bot) {
        target = Math.atan2(pointer.y - hd.y, pointer.x - hd.x);
      } else {
        turn = 3.4;
        s.wander += rand(-1, 1) * dt * 2;
        s.wander = Math.max(-1, Math.min(1, s.wander));
        target = s.angle + s.wander * 0.8;
        // Head for the nearest food.
        let bestD = 260;
        for (const f of foods) {
          const d = Math.hypot(f.x - hd.x, f.y - hd.y);
          if (d < bestD) {
            bestD = d;
            target = Math.atan2(f.y - hd.y, f.x - hd.x);
          }
        }
        // Stay away from walls and from other bodies straight ahead.
        const m = 70;
        if (hd.x < m || hd.x > w - m || hd.y < m || hd.y > h - m) target = Math.atan2(h / 2 - hd.y, w / 2 - hd.x);
        const ax = hd.x + Math.cos(s.angle) * 46;
        const ay = hd.y + Math.sin(s.angle) * 46;
        for (const o of all) {
          if (o === s || !o.alive) continue;
          const orad = radiusOf(o);
          for (let i = 1; i < o.segs.length; i++) {
            if (Math.hypot(o.segs[i].x - ax, o.segs[i].y - ay) < orad + 16) {
              target = s.angle + (Math.random() < 0.5 ? 1 : -1) * 1.3;
              i = o.segs.length;
            }
          }
        }
        // Occasionally sprint towards food when long enough.
        s.boost = s.len > 20 && Math.random() < 0.004 ? !s.boost : s.boost && s.len > 14;
      }
      let diff = target - s.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      s.angle += Math.max(-turn * dt, Math.min(turn * dt, diff));

      if (s.boost && s.len <= MIN_BOOST_LEN) s.boost = false;
      const speed = s.boost ? BOOST_SPEED : BASE_SPEED;
      if (s.boost) s.len = Math.max(MIN_BOOST_LEN, s.len - dt * 2.4);
      hd.x += Math.cos(s.angle) * speed * dt;
      hd.y += Math.sin(s.angle) * speed * dt;

      const want = Math.floor(s.len);
      while (s.segs.length < want) s.segs.push({ ...s.segs[s.segs.length - 1] });
      while (s.segs.length > want) s.segs.pop();
      for (let i = 1; i < s.segs.length; i++) {
        const p = s.segs[i - 1];
        const q = s.segs[i];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const d = Math.hypot(dx, dy);
        if (d > SEG) {
          q.x += (dx / d) * (d - SEG);
          q.y += (dy / d) * (d - SEG);
        }
      }
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      for (const s of all) {
        if (!s.alive) {
          if (s.bot && now > s.respawnAt) Object.assign(s, makeSnake(true, s.color, head(player)));
          continue;
        }
        steer(s, dt);
        s.invuln = Math.max(0, s.invuln - dt);
        const hd = head(s);
        const r = radiusOf(s);

        // Food: nearby dots are pulled in, then eaten.
        for (let i = foods.length - 1; i >= 0; i--) {
          const f = foods[i];
          const dx = hd.x - f.x;
          const dy = hd.y - f.y;
          const d = Math.hypot(dx, dy);
          if (d < r + 38) {
            f.x += (dx / d) * 160 * dt;
            f.y += (dy / d) * 160 * dt;
          }
          if (d < r + f.r + 2) {
            s.len += 0.55 * f.value;
            foods.splice(i, 1);
          }
        }

        // Walls.
        if (!s.bot && s.invuln <= 0 && (hd.x < r || hd.y < r || hd.x > w - r || hd.y > h - r)) {
          kill(s, now);
          continue;
        }
        hd.x = Math.max(r, Math.min(w - r, hd.x));
        hd.y = Math.max(r, Math.min(h - r, hd.y));

        // Bodies of other snakes.
        if (s.invuln > 0) continue;
        for (const o of all) {
          if (o === s || !o.alive) continue;
          const lim = r * 0.75 + radiusOf(o) * 0.9;
          if (o.segs.some((p, i) => i > 0 && Math.hypot(p.x - hd.x, p.y - hd.y) < lim)) {
            if (s.bot && o === player) kills++;
            kill(s, now);
            break;
          }
        }
      }
      while (foods.length < foodTarget) foods.push(spawnFood());

      // Draw.
      ctx!.clearRect(0, 0, w, h);
      ctx!.lineWidth = 2;
      ctx!.strokeStyle = "rgba(95,227,161,0.35)";
      ctx!.strokeRect(1, 1, w - 2, h - 2);
      for (const f of foods) {
        ctx!.shadowColor = f.color;
        ctx!.shadowBlur = 12;
        ctx!.fillStyle = f.color;
        ctx!.beginPath();
        ctx!.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.shadowBlur = 0;
      for (const s of [...bots, player]) {
        if (!s.alive) continue;
        const r = radiusOf(s);
        const blink = s.invuln > 0 && Math.floor(now / 120) % 2 === 0;
        ctx!.globalAlpha = blink ? 0.4 : 1;
        for (let i = s.segs.length - 1; i >= 0; i--) {
          const p = s.segs[i];
          ctx!.fillStyle = s.color;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, r * (i === 0 ? 1.08 : 1), 0, Math.PI * 2);
          ctx!.fill();
          if (i % 2 === 0) {
            ctx!.fillStyle = "rgba(255,255,255,0.22)";
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
        if (s.boost) {
          ctx!.shadowColor = s.color;
          ctx!.shadowBlur = 18;
          ctx!.strokeStyle = s.color;
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(head(s).x, head(s).y, r + 4, 0, Math.PI * 2);
          ctx!.stroke();
          ctx!.shadowBlur = 0;
        }
        // Eyes.
        const hd = head(s);
        for (const side of [-1, 1]) {
          const ex = hd.x + Math.cos(s.angle) * r * 0.45 + Math.cos(s.angle + (Math.PI / 2) * side) * r * 0.5;
          const ey = hd.y + Math.sin(s.angle) * r * 0.45 + Math.sin(s.angle + (Math.PI / 2) * side) * r * 0.5;
          ctx!.fillStyle = "#fff";
          ctx!.beginPath();
          ctx!.arc(ex, ey, r * 0.34, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.fillStyle = "#0B1620";
          ctx!.beginPath();
          ctx!.arc(ex + Math.cos(s.angle) * r * 0.12, ey + Math.sin(s.angle) * r * 0.12, r * 0.17, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.globalAlpha = 1;
      }

      const score = Math.round(player.len * 10);
      if (now - hudAt > 120 && hudRef.current) {
        hudRef.current.textContent = `Wynik ${score} · Rekord ${Math.max(best, score)} · Pokonani ${kills}`;
        hudAt = now;
      }
      if (!player.alive && !done) {
        done = true;
        best = Math.max(best, score);
        try {
          localStorage.setItem(BEST_KEY, String(best));
        } catch {}
        setOver({ score, best });
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [run, onClose]);

  return (
    <div className="animate-pop absolute inset-0 z-20 bg-ink/65 backdrop-blur-[2px]">
      <canvas ref={canvasRef} aria-label="Minigra: wąż" className="size-full cursor-crosshair touch-none" />
      <div className="pointer-events-none absolute left-4 top-14 font-mono text-[11px] uppercase tracking-[0.2em] text-mist/80">
        <p ref={hudRef}>Wynik 120 · Rekord 0 · Pokonani 0</p>
        <p className="mt-1 text-mist/50">Kieruj myszką · przytrzymaj, by przyspieszyć</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Zamknij grę"
        className="absolute right-4 top-14 flex size-9 items-center justify-center rounded-full border border-white/30 bg-ink/60 text-mist outline-none transition hover:border-mint hover:text-mint focus-visible:ring-2 focus-visible:ring-mint"
      >
        <X className="size-4" />
      </button>
      {over && (
        <div className="animate-pop absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70 text-center text-mist">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-mint">Koniec gry</p>
          <p className="text-5xl font-semibold tracking-tight">{over.score}</p>
          <p className="text-sm text-mist/60">Rekord: {over.best}</p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setOver(null);
                setRun((r) => r + 1);
              }}
              className="h-11 rounded-full bg-mint px-6 text-sm font-semibold text-ink outline-none transition hover:bg-mint/85 focus-visible:ring-4 focus-visible:ring-mint/50"
            >
              Zagraj ponownie
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-full border border-white/30 px-6 text-sm outline-none transition hover:border-white focus-visible:ring-4 focus-visible:ring-white/30"
            >
              Wróć do mapy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
