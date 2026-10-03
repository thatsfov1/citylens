"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cellToLatLng } from "h3-js";
import { KRAKOW_CENTER, KRAKOW_INITIAL_ZOOM } from "@/lib/h3/config";
import { cellPolygon } from "@/lib/h3/grid";
import { GREEN_COLOR, PLACE_COLORS, circleRing, placeTitle } from "@/lib/map/places";
import { placeIconId, registerPlaceIcons } from "@/lib/map/place-icons";
import { KRAKOW_BOUNDS, boundaryFeature, outsideMaskFeature } from "@/lib/h3/mask";
import { calculatePersonalScore } from "@/lib/scoring/personal-score";
import { percentileRanks } from "@/lib/scoring/percentile";
import { BAND_COLORS, BAND_LABELS, NO_DATA_BAND, NO_DATA_COLOR, bandOf, bandZones, districtLayers, topZone } from "@/lib/map/zones";
import { CATEGORIES, type Category, type CategoryWeights, type HexData, type MapMode, type PlacesResponse } from "@/types";

const SOURCE = "hexes";
const ZONES_SOURCE = "zones";
const DIMMED_OPACITY = 0.6;
const TOP_SOURCE = "top-zone";
const DISTRICT_LINE_SOURCE = "district-outlines";
const DISTRICT_LABEL_SOURCE = "district-labels";
const PLACES_SOURCE = "places";
const GREEN_SOURCE = "place-green";
const RING_SOURCE = "place-rings";
const DRILL_ZOOM = 14.2;
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

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

// Minimal, monochrome basemap (Uber-like): flat grey land, pale water, white roads, no clutter.
const HIDDEN_LAYERS = new Set([
  "building",
  "landcover_wood",
  "landcover_ice_shelf",
  "landcover_glacier",
  "highway_path",
  "highway_major_casing",
  "highway_motorway_casing",
  "highway_motorway_bridge_casing",
  "tunnel_motorway_casing",
  "waterway",
  "waterway_line_label",
  "water_name_point_label",
  "water_name_line_label",
  "road_area_pier",
  "road_pier",
  "boundary_3",
  "boundary_2",
  "boundary_disputed",
]);

function softenBasemap(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers) {
    const src = (layer as { "source-layer"?: string })["source-layer"];
    const id = layer.id;
    if (HIDDEN_LAYERS.has(id) || id.startsWith("railway") || id.startsWith("highway-shield") || id === "road_shield_us") {
      map.setLayoutProperty(id, "visibility", "none");
    } else if (layer.type === "background") {
      map.setPaintProperty(id, "background-color", "#f4f4f4");
    } else if (id === "water") {
      map.setPaintProperty(id, "fill-color", "#dde3e8");
    } else if (id === "park" || id === "landuse_residential") {
      map.setPaintProperty(id, "fill-color", id === "park" ? "#ebedeb" : "#f4f4f4");
    } else if (layer.type === "line" && src === "transportation") {
      map.setPaintProperty(id, "line-color", "#ffffff");
      map.setPaintProperty(id, "line-opacity", id === "highway_minor" ? 0.9 : 1);
    } else if (layer.type === "symbol" && src === "place") {
      // District names are redrawn above the hexes (district-label layer).
      map.setLayoutProperty(id, "visibility", "none");
    } else if (layer.type === "symbol" && src) {
      map.setPaintProperty(id, "text-color", "#8a8f94");
      map.setPaintProperty(id, "text-opacity", 0.7);
      map.setPaintProperty(id, "icon-opacity", 0.5);
    }
  }
}

type Tip = { x: number; y: number; district: string; label: string; value: string };

type Props = {
  hexes: HexData[];
  weights: CategoryWeights;
  mode: MapMode;
  selected: string | null;
  onSelect: (h3Index: string | null) => void;
  /** Places behind the selected hexagon, shown as pins once the camera flies in. */
  places: PlacesResponse | null;
  pinCategories: ReadonlySet<Category>;
  hoveredPlace: number | null;
  onHoverPlace: (id: number | null) => void;
  /** Ease the camera to this place (e.g. list row clicked); `n` makes repeated clicks re-trigger. */
  focusPlace: { id: number; n: number } | null;
};

