"use client";

import { useEffect, useMemo, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { KRAKOW_CENTER, KRAKOW_INITIAL_ZOOM } from "@/lib/h3/config";
import { cellPolygon } from "@/lib/h3/grid";
import { getHexData } from "@/lib/mock-data/hexes";
import { calculatePersonalScore } from "@/lib/scoring/personal-score";
import type { CategoryWeights, MapMode } from "@/types";

const SOURCE = "hexes";

// Worker files are copied to /public/maplibre by scripts/copy-maplibre-worker.mjs.
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// Score → colour. Green = stronger match, red = weaker match (not "bad").
// Stops are tighter than 0–100 because mock scores cluster mid-range.
export const SCORE_COLORS: [number, string][] = [
  [25, "#d9453b"],
  [40, "#f08a3c"],
  [52, "#f2d14b"],
  [65, "#8cc152"],
  [80, "#12915a"],
];

const colorExpression = (mode: MapMode) =>
  [
    "interpolate",
    ["linear"],
    ["get", mode === "forYou" ? "personal" : mode],
    ...SCORE_COLORS.flat(),
  ] as maplibregl.ExpressionSpecification;

type Props = {
  weights: CategoryWeights;
  mode: MapMode;
  selected: string | null;
  onSelect: (h3Index: string | null) => void;
};

export function HexMap({ weights, mode, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelect);

  const geojson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: getHexData().map(({ h3Index, scores }) => ({
        type: "Feature",
        properties: {
          h3Index,
          ...scores,
          personal: calculatePersonalScore(scores, weights),
        },
        geometry: { type: "Polygon", coordinates: [cellPolygon(h3Index)] },
      })),
    }),
    [weights],
  );

  // Latest values for the one-time map setup (updated before it runs).
  const initial = useRef({ geojson, mode, selected });
  useEffect(() => {
    onSelectRef.current = onSelect;
    initial.current = { geojson, mode, selected };
  });

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      center: [KRAKOW_CENTER.lng, KRAKOW_CENTER.lat],
      zoom: KRAKOW_INITIAL_ZOOM,
      minZoom: 9,
      maxZoom: 16,
      attributionControl: { compact: true },
      // Keyless vector basemap (OpenStreetMap data via OpenFreeMap).
      style: "https://tiles.openfreemap.org/styles/positron",
    });
    mapRef.current = map;

    map.on("load", () => {
      const { geojson, mode, selected } = initial.current;
      map.addSource(SOURCE, { type: "geojson", data: geojson });
      map.addLayer({
        id: "hex-fill",
        type: "fill",
        source: SOURCE,
        paint: {
          "fill-color": colorExpression(mode),
          "fill-opacity": 0.62,
          "fill-color-transition": { duration: 350 },
        },
      });
      map.addLayer({
        id: "hex-line",
        type: "line",
        source: SOURCE,
        paint: { "line-color": "#ffffff", "line-width": 0.6, "line-opacity": 0.7 },
      });
      map.addLayer({
        id: "hex-selected",
        type: "line",
        source: SOURCE,
        filter: ["==", ["get", "h3Index"], selected ?? ""],
        paint: { "line-color": "#0f172a", "line-width": 3 },
      });
      readyRef.current = true;
    });

    map.on("click", "hex-fill", (e) => {
      const id = e.features?.[0]?.properties?.h3Index as string | undefined;
      if (id) onSelectRef.current(id);
    });
    map.on("click", (e) => {
      if (!map.getLayer("hex-fill")) return;
      if (map.queryRenderedFeatures(e.point, { layers: ["hex-fill"] }).length === 0) {
        onSelectRef.current(null);
      }
    });
    map.on("mouseenter", "hex-fill", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "hex-fill", () => (map.getCanvas().style.cursor = ""));

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Weights changed → new personalized values.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(SOURCE) as maplibregl.GeoJSONSource).setData(geojson);
  }, [geojson]);

  // Mode switch → recolor via paint expression (no data reload).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setPaintProperty("hex-fill", "fill-color", colorExpression(mode));
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setFilter("hex-selected", ["==", ["get", "h3Index"], selected ?? ""]);
  }, [selected]);

  // MapLibre forces position:relative on its container, so size it via a wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
    </div>
  );
}
