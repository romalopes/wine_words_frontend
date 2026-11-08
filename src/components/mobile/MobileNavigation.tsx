import { useState } from "react"
import { NavLink } from "react-router-dom"
import MoreMenu from "./MoreMenu"

/** The three primary destinations plus the More trigger. */
const NAV_ITEMS = [
  { label: "Home", to: "/", end: true },
  { label: "Reviews", to: "/reviews", end: false },
  { label: "Articles", to: "/articles", end: false },
] as const

/**
 * Fixed bottom navigation for the mobile shell: Home | Reviews | Articles | More.
 *
 * Rendered only when the mobile layout flag is enabled and the viewport is at or
 * below the breakpoint (see `App`). Uses react-router `NavLink`, so the active
 * destination gets `aria-current="page"` for assistive technology. The
 * notification bell lives in the existing desktop Header and is deliberately not
 * duplicated here.
 */
function MobileNavigation() {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              isActive
                ? "mobile-bottom-nav__item mobile-bottom-nav__item--active"
                : "mobile-bottom-nav__item"
            }
          >
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          className={
            moreOpen
              ? "mobile-bottom-nav__item mobile-bottom-nav__item--active"
              : "mobile-bottom-nav__item"
          }
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          More
        </button>
      </nav>
      {moreOpen && <MoreMenu onClose={() => setMoreOpen(false)} />}
    </>
  )
}

export default MobileNavigation
