"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { SAVED_KEY, loadSaved } from "@/lib/share/saved";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
// A string snapshot: React compares it by value, so the list is only parsed when the stored text changes.
const snapshot = () => {
  try {
    return localStorage.getItem(SAVED_KEY) ?? "";
  } catch {
    return "";
  }
};

/** "Continue" link to the most recently saved map; renders nothing when none is saved on this device. */
export function SavedMapLink() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const latest = raw ? loadSaved()[0] : undefined;
  if (!latest) return null;
  return (
    <Link
      href={`/map?${latest.query}`}
      className="block max-w-[12rem] truncate rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-[#222823] shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
    >
      Wróć do: {latest.name}
    </Link>
  );
}
