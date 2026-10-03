"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { KRAKOW_CENTER, KRAKOW_INITIAL_ZOOM } from "@/lib/h3/config";
import { cellPolygon } from "@/lib/h3/grid";
import { KRAKOW_BOUNDS, boundaryFeature, outsideMaskFeature } from "@/lib/h3/mask";
import { calculatePersonalScore } from "@/lib/scoring/personal-score";
import { percentileRanks } from "@/lib/scoring/percentile";
import { BAND_COLORS, BAND_LABELS, NO_DATA_BAND, NO_DATA_COLOR, bandOf, bandZones } from "@/lib/map/zones";
import { CATEGORIES, type Category, type CategoryWeights, type HexData, type MapMode } from "@/types";

const SOURCE = "hexes";
const ZONES_SOURCE = "zones";
const DIMMED_OPACITY = 0.6;

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

// Five match bands (quintiles of the percentile rank within the city, for the selected
// mode): red → orange → yellow → light green → green. Same-band neighbours are dissolved
// into one zone, so borders appear only where the band changes. Weaker match ≠ worse place.
const ZONE_ALPHA = 0.62;
const hexToRgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
const BAND_FILLS = BAND_COLORS.map((c) => hexToRgba(c, ZONE_ALPHA));
const NO_DATA_FILL = hexToRgba(NO_DATA_COLOR, 0.45);

export const LEGEND_GRADIENT = `linear-gradient(to right, ${BAND_COLORS.map(
  (c, i) => `${c} ${i * 20}%, ${c} ${(i + 1) * 20}%`,
).join(", ")})`;

const pctProp = (mode: MapMode) => `pct_${mode}`;

const zoneColorExpression = [
  "match",
  ["get", "band"],
  ...BAND_FILLS.slice(0, -1).flatMap((c, i) => [i, c]),
  NO_DATA_BAND,
  NO_DATA_FILL,
  BAND_FILLS[BAND_FILLS.length - 1],
] as unknown as maplibregl.ExpressionSpecification;

type Tip = { x: number; y: number; district: string; label: string; value: string };

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
  const [tip, setTip] = useState<Tip | null>(null);
  const modeRef = useRef(mode);

  const { geojson, zones } = useMemo(() => {
    const personal = hexes.map((h) => calculatePersonalScore(h.scores, weights));
    const pct: Record<string, number[]> = { forYou: percentileRanks(personal) };
    for (const c of CATEGORIES) {
      pct[c] = percentileRanks(hexes.map((h) => h.scores[c]));
    }
    const cells = hexes.map((h) => h.h3Index);
    const zones = Object.fromEntries(
      Object.entries(pct).map(([m, v]) => [
        m,
        bandZones(
          cells,
          v.map((p, i) =>
            // Nothing nearby in a category ≠ weak match: shown as "no data".
            m !== "forYou" && hexes[i].scores[m as Category] === 0 ? NO_DATA_BAND : bandOf(p),
          ),
        ),
      ]),
    ) as Record<MapMode, GeoJSON.FeatureCollection>;
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: hexes.map(({ h3Index, scores, district }, i) => ({
        type: "Feature",
        properties: {
          h3Index,
          district: district ?? "",
          ...scores,
          personal: personal[i],
          ...Object.fromEntries(
            Object.entries(pct).map(([mode, v]) => [pctProp(mode as MapMode), v[i]]),
          ),
        },
        geometry: { type: "Polygon", coordinates: [cellPolygon(h3Index)] },
      })),
    };
    return { geojson, zones };
  }, [hexes, weights]);

  // Latest values for the one-time map setup (updated before it runs).
  const initial = useRef({ geojson, zones, mode, selected });
  useEffect(() => {
    onSelectRef.current = onSelect;
    modeRef.current = mode;
    initial.current = { geojson, zones, mode, selected };
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
      const { geojson, zones, mode, selected } = initial.current;

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

      map.addSource(ZONES_SOURCE, { type: "geojson", data: zones[mode] });
      map.addLayer({
        id: "zone-fill",
        type: "fill",
        source: ZONES_SOURCE,
        paint: {
          "fill-color": zoneColorExpression,
          "fill-antialias": false,
          "fill-opacity": selected ? DIMMED_OPACITY : 1,
          "fill-opacity-transition": { duration: 250 },
        },
      });
      map.addLayer({
        id: "zone-line",
        type: "line",
        source: ZONES_SOURCE,
        layout: { "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 1, "line-opacity": 0.85 },
      });

      // Invisible per-hex layer: hit target for hover / click.
      map.addSource(SOURCE, { type: "geojson", data: geojson });
      map.addLayer({
        id: "hex-fill",
        type: "fill",
        source: SOURCE,
        paint: { "fill-color": "#000000", "fill-opacity": 0 },
      });
      map.addLayer({
        id: "hex-hover",
        type: "line",
        source: SOURCE,
        filter: ["==", ["get", "h3Index"], ""],
        paint: { "line-color": "#0f172a", "line-width": 1.5, "line-opacity": 0.55 },
      });
      map.addLayer({
        id: "hex-selected-glow",
        type: "line",
        source: SOURCE,
        filter: ["==", ["get", "h3Index"], selected ?? ""],
        layout: { "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9, "line-blur": 3 },
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
      const props = e.features?.[0]?.properties;
      const id = (props?.h3Index as string | undefined) ?? "";
      map.setFilter("hex-hover", ["==", ["get", "h3Index"], id]);
      if (!props) return;
      const m = modeRef.current;
      const value = m === "forYou" ? props.personal : props[m];
      setTip({
        x: e.point.x,
        y: e.point.y,
        district: (props.district as string) || "Kraków",
        label:
          m !== "forYou" && props[m] === 0
            ? "Nothing nearby"
            : BAND_LABELS[bandOf(props[pctProp(m)] as number)],
        value: `${Math.round(value as number)}`,
      });
    });
    map.on("mouseleave", "hex-fill", () => {
      map.getCanvas().style.cursor = "";
      map.setFilter("hex-hover", ["==", ["get", "h3Index"], ""]);
      setTip(null);
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
    (map.getSource(ZONES_SOURCE) as maplibregl.GeoJSONSource).setData(zones[mode]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mode handled by the effect below
  }, [geojson, zones]);

  // Mode switch → swap the dissolved zones.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(ZONES_SOURCE) as maplibregl.GeoJSONSource).setData(zones[mode]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- zones handled by the effect above
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const filter: maplibregl.FilterSpecification = ["==", ["get", "h3Index"], selected ?? ""];
    map.setFilter("hex-selected", filter);
    map.setFilter("hex-selected-glow", filter);
    // Dim the other zones while an area is selected.
    map.setPaintProperty("zone-fill", "fill-opacity", selected ? DIMMED_OPACITY : 1);
  }, [selected]);

  // MapLibre forces position:relative on its container, so size it via a wrapper.
  const recenter = () => {
    const fit = fitRef.current;
    if (fit) mapRef.current?.flyTo({ center: fit.center, zoom: fit.zoom, duration: 700 });
  };

  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-border/70 bg-white/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur"
          style={{ left: tip.x + 14, top: tip.y + 14 }}
        >
          <div className="font-medium text-slate-900">{tip.district}</div>
          <div className="text-slate-600">
            {tip.label} · {tip.value}/100
          </div>
        </div>
      )}
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
