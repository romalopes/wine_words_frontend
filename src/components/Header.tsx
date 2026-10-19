import { useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  isAdmin,
  canManageWinesRole,
  canAccessPackages,
  canAccessArticleProjects,
  canAccessAnalytics,
} from "../constants/roles";
import { categoriesApi } from "../services/api";
import { useTestAccess } from "../contexts/TestAccessContext";
import NotificationBell from "./NotificationBell";
import { isPaidSubscriber } from "../utils/subscription";
import { responseItems } from "../types/common";
import type { Category, CategoryFlag } from "../types/catalog";
import type { CategoryCountType, CategoryCounts } from "../types/api";

/** One row in a nav dropdown: the text shown and where it navigates. */
interface NavDropdownItem {
  label: string;
  to: string;
}

interface NavDropdownProps {
  label: string;
  items: NavDropdownItem[];
}

function NavDropdown({ label, items }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // The first item is always the "All {Type}" link — clicking the dropdown
  // header navigates straight there.
  const allPath = items[0]?.to;
  return (
    <div
      className="settings-menu"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="settings-menu__toggle"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => allPath && navigate(allPath)}
      >
        {label}
      </button>
      {open && (
        <div className="settings-menu__dropdown">
          {items.map((item) => {
            // NavLink would mark every sibling active because all items share
            // the same pathname; compare the full path + query instead.
            const isActive = location.pathname + location.search === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={isActive ? "active" : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Up to two initials from a display name, for the header avatar. */
function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function Header() {
  const {
    user,
    realUser,
    isImpersonating,
    session,
    signOut,
    stopImpersonation,
  } = useAuth();
  const { exit: exitTestAccess } = useTestAccess();
  const navigate = useNavigate();

  // Admin nav links are gated on the REAL user (the admin), not the effective
  // impersonated user, so an admin never loses access to the admin interface
  // while impersonating a non-admin user.
  //
  // When not impersonating, realUser is null; fall back to user so menus
  // render normally for the signed-in identity.
  const effectiveIdentity = realUser ?? user;
  const isAdminUser = isAdmin(effectiveIdentity);
  const canSeeArticleProjects = canAccessArticleProjects(user);
  // Editors (and reviewers/admins) may manage categories, so show the
  // Settings menu for them too. The "Admin" menu (Users & Roles, API Health,
  // Subscriptions) is admin-only only.
  const canManageSettings =
    isAdminUser || canManageWinesRole(effectiveIdentity);
  // Wine packages are for content managers and Reviewers (the people who
  // receive and review the wines).
  const canSeePackages = canAccessPackages(user);
  const canSeeAnalytics = canAccessAnalytics(user);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<CategoryCounts>({});

  useEffect(() => {
    categoriesApi
      .list()
      .then((cats) => setCategories(responseItems(cats)))
      .catch(() => {});
    categoriesApi
      .counts()
      .then((data) => setCounts(data || {}))
      .catch(() => {});
  }, []);

  /**
   * Build the category links for one nav dropdown: only categories flagged for
   * this item type that actually have something linked, in their configured
   * order. `Uncategorised` is appended last when there are any.
   */
  function navCategories(
    flag: CategoryFlag,
    sortKey: `sort_order_${CategoryCountType}`,
  ): NavDropdownItem[] {
    const type = flag.replace("for_", "") as CategoryCountType;
    // The API keys these by the category id, serialised as a string.
    const countMap = counts[type] || {};
    const uncategorisedCount = counts.uncategorised?.[type] || 0;
    const categoryLinks = categories
      .filter((c) => c[flag])
      .sort((a, b) => (a[sortKey] ?? 9999) - (b[sortKey] ?? 9999))
      .filter((c) => (countMap[c.id] || 0) > 0)
      .map((c) => ({
        label: `${c.name} (${countMap[c.id] || 0})`,
        to: `/${type}s?category=${encodeURIComponent(c.name)}`,
      }));

    // Add Uncategorised as the last item if there are any
    if (uncategorisedCount > 0) {
      categoryLinks.push({
        label: `Uncategorised (${uncategorisedCount})`,
        to: `/${type}s?category=Uncategorised`,
      });
    }

    return categoryLinks;
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  function handleExitTestAccess() {
    exitTestAccess();
    navigate("/test-access");
  }

  function handleCloseMenu() {
    setMenuOpen(false);
  }

  // Display names come from Account; email is the fallback for incomplete profiles.
  function getDisplayName(): string | null {
    if (!session || !user) return null;
    if (user.display_name) return user.display_name;
    // The local-part of the email is the fallback. `split` yields
    // `string | undefined` under `noUncheckedIndexedAccess`, and this input is
    // known to contain an "@", so take the part before it directly.
    const at = user.email?.indexOf("@") ?? -1;
    return at > 0 ? user.email.slice(0, at) : (user.email ?? null);
  }

  const displayName = getDisplayName();
  const initials = getInitials(displayName || user?.email);

  return (
    <header className="site-header">
      {isImpersonating && user && (
        <div className="impersonation-banner" role="status">
          <span className="impersonation-banner__text">
            <strong>Acting as {user.display_name || user.email}</strong>
            <span className="impersonation-banner__sub">
              You are currently operating as this user. Actions will be
              attributed to them.
            </span>
          </span>
          <button
            type="button"
            className="impersonation-banner__stop"
            onClick={async () => {
              try {
                await stopImpersonation();
              } catch (err) {
                // Surface the error but don't crash — the admin can retry.
                console.error("Failed to stop impersonation:", err);
              }
            }}
          >
            Return to Admin
          </button>
        </div>
      )}
      <NavLink className="site-logo" to="/">
        <div>
          <img
            src="/wine_words.jpg"
            alt="Wine Words"
            style={{
              height: "2.5rem",
              display: "block",
              borderRadius: ".35rem",
            }}
          />
          <p className="site-header__subtitle">
            Explore producers, wines and reviews
          </p>
        </div>
      </NavLink>
      <button
        type="button"
        className="site-header__menu-btn"
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? (
          <svg
            width="1.2rem"
            height="1.2rem"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="6" />
            <line x1="18" y1="12" x2="6" y2="12" />
            <line x1="18" y1="18" x2="6" y2="18" />
          </svg>
        ) : (
          <svg
            width="1.2rem"
            height="1.2rem"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>
      <nav
        id="primary-navigation"
        className={menuOpen ? "site-header__nav--open" : undefined}
        aria-label="Primary navigation"
      >
        <NavDropdown
          label="Wines"
          items={[
            { label: `All Wines (${counts.totals?.wine || 0})`, to: "/wines" },
            ...navCategories("for_wine", "sort_order_wine"),
          ]}
        />
        <NavDropdown
          label="Reviews"
          items={[
            {
              label: `All Reviews (${counts.totals?.review || 0})`,
              to: "/reviews",
            },
            ...navCategories("for_review", "sort_order_review"),
          ]}
        />
        <NavDropdown
          label="Articles"
          items={[
            {
              label: `All Articles (${counts.totals?.article || 0})`,
              to: "/articles",
            },
            ...navCategories("for_article", "sort_order_article"),
          ]}
        />
        <div
          className="settings-menu"
          onMouseEnter={() => setExtrasOpen(true)}
          onMouseLeave={() => setExtrasOpen(false)}
        >
          <button
            type="button"
            className="settings-menu__toggle"
            aria-haspopup="true"
            aria-expanded={extrasOpen}
            onClick={() => setExtrasOpen((open) => !open)}
          >
            Extras
          </button>
          {extrasOpen && (
            <div className="settings-menu__dropdown">
              {canSeePackages && (
                <NavLink
                  to="/wine-packages"
                  onClick={() => {
                    setExtrasOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Wine Packages
                </NavLink>
              )}
              {canSeeArticleProjects && (
                <NavLink
                  to="/article-projects"
                  onClick={() => {
                    setExtrasOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Article Projects
                </NavLink>
              )}
              {canSeeAnalytics && (
                <NavLink
                  to="/analytics"
                  onClick={() => {
                    setExtrasOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Analytics
                </NavLink>
              )}
              <NavLink
                to="/finder"
                onClick={() => {
                  setExtrasOpen(false);
                  handleCloseMenu();
                }}
              >
                Finder
              </NavLink>
              <NavLink
                to="/quiz"
                onClick={() => {
                  setExtrasOpen(false);
                  handleCloseMenu();
                }}
              >
                Quiz
              </NavLink>
              <NavLink
                to="/search"
                onClick={() => {
                  setExtrasOpen(false);
                  handleCloseMenu();
                }}
              >
                Search
              </NavLink>
              <NavLink
                to="/archive"
                onClick={() => {
                  setExtrasOpen(false);
                  handleCloseMenu();
                }}
              >
                Archive
              </NavLink>
            </div>
          )}
        </div>
        <NavLink to="/about" onClick={handleCloseMenu}>
          About
        </NavLink>
        {canManageSettings && (
          <div
            className="settings-menu"
            onMouseEnter={() => setSettingsOpen(true)}
            onMouseLeave={() => setSettingsOpen(false)}
          >
            <button
              type="button"
              className="settings-menu__toggle"
              aria-haspopup="true"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              Settings
            </button>
            {settingsOpen && (
              <div className="settings-menu__dropdown">
                <NavLink
                  to="/producers"
                  onClick={() => {
                    setSettingsOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Producers
                </NavLink>
                <NavLink
                  to="/sources"
                  onClick={() => {
                    setSettingsOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Sources
                </NavLink>
                <NavLink
                  to="/categories"
                  onClick={() => {
                    setSettingsOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Categories
                </NavLink>
                <NavLink
                  to="/grapes"
                  onClick={() => {
                    setSettingsOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Grapes
                </NavLink>
                <NavLink
                  to="/countries"
                  onClick={() => {
                    setSettingsOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Countries
                </NavLink>
                <NavLink
                  to="/regions"
                  onClick={() => {
                    setSettingsOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Regions
                </NavLink>
                <NavLink
                  to="/wine-profiles"
                  onClick={() => {
                    setSettingsOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Wine Profiles
                </NavLink>
              </div>
            )}
          </div>
        )}
        {isAdminUser && (
          <div
            className="settings-menu"
            onMouseEnter={() => setAdminOpen(true)}
            onMouseLeave={() => setAdminOpen(false)}
          >
            <button
              type="button"
              className="settings-menu__toggle"
              aria-haspopup="true"
              aria-expanded={adminOpen}
              onClick={() => setAdminOpen((open) => !open)}
            >
              Admin
            </button>
            {adminOpen && (
              <div className="settings-menu__dropdown">
                <NavLink
                  to="/users"
                  onClick={() => {
                    setAdminOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Users &amp; Roles
                </NavLink>
                <NavLink
                  to="/admin/api-health"
                  onClick={() => {
                    setAdminOpen(false);
                    handleCloseMenu();
                  }}
                >
                  API Health
                </NavLink>
                <NavLink
                  to="/subscriptions"
                  onClick={() => {
                    setAdminOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Subscriptions
                </NavLink>
                <NavLink
                  to="/admin/logs"
                  onClick={() => {
                    setAdminOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Logs
                </NavLink>
                <NavLink
                  to="/admin/configuration"
                  onClick={() => {
                    setAdminOpen(false);
                    handleCloseMenu();
                  }}
                >
                  Configuration
                </NavLink>
              </div>
            )}
          </div>
        )}
      </nav>
      <div className="site-header__actions">
        {/* Paid subscribers manage via /subscribe → Stripe portal, so the
            acquisition CTA is hidden once they hold a non-FREE plan.*/}
        {!isPaidSubscriber(user) && (
          <NavLink className="site-header__cta" to="/subscribe">
            Subscribe
          </NavLink>
        )}
        {user && <NotificationBell />}
        {user ? (
          <div className="site-header__user">
            {/* <span className="site-header__avatar" aria-hidden="true">
              {initials}
            </span> */}
            <div className="site-header__user-info">
              {user.roles && user.roles.length > 0 && (
                <span className="site-header__user-roles" aria-label="Roles">
                  {user.roles.map((role) => (
                    <span
                      key={role}
                      className={`site-header__user-role site-header__user-role--${role.toLowerCase()}`}
                    >
                      {role}
                    </span>
                  ))}
                </span>
              )}
              {user.subscription && (
                <span className="site-header__user-subscription">
                  {user.subscription.name}
                </span>
              )}
              {user.email && (
                <span className="site-header__user-email">{user.email}</span>
              )}
            </div>
            <NavLink className="site-header__auth" to="/account">
              {displayName}
            </NavLink>
            <button
              className="site-header__auth"
              onClick={handleSignOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        ) : (
          <NavLink className="site-header__auth" to="/login">
            Login / Sign up
          </NavLink>
        )}

        <button
          type="button"
          className="test-access-exit"
          onClick={handleExitTestAccess}
          title="Clear private test access"
        >
          Exit Test Mode
        </button>
      </div>
    </header>
  );
}

export default Header;
