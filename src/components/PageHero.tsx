import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface PageHeroAction {
  label: string;
  /** Renders the action as a router link to this path. */
  to?: string;
  /** Renders the action as a button that runs this handler. */
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
  /**
   * Optional primary action. It renders as a router link when `to` is set and
   * as a button otherwise, so in-page actions never navigate the router.
   */
  primaryAction?: PageHeroAction | undefined;
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
        {primaryAction &&
          (primaryAction.to ? (
            <Link
              to={primaryAction.to}
              onClick={(event) => {
                if (primaryAction.disabled) {
                  event.preventDefault();
                  return;
                }
                primaryAction.onClick?.();
              }}
              className={`page-hero__btn page-hero__btn--primary${primaryAction.disabled ? " page-hero__btn--disabled" : ""}`}
              aria-disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className={`page-hero__btn page-hero__btn--primary${primaryAction.disabled ? " page-hero__btn--disabled" : ""}`}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </button>
          ))}
        {actions}
      </div>
    </header>
  );
}
