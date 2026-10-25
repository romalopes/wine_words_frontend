import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { notificationsApi } from "../services/api";
import { emitNotificationsChanged } from "../services/notificationEvents";
import usePagedList from "../hooks/usePagedList";
import Pagination from "./Pagination";
import PackageStatusBadge from "./PackageStatusBadge";
import { badgeClass } from "../constants/winePackages";
import { formatDate } from "../utils/dates";
import type { Notification } from "../types/notification";
import styles from "./winePackages.module.css";

// Human label for the Status column of follow-based notifications (no package
// status exists for them).
function followStatusLabel(notification: Notification): string {
  const actor = notification.actor_name;
  if (actor && notification.event_type?.endsWith("comment_created")) {
    return `Comment by ${actor}`;
  }
  if (actor) return `By ${actor}`;
  return "In-app";
}

// The signed-in user's notifications: wine-package review-deadline reminders
// plus follow-based events (new content, comments) from issue #192. Read state
// is per-user and the API is scoped to the caller, so nothing here needs to
// filter by recipient.
function Notifications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const unreadOnly = searchParams.get("unread") === "true";
  const [busy, setBusy] = useState(false);

  const list = usePagedList<Notification>({
    fetcher: (params) => notificationsApi.list(params),
    extraParams: { unread: unreadOnly ? "true" : "" },
  });

  function toggleUnread(next: boolean) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("unread", "true");
    else params.delete("unread");
    params.delete("page");
    setSearchParams(params);
  }

  async function markRead(notification: Notification) {
    setBusy(true);
    try {
      await notificationsApi.markRead(notification.id);
      list.reload();
      emitNotificationsChanged();
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await notificationsApi.markAllRead();
      list.reload();
      emitNotificationsChanged();
    } finally {
      setBusy(false);
    }
  }

  if (list.loading) {
    return (
      <div className="wine-app">
        <p className="wine-management__loading">Loading notifications…</p>
      </div>
    );
  }

  if (list.error) {
    return (
      <div className="wine-app">
        <p className="wine-management__error">{list.error}</p>
        <button className="wine-btn wine-btn--primary" onClick={list.reload}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="wine-app">
      <div className={styles.header}>
        <div>
          <p className="wine-kicker">Cellar</p>
          <h1>Notifications</h1>
          <p className={styles.cellMuted}>
            Review-deadline reminders for your wine packages, plus updates on the
            producers, wines, reviews and articles you follow.
          </p>
        </div>
        <div className={styles.headerActions}>
          <label
            className={styles.checkboxField}
            htmlFor="notifications-unread"
          >
            <input
              id="notifications-unread"
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => toggleUnread(event.target.checked)}
            />
            Unread only
          </label>
          <button
            type="button"
            className="wine-btn wine-btn--secondary"
            disabled={busy}
            onClick={markAllRead}
          >
            Mark all read
          </button>
        </div>
      </div>

      {list.items.length === 0 ? (
        <div className="wine-management__empty">
          <p>{unreadOnly ? "Nothing unread. " : "No notifications yet. "}</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Message</th>
                  <th scope="col">Package</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((notification) => (
                  <tr key={notification.id}>
                    <td className={styles.cellMuted}>
                      {formatDate(notification.scheduled_date)}
                      {notification.wine_package_id && !notification.sent && (
                        <div>not sent yet</div>
                      )}
                    </td>
                    <td>
                      {notification.message}
                      {!notification.read && (
                        <span className={badgeClass("info")}>Unread</span>
                      )}
                    </td>
                    <td>
                      {notification.wine_package_id ? (
                        <Link
                          to={`/wine-packages/${notification.wine_package_id}`}
                        >
                          {notification.producer_name ||
                            `Package #${notification.wine_package_id}`}
                        </Link>
                      ) : notification.target_path ? (
                        <Link to={notification.target_path}>
                          {notification.target_label || notification.target_path}
                        </Link>
                      ) : (
                        <span className={styles.cellMuted}>—</span>
                      )}
                    </td>
                    <td>
                      {notification.wine_package_id ? (
                        <PackageStatusBadge
                          status={notification.package_status}
                        />
                      ) : (
                        <span className={styles.cellMuted}>
                          {followStatusLabel(notification)}
                        </span>
                      )}
                    </td>
                    <td>
                      {!notification.read && (
                        <button
                          type="button"
                          className="wine-btn wine-btn--ghost wine-btn--sm"
                          disabled={busy}
                          onClick={() => markRead(notification)}
                        >
                          Mark read
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={list.page}
            totalPages={list.totalPages}
            totalCount={list.totalCount}
            onPageChange={list.setPage}
          />
        </>
      )}
    </div>
  );
}

export default Notifications;
