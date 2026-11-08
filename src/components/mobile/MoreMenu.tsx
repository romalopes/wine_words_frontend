import { useEffect } from "react"
import { NavLink } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import {
  canAccessAnalytics,
  canAccessArticleProjects,
  canAccessPackages,
  canManageWinesRole,
  isAdmin,
} from "../../constants/roles"

interface MoreMenuProps {
  onClose: () => void
}

interface MoreLink {
  label: string
  to: string
}

interface MoreGroup {
  heading: string
  links: MoreLink[]
}

/**
 * The "More" sheet reached from the mobile bottom navigation.
 *
 * Groups the secondary destinations (Finder, Quiz, Wines, Producers, …) and
 * gates staff areas on the same role helpers the desktop Header uses, so the
 * mobile menu never advertises a route the user cannot open. Reuses the app's
 * existing role logic — no parallel permission model.
 */
function MoreMenu({ onClose }: MoreMenuProps) {
  const { user } = useAuth()

  // Escape closes the sheet, matching the platform convention for dialogs.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const groups: MoreGroup[] = [
    {
      heading: "Discover",
      links: [
        { label: "Finder", to: "/finder" },
        { label: "Quiz", to: "/quiz" },
        { label: "Wines", to: "/wines" },
        { label: "Producers", to: "/producers" },
        { label: "Search", to: "/search" },
      ],
    },
    {
      heading: "Your account",
      links: [
        ...(user
          ? [
              { label: "Notifications", to: "/notifications" },
              { label: "Following", to: "/following" },
            ]
          : []),
        { label: "Profile & settings", to: user ? "/account" : "/login" },
      ],
    },
  ]

  // Staff-only destinations, gated exactly like the desktop "Extras" menu.
  const staffLinks: MoreLink[] = []
  if (canAccessPackages(user)) {
    staffLinks.push({ label: "Wine Packages", to: "/wine-packages" })
  }
  if (canAccessArticleProjects(user)) {
    staffLinks.push({ label: "Article Projects", to: "/article-projects" })
  }
  if (canAccessAnalytics(user)) {
    staffLinks.push({ label: "Analytics", to: "/analytics" })
  }
  if (canManageWinesRole(user)) {
    staffLinks.push({ label: "Settings", to: "/settings/wines" })
  }
  if (isAdmin(user)) {
    staffLinks.push({ label: "Admin", to: "/admin/configuration" })
  }
  if (staffLinks.length > 0) {
    groups.push({ heading: "Staff", links: staffLinks })
  }

  groups.push({
    heading: "About",
    links: [{ label: "About Wine Words", to: "/about" }],
  })

  return (
    <div
      className="more-menu"
      role="dialog"
      aria-modal="true"
      aria-label="More navigation"
    >
      <div
        className="more-menu__backdrop"
        role="presentation"
        onClick={onClose}
      />
      <div className="more-menu__sheet">
        <div className="more-menu__header">
          <h2 className="more-menu__title">More</h2>
          <button
            type="button"
            className="more-menu__close"
            aria-label="Close menu"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <div className="more-menu__body">
          {groups.map((group) => (
            <section key={group.heading} className="more-menu__group">
              <h3 className="more-menu__group-title">{group.heading}</h3>
              <ul className="more-menu__list">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <NavLink
                      className="more-menu__link"
                      to={link.to}
                      onClick={onClose}
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MoreMenu
