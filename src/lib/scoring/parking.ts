import { cellToLatLng } from "h3-js";
import { haversine } from "../data/geo";

// Parking information for renters who have a car. Information only: it never enters the scores and never dims the map.
// The data is a committed snapshot (scripts/parking/build.ts), so the app makes no network call for it.

export type ParkingKind = "surface" | "garage" | "other";
export type ParkingAccess = "public" | "customers" | "permit" | "private";

/** Off-street car parks and garages: [lat, lng, kind, access, fee (1 yes, 0 no, -1 unknown), capacity (0 unknown)] */
export type CarParkRow = [number, number, ParkingKind, ParkingAccess, -1 | 0 | 1, number];
/** [lat, lng, name] */
export type ParkRideRow = [number, number, string];
/** [lat, lng] */
export type MeterRow = [number, number];
/** Street parking is mapped as many short segments, so they are pooled per ~100 m cell: [lat, lng, segments, tagged paid, tagged free] */
export type StreetRow = [number, number, number, number, number];

export type ParkingData = {
  retrieved: { osm: string | null; msip: string | null };
  /** Parking meters in the city GIS describe the state of this month (year-month). */
  metersAsOf: string | null;
  carParks: CarParkRow[];
  streets: StreetRow[];
  parkRide: ParkRideRow[];
  meters: MeterRow[];
};

/** Pin colours on the map and in the map key. */
export const PARKING_COLORS = { carpark: "#1d4ed8", parkride: "#7c3aed", meter: "#64748b" } as const;

export const METER_LABEL = "Parkometr: parkowanie przy ulicy w pobliżu jest prawdopodobnie płatne";
export const PARKING_CAVEAT = "Orientacyjnie, na podstawie publicznych danych mapowych; nie gwarantuje wolnego miejsca.";

export const NEAR_M = 500;
export const FAR_M = 1000;

export type ParkingFacts = {
  /** Which sources the snapshot actually has; a missing one is "no data", never zero. */
  availability: { osm: boolean; meters: boolean };
  carParks: {
    /** Publicly usable car parks (open to anyone, possibly for a fee). */
    within500: number;
    within1000: number;
    nearest: { distanceM: number; kind: ParkingKind; fee: -1 | 0 | 1 } | null;
    /** Lots that exist but are private, for customers or for permit holders, which are not counted above. */
    restricted: number;
  };
  /** Street parking mapped in OpenStreetMap around the point (segments, not spaces). */
  streets: { within500: number; paid: number; free: number };
  meters: { within500: number };
  parkRide: { nearest: { name: string; distanceM: number } | null };
};

const isPublic = (a: ParkingAccess) => a === "public";

/** Facts around a point (the hexagon centre). Distances are straight lines, rounded to 10 m. */
export function parkingAround(center: [number, number], data: ParkingData): ParkingFacts {
  const [lat, lng] = center;
  const dist = (r: readonly [number, number, ...unknown[]]) => haversine([lng, lat], [r[1], r[0]]);
  const round10 = (m: number) => Math.round(m / 10) * 10;

  let within500 = 0;
  let within1000 = 0;
  let restricted = 0;
  let nearest: ParkingFacts["carParks"]["nearest"] = null;
  let nearestD = Infinity;
  for (const row of data.carParks) {
    const d = dist(row);
    if (d > FAR_M) continue;
    if (!isPublic(row[3])) {
      restricted++;
      continue;
    }
    within1000++;
    if (d <= NEAR_M) within500++;
    if (d < nearestD) {
      nearestD = d;
      nearest = { distanceM: round10(d), kind: row[2], fee: row[4] };
    }
  }

  let streets = 0;
  let streetPaid = 0;
  let streetFree = 0;
  for (const s of data.streets) {
    if (dist(s) > NEAR_M) continue;
    streets += s[2];
    streetPaid += s[3];
    streetFree += s[4];
  }

  let meters = 0;
  for (const m of data.meters) if (dist(m) <= NEAR_M) meters++;

  let ride: ParkingFacts["parkRide"]["nearest"] = null;
  let rideD = Infinity;
  for (const r of data.parkRide) {
    const d = dist(r);
    if (d < rideD) {
      rideD = d;
      ride = { name: r[2], distanceM: round10(d) };
    }
  }

  return {
    availability: { osm: data.carParks.length > 0 || data.streets.length > 0 || data.parkRide.length > 0, meters: data.meters.length > 0 },
    carParks: { within500, within1000, nearest, restricted },
    streets: { within500: streets, paid: streetPaid, free: streetFree },
    meters: { within500: meters },
    parkRide: { nearest: ride },
  };
}

export function parkingForCell(h3Index: string, data: ParkingData): ParkingFacts {
  return parkingAround(cellToLatLng(h3Index) as [number, number], data);
}

export type ParkingPin = { kind: "carpark" | "parkride" | "meter"; lat: number; lng: number; label: string };

/** Everything within `radiusM` of the point, for the map pins. Private lots are left out. */
export function parkingPins(center: [number, number], data: ParkingData, radiusM = FAR_M): ParkingPin[] {
  const [lat, lng] = center;
  const near = (r: readonly [number, number, ...unknown[]]) => haversine([lng, lat], [r[1], r[0]]) <= radiusM;
  return [
    ...data.carParks
      .filter((r) => isPublic(r[3]) && near(r))
      .map((r): ParkingPin => ({ kind: "carpark", lat: r[0], lng: r[1], label: carParkLabel(r) })),
    ...data.parkRide.filter(near).map((r): ParkingPin => ({ kind: "parkride", lat: r[0], lng: r[1], label: `Parkuj i jedź (P+R): ${r[2]}` })),
    ...data.meters.filter(near).map((r): ParkingPin => ({ kind: "meter", lat: r[0], lng: r[1], label: METER_LABEL })),
  ];
}

const KIND_LABEL: Record<ParkingKind, string> = { surface: "Parking", garage: "Garaż", other: "Parking" };

export function carParkLabel(r: CarParkRow): string {
  const fee = r[4] === 1 ? ", płatny" : r[4] === 0 ? ", bezpłatny" : "";
  const cap = r[5] > 0 ? `, ok. ${r[5]} miejsc` : "";
  return `${KIND_LABEL[r[2]]}${fee}${cap}`;
}

export const kindLabel = (k: ParkingKind) => KIND_LABEL[k].toLowerCase();
