"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { KRAKOW_CENTER, KRAKOW_INITIAL_ZOOM } from "@/lib/h3/config";
import { cellPolygon } from "@/lib/h3/grid";
import { KRAKOW_BOUNDS, boundaryFeature, outsideMaskFeature } from "@/lib/h3/mask";
import { calculatePersonalScore } from "@/lib/scoring/personal-score";
import { percentileRanks } from "@/lib/scoring/percentile";
import { CATEGORIES, type CategoryWeights, type HexData, type MapMode } from "@/types";

const SOURCE = "hexes";

// Once zoomed in by more than this (zoom levels) beyond the "whole city fits" view,
// the recenter button appears.
const RECENTER_THRESHOLD = 0.35;
const FIT_PADDING = 24;
const SIDEBAR_WIDTH = 380;

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
  const fitRef = useRef<{ zoom: number; center: [number, number] } | null>(null);
  const [zoomedIn, setZoomedIn] = useState(false);

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

    // The whole city visible (clear of the side panel on desktop) = the minimum zoom.
    // At that view the map is locked; zooming in unlocks panning within the city bbox.
    // (Not maxBounds: MapLibre would force the bbox to cover the whole viewport.)
    const applyFit = () => {
      const right = window.innerWidth >= 640 ? SIDEBAR_WIDTH + FIT_PADDING : FIT_PADDING;
      const cam = map.cameraForBounds(KRAKOW_BOUNDS, {
        padding: { top: 64, bottom: FIT_PADDING, left: FIT_PADDING, right },
      });
      if (!cam || cam.zoom === undefined || !cam.center) return;
      const { lng, lat } = maplibregl.LngLat.convert(cam.center);
      fitRef.current = { zoom: cam.zoom, center: [lng, lat] };
      map.setMinZoom(cam.zoom);
    };
    const sync = () => {
      const fit = fitRef.current;
      if (!fit) return;
      const z = map.getZoom();
      setZoomedIn(z > fit.zoom + RECENTER_THRESHOLD);
      const locked = z <= fit.zoom + 0.01;
      if (locked) {
        map.dragPan.disable();
        const c = map.getCenter();
        if (Math.abs(c.lng - fit.center[0]) > 1e-6 || Math.abs(c.lat - fit.center[1]) > 1e-6) {
          map.jumpTo({ center: fit.center });
        }
        return;
      }
      map.dragPan.enable();
      const c = map.getCenter();
      const [[w, s], [e, n]] = KRAKOW_BOUNDS;
      const lng = Math.min(Math.max(c.lng, w), e);
      const lat = Math.min(Math.max(c.lat, s), n);
      if (lng !== c.lng || lat !== c.lat) map.jumpTo({ center: [lng, lat] });
    };
    applyFit();
    if (fitRef.current) map.jumpTo(fitRef.current);
    sync();
    map.on("move", sync);
    map.on("resize", () => {
      applyFit();
      if (fitRef.current && map.getZoom() < fitRef.current.zoom) map.jumpTo(fitRef.current);
      sync();
    });

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
  const recenter = () => {
    const fit = fitRef.current;
    if (fit) mapRef.current?.flyTo({ center: fit.center, zoom: fit.zoom, duration: 700 });
  };

  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
      {zoomedIn && (
        <button
          type="button"
          onClick={recenter}
          aria-label="Center map on Kraków"
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border/70 bg-white/95 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur hover:bg-white sm:left-auto sm:right-[25rem] sm:translate-x-0"
        >
          Center map
        </button>
      )}
    </div>
  );
}
