/**
 * Medal tiers for Wine Words review scores.
 * Ranges are inclusive on the lower bound, exclusive on the upper (except Gold which caps at 100).
 */
export type MedalId = "gold" | "silver" | "bronze" | "none";

export interface MedalInfo {
  id: MedalId;
  name: string;
  description: string;
  /** Approx. hex used for the badge gradient ring. */
  colour: string;
}

const MEDALS: readonly MedalInfo[] = [
  {
    id: "gold",
    name: "Gold Medal",
    description: "Exceptional, world-class expression of style",
    colour: "#d4af37",
  },
  {
    id: "silver",
    name: "Silver Medal",
    description: "Outstanding to high quality",
    colour: "#c0c0c0",
  },
  {
    id: "bronze",
    name: "Bronze Medal",
    description: "Very good commercial standard, fault-free",
    colour: "#cd7f32",
  },
  {
    id: "none",
    name: "No Medal",
    description: "Below commercial quality, potentially faulty",
    colour: "#fcebe7",
  },
] as const;

/**
 * Returns the medal info for a given review score.
 * - Scores >= 95 → Gold
 * - Scores >= 90 → Silver
 * - Scores >= 85 → Bronze
 * - Scores < 85  → No medal
 * - null / undefined → null
 * - Scores > 100 are clamped to Gold.
 */
export function medalForScore(score: number | null | undefined): MedalInfo | null {
  if (score == null) return null;
  const s = Math.min(score, 100);
  if (s >= 95) return MEDALS[0]!;
  if (s >= 90) return MEDALS[1]!;
  if (s >= 85) return MEDALS[2]!;
  return MEDALS[3]!;
}

/**
 * Convenience: just the medal id string, or null.
 */
export function medalIdForScore(score: number | null | undefined): MedalId | null {
  return medalForScore(score)?.id ?? null;
}

/**
 * All medal definitions (useful for legends / tooltips).
 */
export function allMedals(): readonly MedalInfo[] {
  return MEDALS;
}