import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { notificationsApi } from "../services/api";
import { onNotificationsChanged } from "../services/notificationEvents";

// Unread reminders count for the header.
//
// Uses the dedicated `unread_count` endpoint (a single COUNT query) rather than
// the paginated list: it exists exactly for badge display, and `usePagedList`
// would mirror the page number into the URL of whatever page the header is on.
function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await notificationsApi.unreadCount();
        if (cancelled) return;
        setUnread(data.unread_count ?? 0);
      } catch {
        // A missing/expired session must never break the header.
        if (!cancelled) setUnread(0);
      }
    }

    load();
    // Read state can change from the Notifications page ("Mark all read"),
    // or backend-side (new reminders, the daily delivery job). Refetch on the
    // app-level signal and when the tab regains focus; the location dependency
    // re-runs this whole block on every route change.
    const unsubscribe = onNotificationsChanged(load);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [location.pathname]);

  return (
    <NavLink
      to="/notifications"
      className="notification-bell"
      aria-label="Notifications"
      title="Notifications"
    >
      <BellIcon />
      {unread > 0 && (
        <span
          className="notification-bell__count"
          aria-label={`${unread} unread`}
        >
          {unread}
        </span>
      )}
    </NavLink>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.75v1.5" />
      <path d="M6.25 10a5.75 5.75 0 0 1 11.5 0v3.1c0 1.4.5 2.65 1.4 3.7a.75.75 0 0 1-.57 1.25H5.42a.75.75 0 0 1-.57-1.25c.9-1.05 1.4-2.3 1.4-3.7V10Z" />
      <path d="M9.75 20a2.5 2.5 0 0 0 4.5 0" />
    </svg>
  );
}

export default NotificationBell;
