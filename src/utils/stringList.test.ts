import { describe, expect, it } from "vitest";
import { toStringList } from "./stringList";

describe("toStringList", () => {
  it("returns string arrays as-is", () => {
    expect(toStringList(["Barossa", "Bordeaux"])).toEqual([
      "Barossa",
      "Bordeaux",
    ]);
  });

  it("flattens Region-style objects to their names", () => {
    expect(
      toStringList([
        { id: 1, name: "Barossa" },
        { id: 2, name: "Bordeaux" },
      ]),
    ).toEqual(["Barossa", "Bordeaux"]);
  });

  it("parses JSON-encoded strings from legacy text columns", () => {
    // The exact shape GET /api/v1/wine_profiles/search returns.
    expect(toStringList('["Northern Rhone","Barossa Valley"]')).toEqual([
      "Northern Rhone",
      "Barossa Valley",
    ]);
  });

  it("keeps plain strings as a single value", () => {
    expect(toStringList("Barossa")).toEqual(["Barossa"]);
    expect(toStringList("  Barossa  ")).toEqual(["Barossa"]);
  });

  it("returns [] for null, undefined and blank input without throwing", () => {
    expect(toStringList(null)).toEqual([]);
    expect(toStringList(undefined)).toEqual([]);
    expect(toStringList("")).toEqual([]);
    expect(toStringList("   ")).toEqual([]);
  });

  it("never throws on malformed legacy text", () => {
    expect(toStringList('["unclosed')).toEqual(['["unclosed']);
    expect(toStringList(42 as unknown)).toEqual([]);
  });
});
