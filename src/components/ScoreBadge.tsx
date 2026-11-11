import type { MedalInfo } from "../utils/medal";
import { medalForScore } from "../utils/medal";
import "./ScoreBadge.css";

export type ScoreBadgeSize = "sm" | "md" | "lg";

interface ScoreBadgeProps {
  /** Review score (0–100). null/undefined renders nothing. */
  score: number | null | undefined;
  /** Badge size variant. Default: "sm". */
  size?: ScoreBadgeSize;
  /** Optional additional className. */
  className?: string;
  /** If true, render a dashed outline for draft status (cards only). */
  isDraft?: boolean;
}

/**
 * Round medal badge showing the review score.
 *
 * - **sm** (default): small circle with just the score number. Used in cards, tables, dialogs.
 * - **md**: medium circle with "WINE WORDS" top, score middle, "BY KASIA" bottom.
 * - **lg**: large circle like md, plus a caption line with the medal name & description.
 *
 * Colours follow the medal tier (gold/silver/bronze/none).
 * Accessibility: the badge has an aria-label with "Score X: Medal — description".
 */
export default function ScoreBadge({
  score,
  size = "sm",
  className = "",
  isDraft = false,
}: ScoreBadgeProps) {
  const medal: MedalInfo | null = medalForScore(score);
  if (!medal) return null;

  const medalId = medal.id;
  const label = `Score ${score}: ${medal.name} — ${medal.description}`;

  const baseClass = `score-badge score-badge--${size} score-badge--${medalId}`;
  const draftClass = isDraft ? " score-badge--draft" : "";
  const classes = `${baseClass}${draftClass} ${className}`.trim();

  if (size === "sm") {
    return (
      <span className={classes} role="img" aria-label={label} title={label}>
        <span className="score-badge__brand">Wine</span>
        <span className="score-badge__value">{score}</span>
        <span className="score-badge__byline">Words</span>
      </span>
    );
  }

  // md / lg — branded circular badge
  return (
    <span className={classes} role="img" aria-label={label} title={label}>
      <span className="score-badge__ring" aria-hidden="true">
        <span className="score-badge__brand">WINE WORDS</span>
        <span className="score-badge__value">{score}</span>
        <span className="score-badge__byline">BY KASIA</span>
      </span>
      
    </span>
  );
}