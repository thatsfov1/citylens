import { getDemoCells } from "../h3/grid";
import { getMockScores } from "./mock-scores";
import type { HexData } from "../../types";

let cache: HexData[] | null = null;

/** Hex cells for the demo area with their (mock) category scores. */
export function getHexData(): HexData[] {
  cache ??= getDemoCells().map((h3Index) => ({
    h3Index,
    scores: getMockScores(h3Index),
  }));
  return cache;
}
