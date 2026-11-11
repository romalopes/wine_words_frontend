import type { MedalInfo } from "../utils/medal";
import { medalForScore } from "../utils/medal";
import { shouldShowScore } from "../constants/roles";
import type { User } from "../types/authentication";
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
  /** Current authenticated user (for score visibility logic). */
  user?: User | null | undefined;
  /** Producer ID of the reviewed wine (for producer relationship check). */
  producerId?: number | null | undefined;
}

/**
 * Round medal badge showing the review score.
 *
 * Visibility rules:
 * - Score >= 90: Always visible to everyone
 * - Score < 90: Hidden (shows "Wine Words") for non-logged-in users,
 *   unless the user is Admin/Editor or related to the producer.
 *
 * Small badge (sm) layout:
 * - When score visible: "Wine" top, score middle, "Words" bottom
 * - When score hidden: "Wine Words" fitting inside the circle
 *
 * Medium/Large badge (md/lg) layout:
 * - When score visible: "WINE WORDS" top, score middle, "BY KASIA" bottom
 * - When score hidden: "Wine Words" top, "by Kasia" bottom
 */
export default function ScoreBadge({
  score,
  size = "sm",
  className = "",
  isDraft = false,
  user,
  producerId,
}: ScoreBadgeProps) {
  const medal: MedalInfo | null = medalForScore(score);
  if (!medal) return null;

  const medalId = medal.id;
  const label = `Score ${score}: ${medal.name} — ${medal.description}`;

  // Build class list: base, size, medal, draft
  const sizeClass = `score-badge--${size}`;
  const baseClass = `score-badge ${sizeClass} score-badge--${medalId}`;
  const draftClass = isDraft ? " score-badge--draft" : "";
  const classes = `${baseClass}${draftClass} ${className}`.trim();

  const showScore = shouldShowScore(score, user, producerId);

  if (size === "sm") {
    if (showScore) {
      // Score visible: "Wine" top, score middle, "Words" bottom
      return (
        <span className={classes} role="img" aria-label={label} title={label}>
          <span className="score-badge__brand">Wine</span>
          <span className="score-badge__value">{score}</span>
          <span className="score-badge__byline">Words</span>
        </span>
      );
    } else {
      // Score hidden: "Wine" top, "Words" bottom (no score in middle)
      return (
        <span className={classes} role="img" aria-label={label} title={label}>
          <span className="score-badge__brand">Wine</span>
          <span className="score-badge__byline hidden-score">Words</span>
        </span>
      );
    }
  }

  if (showScore) {
    // Score visible: "WINE WORDS" top, score middle, "BY KASIA" bottom
    return (
      <span className={classes} role="img" aria-label={label} title={label}>
        <span className="score-badge__ring" aria-hidden="true">
          <span className="score-badge__brand">WINE WORDS</span>
          <span className="score-badge__value">{score}</span>
          <span className="score-badge__byline">BY KASIA</span>
        </span>
      </span>
    );
  } else {
    // Score hidden: "Wine Words" top, "by Kasia" bottom
    return (
      <span className={classes} role="img" aria-label={label} title={label}>
        <span className="score-badge__ring" aria-hidden="true">
          <span className="score-badge__brand">Wine Words</span>
          <span className="score-badge__caption">by Kasia</span>
        </span>
      </span>
    );
  }
}
