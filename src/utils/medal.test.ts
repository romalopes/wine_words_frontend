import { describe, it, expect } from "vitest";
import {
  medalForScore,
  medalIdForScore,
  allMedals,
  type MedalId,
} from "./medal";

describe("medalForScore", () => {
  it("returns null for null / undefined", () => {
    expect(medalForScore(null)).toBeNull();
    expect(medalForScore(undefined)).toBeNull();
  });

  it("clamps scores above 100 to Gold", () => {
    expect(medalForScore(101)?.id).toBe("gold");
    expect(medalForScore(999)?.id).toBe("gold");
  });

  it("Gold: 95–100 inclusive", () => {
    expect(medalForScore(95)?.id).toBe("gold");
    expect(medalForScore(100)?.id).toBe("gold");
  });

  it("Silver: 90–94 inclusive", () => {
    expect(medalForScore(90)?.id).toBe("silver");
    expect(medalForScore(94)?.id).toBe("silver");
  });

  it("Bronze: 85–89 inclusive", () => {
    expect(medalForScore(85)?.id).toBe("bronze");
    expect(medalForScore(89)?.id).toBe("bronze");
  });

  it("No medal: below 85", () => {
    expect(medalForScore(84)?.id).toBe("none");
    expect(medalForScore(0)?.id).toBe("none");
    expect(medalForScore(-5)?.id).toBe("none");
  });

  it("boundary transitions are correct", () => {
    const boundaries: Array<[number, MedalId]> = [
      [84, "none"],
      [85, "bronze"],
      [89, "bronze"],
      [90, "silver"],
      [94, "silver"],
      [95, "gold"],
      [100, "gold"],
    ];
    boundaries.forEach(([score, expected]) => {
      expect(medalForScore(score)?.id).toBe(expected);
    });
  });

  it("returns full medal info with description and colour", () => {
    const gold = medalForScore(97);
    expect(gold).not.toBeNull();
    expect(gold?.name).toBe("Gold Medal");
    expect(gold?.description).toBe("Exceptional, world-class expression of style");
    expect(gold?.colour).toBe("#d4af37");

    const silver = medalForScore(92);
    expect(silver?.name).toBe("Silver Medal");
    expect(silver?.description).toBe("Outstanding to high quality");
    expect(silver?.colour).toBe("#c0c0c0");

    const bronze = medalForScore(87);
    expect(bronze?.name).toBe("Bronze Medal");
    expect(bronze?.description).toBe("Very good commercial standard, fault-free");
    expect(bronze?.colour).toBe("#cd7f32");

    const none = medalForScore(80);
    expect(none?.name).toBe("No Medal");
    expect(none?.description).toBe("Below commercial quality, potentially faulty");
    expect(none?.colour).toBe("#fcebe7");
  });
});

describe("medalIdForScore", () => {
  it("returns the medal id or null", () => {
    expect(medalIdForScore(96)).toBe("gold");
    expect(medalIdForScore(92)).toBe("silver");
    expect(medalIdForScore(87)).toBe("bronze");
    expect(medalIdForScore(80)).toBe("none");
    expect(medalIdForScore(null)).toBeNull();
  });
});

describe("allMedals", () => {
  it("returns all four medals in order", () => {
    const medals = allMedals();
    expect(medals).toHaveLength(4);
    expect(medals.map((m) => m.id)).toEqual(["gold", "silver", "bronze", "none"]);
  });
});