"use client";

import { useEffect, useState } from "react";
import type { LiveAirResponse } from "@/lib/data/air-live";
import { fetchCached } from "@/lib/map/hex-cache";

/** Fresh air-quality values for every area, fetched once after the map is up. Null until they arrive or if the request fails: the stored snapshot stays on screen. */
export function useLiveAir(enabled: boolean): LiveAirResponse | null {
  const [data, setData] = useState<LiveAirResponse | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    fetchCached<LiveAirResponse>("/api/air", ctrl.signal)
      .then((d) => d && setData(d))
      .catch(() => {});
    return () => ctrl.abort();
  }, [enabled]);
  return data;
}
