import type { ReactNode } from "react";

export interface DetailHeroBadge {
  label: ReactNode;
  /** Optional tone used for the badge colour modifier (e.g. "red", "white", "rosé"). */
  tone?: string;
}

interface DetailHeroProps {
  /** Small uppercase label above the title (e.g. "Wine profile", "Producer"). */
  kicker?: ReactNode;
  /** Main heading content. */
  title: ReactNode;
  /** Optional pill badge next to the title (e.g. wine colour). */
  badge?: DetailHeroBadge;
  /** Optional intro/deck paragraph under the title. */
  intro?: ReactNode;
  /** Optional media (e.g. producer logo) rendered beside the text. */
  media?: ReactNode;
  /** Optional page-specific content inside the hero body (facts, bylines, like buttons…). */
  children?: ReactNode;
  /** Optional right-hand action area (edit/delete buttons). */
  actions?: ReactNode;
  /** Extra classes appended to the hero container. */
  className?: string;
}

function badgeToneClass(tone?: string): string {
  if (!tone) return "";
  // "Rosé" -> "rose", "Sparkling White" -> "sparkling-white", etc.
  const normalized = tone
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
  return ` wine-app__detail-hero__badge--${normalized}`;
}

/**
 * Shared detail-page hero — the warm reference-card design introduced on the
 * wine-profiles detail page and now used across every detail page
 * (wines, producers, grapes, regions, countries, categories, reviews, articles).
 */
export default function DetailHero({
  kicker,
  title,
  badge,
  intro,
  media,
  children,
  actions,
  className = "",
}: DetailHeroProps) {
  return (
    <header
      className={`wine-app__detail-hero${className ? ` ${className}` : ""}`.trim()}
    >
      <div className="wine-app__detail-hero__content">
        {kicker != null && kicker !== "" && (
          <p className="wine-kicker">{kicker}</p>
        )}
        <div className="wine-app__detail-hero__title-row">
          <h1>{title}</h1>
          {badge && (
            <span
              className={`wine-app__detail-hero__badge${badgeToneClass(badge.tone)}`.trim()}
            >
              {badge.label}
            </span>
          )}
        </div>
        {intro != null && intro !== "" && (
          <p className="wine-app__detail-hero__intro">{intro}</p>
        )}
        {children}
      </div>
      {media != null && (
        <div className="wine-app__detail-hero__media">{media}</div>
      )}
      {actions != null && (
        <div className="wine-app__detail-hero__actions">{actions}</div>
      )}
    </header>
  );
}
