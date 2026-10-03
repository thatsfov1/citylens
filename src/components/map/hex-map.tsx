"use client";

import { useEffect, useMemo, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { KRAKOW_CENTER, KRAKOW_INITIAL_ZOOM } from "@/lib/h3/config";
import { cellPolygon } from "@/lib/h3/grid";
import { boundaryFeature, outsideMaskFeature } from "@/lib/h3/mask";
import { calculatePersonalScore } from "@/lib/scoring/personal-score";
import { percentileRanks } from "@/lib/scoring/percentile";
import { CATEGORIES, type CategoryWeights, type HexData, type MapMode } from "@/types";

const SOURCE = "hexes";

// Basemap layers that stay crisp outside the city veil (airports + runways).
const KEEP_VISIBLE_LAYERS = [
  "aeroway-taxiway",
  "aeroway-runway-casing",
  "aeroway-area",
  "aeroway-runway",
  "airport",
];

// Worker files are copied to /public/maplibre by scripts/copy-maplibre-worker.mjs.
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// Diverging scale on percentile rank within the city (for the selected mode):
// the middle of the distribution stays invisible; only clearly weaker (red) or
// stronger (green) areas are tinted. Weaker match ≠ worse place.
const WEAK = "217,69,59";
const STRONG = "18,145,90";
const rgba = (rgb: string, a: number) => `rgba(${rgb},${a})`;

export const LEGEND_GRADIENT = `linear-gradient(to right, ${rgba(WEAK, 1)}, #e5e7eb 35%, #e5e7eb 65%, ${rgba(STRONG, 1)})`;

const pctProp = (mode: MapMode) => `pct_${mode}`;

const colorExpression = (mode: MapMode) =>
  [
    "interpolate",
    ["linear"],
    ["get", pctProp(mode)],
    0, rgba(WEAK, 0.85),
    0.15, rgba(WEAK, 0.7),
    0.33, rgba(WEAK, 0),
    0.67, rgba(STRONG, 0),
    0.85, rgba(STRONG, 0.7),
    1, rgba(STRONG, 0.85),
  ] as maplibregl.ExpressionSpecification;

// Thin white outline only around tinted hexes, so neutral hexes stay invisible.
const outlineOpacityExpression = (mode: MapMode) =>
  [
    "interpolate",
    ["linear"],
    ["get", pctProp(mode)],
    0, 0.7,
    0.33, 0,
    0.67, 0,
    1, 0.7,
  ] as maplibregl.ExpressionSpecification;

type Props = {
  hexes: HexData[];
  weights: CategoryWeights;
  mode: MapMode;
  selected: string | null;
  onSelect: (h3Index: string | null) => void;
};

export function HexMap({ hexes, weights, mode, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelect);

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const personal = hexes.map((h) => calculatePersonalScore(h.scores, weights));
    const pct: Record<string, number[]> = { forYou: percentileRanks(personal) };
    for (const c of CATEGORIES) {
      pct[c] = percentileRanks(hexes.map((h) => h.scores[c]));
    }
    return {
      type: "FeatureCollection",
      features: hexes.map(({ h3Index, scores }, i) => ({
        type: "Feature",
        properties: {
          h3Index,
          ...scores,
          personal: personal[i],
          ...Object.fromEntries(
            Object.entries(pct).map(([mode, v]) => [pctProp(mode as MapMode), v[i]]),
          ),
        },
        geometry: { type: "Polygon", coordinates: [cellPolygon(h3Index)] },
      })),
    };
  }, [hexes, weights]);

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
    // Keep the city clear of the side panel on desktop.
    if (window.innerWidth >= 640) map.setPadding({ top: 0, bottom: 0, left: 0, right: 380 });

    map.on("load", () => {
      const { geojson, mode, selected } = initial.current;

      // Veil everything outside Kraków, then redraw airports above the veil.
      map.addSource("mask", { type: "geojson", data: outsideMaskFeature });
      map.addLayer({
        id: "outside-mask",
        type: "fill",
        source: "mask",
        paint: { "fill-color": "#f1f3f2", "fill-opacity": 0.86 },
      });
      for (const layer of map.getStyle().layers) {
        if (KEEP_VISIBLE_LAYERS.includes(layer.id)) {
          map.addLayer({ ...layer, id: `${layer.id}-above-mask` });
        }
      }
      map.addSource("boundary", { type: "geojson", data: boundaryFeature });
      map.addLayer({
        id: "boundary-line",
        type: "line",
        source: "boundary",
        paint: {
          "line-color": "#475569",
          "line-width": 1.2,
          "line-opacity": 0.6,
          "line-dasharray": [3, 2],
        },
      });

      map.addSource(SOURCE, { type: "geojson", data: geojson });
      map.addLayer({
        id: "hex-fill",
        type: "fill",
        source: SOURCE,
        paint: {
          "fill-color": colorExpression(mode),
          "fill-color-transition": { duration: 350 },
        },
      });
      map.addLayer({
        id: "hex-line",
        type: "line",
        source: SOURCE,
        paint: {
          "line-color": "#ffffff",
          "line-width": 0.6,
          "line-opacity": outlineOpacityExpression(mode),
        },
      });
      map.addLayer({
        id: "hex-hover",
        type: "line",
        source: SOURCE,
        filter: ["==", ["get", "h3Index"], ""],
        paint: { "line-color": "#0f172a", "line-width": 1.5, "line-opacity": 0.55 },
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
    map.on("mousemove", "hex-fill", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const id = (e.features?.[0]?.properties?.h3Index as string | undefined) ?? "";
      map.setFilter("hex-hover", ["==", ["get", "h3Index"], id]);
    });
    map.on("mouseleave", "hex-fill", () => {
      map.getCanvas().style.cursor = "";
      map.setFilter("hex-hover", ["==", ["get", "h3Index"], ""]);
    });

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
    map.setPaintProperty("hex-line", "line-opacity", outlineOpacityExpression(mode));
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