export function HexMap({ hexes, weights, mode, selected, onSelect, places, pinCategories, hoveredPlace, onHoverPlace, focusPlace }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const fitRef = useRef<{ zoom: number; center: [number, number] } | null>(null);
  const [zoomedIn, setZoomedIn] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const modeRef = useRef(mode);
  const [showTop, setShowTop] = useState(false);
  const showTopRef = useRef(showTop);
  const [showDistricts, setShowDistricts] = useState(true);
  const showDistrictsRef = useRef(showDistricts);
  const onHoverPlaceRef = useRef(onHoverPlace);
  // True while our own flyTo runs: the view-lock in sync() must not jumpTo() (it would cancel the flight).
  const flyingRef = useRef(false);
  const beforeDrill = useRef<{ center: [number, number]; zoom: number } | null>(null);

  const pinsGeoJson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: (places?.places ?? [])
        .filter((p) => pinCategories.has(p.category))
        .map((p) => ({
          type: "Feature",
          id: p.id,
          properties: { id: p.id, category: p.category, title: placeTitle(p), icon: placeIconId(p.category, p.kind) },
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        })),
    }),
    [places, pinCategories],
  );
  const greenGeoJson = pinCategories.has("greenery") && places ? places.green : EMPTY;

  const { geojson, zones, tops } = useMemo(() => {
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
    const tops = Object.fromEntries(
      Object.entries(pct).map(([m, v]) => [m, topZone(cells, v)]),
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
    return { geojson, zones, tops };
  }, [hexes, weights]);

  const districts = useMemo(() => districtLayers(hexes), [hexes]);

  // Latest values for the one-time map setup (updated before it runs).
  const initial = useRef({ geojson, zones, tops, mode, selected, districts });
  useEffect(() => {
    onSelectRef.current = onSelect;
    onHoverPlaceRef.current = onHoverPlace;
    modeRef.current = mode;
    showTopRef.current = showTop;
    showDistrictsRef.current = showDistricts;
    initial.current = { geojson, zones, tops, mode, selected, districts };
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
      fadeDistrictLabels();
    };
    // District names fade in as you zoom in from the whole-city view.
    const fadeDistrictLabels = () => {
      const fit = fitRef.current;
      if (!fit || !map.getLayer("district-label")) return;
      map.setPaintProperty("district-label", "text-opacity", [
        "interpolate", ["linear"], ["zoom"], fit.zoom + 0.15, 0, fit.zoom + 0.9, 0.8,
      ]);
      map.setPaintProperty("district-label", "text-halo-width", [
        "interpolate", ["linear"], ["zoom"], fit.zoom + 0.15, 0, fit.zoom + 0.9, 1.5,
      ]);
    };
    const sync = () => {
      const fit = fitRef.current;
      if (!fit) return;
      const z = map.getZoom();
      setZoomedIn(z > fit.zoom + RECENTER_THRESHOLD);
      if (flyingRef.current) return;
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
    map.on("moveend", () => {
      flyingRef.current = false;
      sync();
    });
    map.on("resize", () => {
      applyFit();
      if (fitRef.current && map.getZoom() < fitRef.current.zoom) map.jumpTo(fitRef.current);
      sync();
    });

    map.on("load", () => {
      const { geojson, zones, tops, mode, selected, districts } = initial.current;

      softenBasemap(map);

      // Veil everything outside Kraków, then redraw airports above the veil.
      map.addSource("mask", { type: "geojson", data: outsideMaskFeature });
      map.addLayer({
        id: "outside-mask",
        type: "fill",
        source: "mask",
        paint: { "fill-color": "#f4f4f4", "fill-opacity": 0.86 },
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

      // District borders + names above the colours.
      map.addSource(DISTRICT_LINE_SOURCE, { type: "geojson", data: districts.outlines });
      map.addLayer({
        id: "district-line",
        type: "line",
        source: DISTRICT_LINE_SOURCE,
        layout: { "line-join": "round", visibility: showDistrictsRef.current ? "visible" : "none" },
        paint: { "line-color": "#334155", "line-width": 1.2, "line-opacity": 0.4 },
      });
      map.addSource(DISTRICT_LABEL_SOURCE, { type: "geojson", data: districts.labels });
      map.addLayer({
        id: "district-label",
        type: "symbol",
        source: DISTRICT_LABEL_SOURCE,
        maxzoom: 14,
        layout: {
          visibility: showDistrictsRef.current ? "visible" : "none",
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-transform": "uppercase",
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 9, 14, 13],
          "text-letter-spacing": 0.06,
          "text-max-width": 8,
        },
        paint: { "text-color": "#334155", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
      });

      fadeDistrictLabels();

      map.addSource(TOP_SOURCE, { type: "geojson", data: tops[mode] });
      map.addLayer({
        id: "top-line",
        type: "line",
        source: TOP_SOURCE,
        layout: { "line-join": "round", visibility: showTopRef.current ? "visible" : "none" },
        paint: { "line-color": "#0f5132", "line-width": 2.5, "line-opacity": 0.9 },
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

      // Drill-down layers: distance rings, park outlines and place pins (only filled for a selected hexagon).
      map.addSource(RING_SOURCE, { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "place-rings",
        type: "line",
        source: RING_SOURCE,
        paint: { "line-color": "#334155", "line-width": 1.2, "line-opacity": 0.55, "line-dasharray": [2, 3] },
      });
      map.addSource(GREEN_SOURCE, { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "place-green-fill",
        type: "fill",
        source: GREEN_SOURCE,
        paint: { "fill-color": GREEN_COLOR, "fill-opacity": 0.3 },
      });
      map.addLayer({
        id: "place-green-line",
        type: "line",
        source: GREEN_SOURCE,
        paint: { "line-color": GREEN_COLOR, "line-width": 1.5, "line-opacity": 0.9 },
      });
      void registerPlaceIcons(map); // pins render as soon as the images land
      map.addSource(PLACES_SOURCE, { type: "geojson", data: EMPTY });
      const pinColor = [
        "match",
        ["get", "category"],
        ...Object.entries(PLACE_COLORS).flat(),
        "#64748b",
      ] as unknown as maplibregl.ExpressionSpecification;
      map.addLayer({
        id: "place-hover",
        type: "circle",
        source: PLACES_SOURCE,
        filter: ["==", ["get", "id"], -1],
        paint: { "circle-radius": 14, "circle-color": pinColor, "circle-opacity": 0.3 },
      });
      map.addLayer({
        id: "place-pins",
        type: "symbol",
        source: PLACES_SOURCE,
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": 0.55,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
      map.addLayer({
        id: "place-labels",
        type: "symbol",
        source: PLACES_SOURCE,
        minzoom: 14,
        layout: {
          "text-field": ["get", "title"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: { "text-color": "#0f172a", "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
      });
      readyRef.current = true;
    });

    map.on("mousemove", "place-pins", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const id = e.features?.[0]?.properties?.id as number | undefined;
      onHoverPlaceRef.current(id ?? null);
    });
    map.on("mouseleave", "place-pins", () => onHoverPlaceRef.current(null));
    map.on("click", "hex-fill", (e) => {
      if (map.queryRenderedFeatures(e.point, { layers: ["place-pins"] }).length > 0) return;
      const id = e.features?.[0]?.properties?.h3Index as string | undefined;
      if (id) onSelectRef.current(id);
    });
    map.on("click", (e) => {
      if (!map.getLayer("hex-fill")) return;
      if (
        map.queryRenderedFeatures(e.point, { layers: ["hex-fill", "place-pins"] }).length === 0
      ) {
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
    (map.getSource(TOP_SOURCE) as maplibregl.GeoJSONSource).setData(tops[mode]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mode handled by the effect below
  }, [geojson, zones, tops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(DISTRICT_LINE_SOURCE) as maplibregl.GeoJSONSource).setData(districts.outlines);
    (map.getSource(DISTRICT_LABEL_SOURCE) as maplibregl.GeoJSONSource).setData(districts.labels);
  }, [districts]);

  // Mode switch → swap the dissolved zones.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(ZONES_SOURCE) as maplibregl.GeoJSONSource).setData(zones[mode]);
    (map.getSource(TOP_SOURCE) as maplibregl.GeoJSONSource).setData(tops[mode]);
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

  // Selecting a hexagon flies in; deselecting flies back to where the user was.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (selected) {
      if (!beforeDrill.current) {
        const c = map.getCenter();
        beforeDrill.current = { center: [c.lng, c.lat], zoom: map.getZoom() };
      }
      const [lat, lng] = cellToLatLng(selected);
      const right = window.innerWidth >= 640 ? SIDEBAR_WIDTH + FIT_PADDING : 0;
      const bottom = window.innerWidth >= 640 ? 0 : window.innerHeight * 0.5;
      flyingRef.current = true;
      map.flyTo({
        center: [lng, lat],
        zoom: Math.max(map.getZoom(), DRILL_ZOOM),
        padding: { top: 0, left: 0, right, bottom },
        duration: 900,
        essential: true,
      });
    } else if (beforeDrill.current) {
      const { center, zoom } = beforeDrill.current;
      beforeDrill.current = null;
      flyingRef.current = true;
      map.flyTo({ center, zoom, padding: { top: 0, left: 0, right: 0, bottom: 0 }, duration: 700 });
    }
  }, [selected]);

  // Distance guide: 500 m and 1 km around the hexagon centre (what the score "saw").
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource(RING_SOURCE) as maplibregl.GeoJSONSource;
    if (!selected) {
      src.setData(EMPTY);
      return;
    }
    const [lat, lng] = cellToLatLng(selected);
    src.setData({
      type: "FeatureCollection",
      features: [500, 1000].map((r) => ({
        type: "Feature",
        properties: { r },
        geometry: { type: "LineString", coordinates: circleRing([lng, lat], r) },
      })),
    });
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(PLACES_SOURCE) as maplibregl.GeoJSONSource).setData(selected ? pinsGeoJson : EMPTY);
    (map.getSource(GREEN_SOURCE) as maplibregl.GeoJSONSource).setData(selected ? greenGeoJson : EMPTY);
  }, [selected, pinsGeoJson, greenGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setFilter("place-hover", ["==", ["get", "id"], hoveredPlace ?? -1]);
  }, [hoveredPlace]);

  useEffect(() => {
    const map = mapRef.current;
    const p = focusPlace && places?.places.find((x) => x.id === focusPlace.id);
    if (!map || !p) return;
    map.easeTo({ center: [p.lng, p.lat], duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to explicit focus requests only
  }, [focusPlace]);

  // District borders + names toggle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const v = showDistricts ? "visible" : "none";
    map.setLayoutProperty("district-line", "visibility", v);
    map.setLayoutProperty("district-label", "visibility", v);
  }, [showDistricts]);

  // "Strongest areas" toggle: outline the top 10% and frame them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setLayoutProperty("top-line", "visibility", showTop ? "visible" : "none");
    if (!showTop) return;
    const coords = tops[mode].features.flatMap((f) =>
      (f.geometry as GeoJSON.MultiPolygon).coordinates.flat(2),
    ) as [number, number][];
    if (coords.length === 0) return;
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coords[0], coords[0]),
    );
    const right = window.innerWidth >= 640 ? SIDEBAR_WIDTH + FIT_PADDING : FIT_PADDING;
    map.fitBounds(bounds, {
      padding: { top: 64, bottom: FIT_PADDING, left: FIT_PADDING, right },
      maxZoom: 13.5,
      duration: 700,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-frame when toggled or mode changes
  }, [showTop, mode]);

  // MapLibre forces position:relative on its container, so size it via a wrapper.
  const recenter = () => {
    const fit = fitRef.current;
    if (fit) mapRef.current?.flyTo({ center: fit.center, zoom: fit.zoom, duration: 700 });
  };

  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
      <div className="absolute right-3 top-28 z-10 flex flex-col items-end gap-2 sm:bottom-6 sm:left-1/2 sm:right-auto sm:top-auto sm:-translate-x-1/2 sm:flex-row">
      <button
        type="button"
        onClick={() => setShowTop((v) => !v)}
        aria-pressed={showTop}
        className={`rounded-full border px-4 py-2 text-sm font-medium shadow-lg backdrop-blur ${
          showTop
            ? "border-emerald-800 bg-emerald-800 text-white"
            : "border-border/70 bg-white/95 hover:bg-white"
        }`}
      >
        Strongest areas
      </button>
      <button
        type="button"
        onClick={() => setShowDistricts((v) => !v)}
        aria-pressed={showDistricts}
        className={`rounded-full border px-4 py-2 text-sm font-medium shadow-lg backdrop-blur ${
          showDistricts
            ? "border-slate-800 bg-slate-800 text-white"
            : "border-border/70 bg-white/95 hover:bg-white"
        }`}
      >
        Districts
      </button>
      </div>
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
