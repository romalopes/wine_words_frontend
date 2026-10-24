import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface PageHeroAction {
  label: string;
  to?: string;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}

interface PageHeroProps {
  /** Small uppercase label above the title (e.g. "Admin", "Cellar"). */
  kicker?: ReactNode;
  /** Main heading. */
  title: ReactNode;
  /** Optional intro paragraph under the title. */
  description?: ReactNode;
  /** Optional right-hand action buttons. */
  actions?: ReactNode;
  /** Optional primary action rendered as a link button. */
  primaryAction?: PageHeroAction;
  /** Extra classes appended to the hero container. */
  className?: string;
}

/**
 * Shared page hero for list and admin pages. Gives every content/management
 * page a consistent header: kicker label, heading, optional description, and
 * a right-aligned action area (primary CTA + secondary actions).
 */
export default function PageHero({
  kicker,
  title,
  description,
  actions,
  primaryAction,
  className = "",
}: PageHeroProps) {
  return (
    <header className={`page-hero${className ? ` ${className}` : ""}`.trim()}>
      <div className="page-hero__content">
        {kicker != null && kicker !== "" && (
          <p className="page-hero__kicker">{kicker}</p>
        )}
        <h1 className="page-hero__title">{title}</h1>
        {description != null && description !== "" && (
          <p className="page-hero__description">{description}</p>
        )}
      </div>
      <div className="page-hero__actions">
        {primaryAction && (
          <Link
            to={primaryAction.to ?? ""}
            onClick={primaryAction.onClick}
            className={`page-hero__btn page-hero__btn--primary${primaryAction.disabled ? " page-hero__btn--disabled" : ""}`}
            disabled={primaryAction.disabled}
            aria-disabled={primaryAction.disabled}
          >
            {primaryAction.label}
          </Link>
        )}
        {actions}
      </div>
    </header>
  );
}
