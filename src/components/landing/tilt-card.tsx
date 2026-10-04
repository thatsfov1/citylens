"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 3D tilt towards the pointer with a moving glare. Desktop mouse only. */
export function TiltCard({ children, className, glow }: { children: ReactNode; className?: string; glow: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={cn("lm-tilt relative", className)}
      style={{ "--glow": glow } as React.CSSProperties}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty("--rx", `${((0.5 - y) * 14).toFixed(2)}deg`);
        el.style.setProperty("--ry", `${((x - 0.5) * 14).toFixed(2)}deg`);
        el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
        el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      }}
      onPointerLeave={() => {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
      }}
    >
      <div aria-hidden className="lm-tilt-glare pointer-events-none absolute inset-0 rounded-[inherit]" />
      {children}
    </div>
  );
}
