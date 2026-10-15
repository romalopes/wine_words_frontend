import { formatEngagementsPer100Views } from "./format";

describe("formatEngagementsPer100Views", () => {
  it("formats the API's already-scaled per-100 value without a percent sign", () => {
    expect(formatEngagementsPer100Views(166.67)).toBe("166.7");
  });

  it("returns an em dash for missing values", () => {
    expect(formatEngagementsPer100Views(null)).toBe("—");
  });
});