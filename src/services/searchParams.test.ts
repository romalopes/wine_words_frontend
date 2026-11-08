import {
  buildQuery,
  effectiveSearchTerm,
  MIN_SEARCH_LENGTH,
  pruneDefaults,
} from "./searchParams";
import type { SearchParams } from "./searchParams";

describe("pruneDefaults", () => {
  const defaults = { page: 1, per_page: 20, sort: "relevance", query: "" };

  it("drops entries that only restate a default", () => {
    expect(
      pruneDefaults(
        { page: 1, per_page: 20, sort: "relevance", query: "" },
        defaults,
      ),
    ).toEqual({});
  });

  it("keeps entries that differ from the default", () => {
    expect(
      pruneDefaults(
        { page: 2, per_page: 50, sort: "recent", query: "malbec" },
        defaults,
      ),
    ).toEqual({ page: 2, per_page: 50, sort: "recent", query: "malbec" });
  });

  it("compares numbers with their string form", () => {
    // A caller may declare `per_page: "20"` while the URL parser yields `20`.
    const stringParams = {
      page: "1",
      per_page: "20",
    } as unknown as SearchParams;

    expect(pruneDefaults(stringParams, defaults)).toEqual({});
    expect(pruneDefaults({ page: 1, per_page: 20 }, stringParams)).toEqual({});
  });

  it("keeps keys the caller never declared a default for", () => {
    expect(pruneDefaults({ status: "draft", category_id: 3 }, defaults)).toEqual({
      status: "draft",
      category_id: 3,
    });
  });

  it("keeps everything when there are no defaults", () => {
    const params = { page: 1, per_page: 20, sort: "relevance" };
    expect(pruneDefaults(params)).toEqual(params);
  });

  it("leaves blank values for buildQuery to drop", () => {
    // `pruneDefaults` only removes defaults; `buildQuery` is what skips empty
    // values, so the two together are what produce a clean query string.
    expect(pruneDefaults({ query: "" }, {})).toEqual({ query: "" });
    expect(pruneDefaults({ query: "" }, defaults)).toEqual({});
    expect(buildQuery(pruneDefaults({ page: 1, query: "" }, defaults))).toBe("");
  });
});

describe("effectiveSearchTerm", () => {
  it("defaults to a three-character minimum", () => {
    expect(MIN_SEARCH_LENGTH).toBe(3);
  });

  it("blanks terms shorter than the minimum", () => {
    expect(effectiveSearchTerm("")).toBe("");
    expect(effectiveSearchTerm("b")).toBe("");
    expect(effectiveSearchTerm("ba")).toBe("");
  });

  it("keeps terms at or above the minimum", () => {
    expect(effectiveSearchTerm("bar")).toBe("bar");
    expect(effectiveSearchTerm("barolo")).toBe("barolo");
  });

  it("trims surrounding whitespace before measuring", () => {
    expect(effectiveSearchTerm("  ba  ")).toBe("");
    expect(effectiveSearchTerm("  bar  ")).toBe("bar");
  });

  it("treats URL-parsed numbers as strings", () => {
    expect(effectiveSearchTerm(123)).toBe("123");
    expect(effectiveSearchTerm(undefined)).toBe("");
  });

  it("honours a custom minimum", () => {
    expect(effectiveSearchTerm("ba", 2)).toBe("ba");
    expect(effectiveSearchTerm("b", 2)).toBe("");
  });
});
