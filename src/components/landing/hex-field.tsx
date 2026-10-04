"use client";

import { useEffect, useRef } from "react";

// Same hues as the category palette in globals.css (sun, rose, mint, sky, lilac, coral).
const COLORS = ["#FFB547", "#F58FB2", "#5FE3A1", "#7CC4FF", "#B9A2FF", "#FF8A6B"];
const SIZE = 30; // hex radius in CSS px
const POINTER_RADIUS = 160;
const WAVE_SPEED = 280; // px / s
const WAVE_WIDTH = 80;

/**
 * Decorative interactive H3-style hexagon grid over the hero: cells light up under the cursor and
 * colour ripples roll across the field on their own. Purely visual — no data, no fake scores.
 * Listens on its parent element; a static grid is drawn when the user prefers reduced motion.
 */
export function HexField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hexW = Math.sqrt(3) * SIZE;
    const corners = Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 180) * (60 * k - 30);
      return [Math.cos(a) * (SIZE - 1.5), Math.sin(a) * (SIZE - 1.5)] as const;
    });
    const trace = (x: number, y: number) => {
      ctx.beginPath();
      corners.forEach(([dx, dy], k) => (k ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
      ctx.closePath();
    };

    let w = 0;
    let h = 0;
    let xs = new Float32Array(0);
    let ys = new Float32Array(0);
    let level = new Float32Array(0);
    let hue = new Uint8Array(0);
    const grid = document.createElement("canvas");
    const pointer = { x: 0, y: 0, active: false };
    const waves: { x: number; y: number; t0: number }[] = [];
    let raf = 0;
    let last = 0;
    let nextWave = 0.6;

    function build() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = host!.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas!.width = grid.width = Math.round(w * dpr);
      canvas!.height = grid.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.ceil(w / hexW) + 2;
      const rows = Math.ceil(h / (1.5 * SIZE)) + 2;
      xs = new Float32Array(cols * rows);
      ys = new Float32Array(cols * rows);
      level = new Float32Array(cols * rows);
      hue = new Uint8Array(cols * rows);
      for (let r2 = 0; r2 < rows; r2++) {
        for (let c = 0; c < cols; c++) {
          const i = r2 * cols + c;
          xs[i] = (c - 1) * hexW + (r2 % 2) * (hexW / 2);
          ys[i] = (r2 - 1) * 1.5 * SIZE;
          hue[i] = (c * 7 + r2 * 13) % COLORS.length;
        }
      }
      // The faint resting grid is drawn once into an offscreen canvas and blitted every frame.
      const g = grid.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.strokeStyle = "rgba(255,255,255,0.08)";
      g.lineWidth = 1;
      for (let i = 0; i < xs.length; i++) {
        g.beginPath();
        corners.forEach(([dx, dy], k) => (k ? g.lineTo(xs[i] + dx, ys[i] + dy) : g.moveTo(xs[i] + dx, ys[i] + dy)));
        g.closePath();
        g.stroke();
      }
    }

    function frame(now: number) {
      const t = now / 1000;
      const dt = Math.min(0.05, t - last || 0.016);
      last = t;
      const decay = Math.exp(-dt * 2.4);

      if (t > nextWave) {
        waves.push({ x: Math.random() * w, y: Math.random() * h, t0: t });
        nextWave = t + 2.4 + Math.random() * 1.8;
      }
      while (waves.length && t - waves[0].t0 > 4) waves.shift();

      ctx!.clearRect(0, 0, w, h);
      ctx!.drawImage(grid, 0, 0, w, h);
      for (let i = 0; i < xs.length; i++) {
        let v = level[i] * decay;
        if (pointer.active) {
          const d = Math.hypot(xs[i] - pointer.x, ys[i] - pointer.y);
          if (d < POINTER_RADIUS) v = Math.max(v, Math.pow(1 - d / POINTER_RADIUS, 1.6));
        }
        for (const wv of waves) {
          const age = t - wv.t0;
          const e = Math.abs(Math.hypot(xs[i] - wv.x, ys[i] - wv.y) - age * WAVE_SPEED);
          if (e < WAVE_WIDTH) v = Math.max(v, 0.6 * (1 - e / WAVE_WIDTH) * Math.max(0, 1 - age / 3.6));
        }
        level[i] = v;
        if (v < 0.02) continue;
        const color = COLORS[hue[i]];
        trace(xs[i], ys[i]);
        ctx!.globalAlpha = v * 0.45;
        ctx!.fillStyle = color;
        ctx!.fill();
        ctx!.globalAlpha = Math.min(1, v * 1.2);
        ctx!.strokeStyle = color;
        ctx!.lineWidth = 1.2;
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) raf = requestAnimationFrame(frame);
    };

    build();
    if (reduce) {
      ctx.drawImage(grid, 0, 0, w, h);
    } else {
      raf = requestAnimationFrame(frame);
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
      document.addEventListener("visibilitychange", onVisibility);
    }
    const ro = new ResizeObserver(() => {
      build();
      if (reduce) ctx.drawImage(grid, 0, 0, w, h);
    });
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
