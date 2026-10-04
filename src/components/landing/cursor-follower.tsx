"use client";

import { useEffect, useRef } from "react";

const INTERACTIVE = "a, button, input, textarea, summary, [role='radio'], [role='button']";

/** Lagging ring that follows the mouse and swells over interactive elements. Desktop pointers only. */
export function CursorFollower() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let scale = 1;
    let raf = 0;
    const loop = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.transform = `translate3d(${x - 16}px, ${y - 16}px, 0) scale(${scale})`;
      raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      el.style.opacity = "1";
      scale = (e.target as Element | null)?.closest?.(INTERACTIVE) ? 2.2 : 1;
    };
    const onDown = () => (scale *= 0.7);
    const onLeave = () => (el.style.opacity = "0");
    raf = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[90] size-8 rounded-full border border-white opacity-0 mix-blend-difference transition-opacity duration-300 max-lg:hidden"
    />
  );
}
