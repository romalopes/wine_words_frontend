import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { notificationsApi } from "../services/api";
import { emitNotificationsChanged } from "../services/notificationEvents";
import usePagedList from "../hooks/usePagedList";
import DetailHero from "./DetailHero";
import PackageStatusBadge from "./PackageStatusBadge";
import { badgeClass } from "../constants/winePackages";
import { formatDate } from "../utils/dates";
import type { Notification } from "../types/notification";

// Same design language as the /following page: a hero with summary specs and
// pill-filter tabs. "All" shows the whole feed, "Unread" narrows it.
const FILTERS: Array<{ label: string; value: "all" | "unread" }> = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
];

// Human label for the small uppercase type line of each row. Lifecycle and
// follow-based notifications map to short names; anything new falls back to
// its machine type with underscores replaced.
const TYPE_LABELS: Record<string, string> = {
  wine_package_deadline: "Deadline reminder",
  wine_package_submitted: "Package request",
  wine_package_withdrawn: "Package withdrawn",
  wine_package_accepted: "Package accepted",
  wine_package_arrived: "Package arrived",
  wine_package_completed: "Package completed",
  wine_package_rejected: "Package rejected",
  review_published: "Review published",
  review_updated: "Review updated",
  review_comment: "Review comment",
  article_published: "Article published",
  article_updated: "Article updated",
  article_comment: "Article comment",
  wine_created: "Wine created",
  wine_updated: "Wine updated",
  vintage_created: "Vintage added",
  vintage_updated: "Vintage updated",
  producer_updated: "Producer updated",
  health_test: "Test notification",
};

function typeLabel(notification: Notification): string {
  return (
    TYPE_LABELS[notification.notification_type] ??
    notification.notification_type.replace(/_/g, " ")
  );
}

// Monogram letter for the row avatar, mirroring the /following rows.
function monogramChar(notification: Notification): string {
  const text =
    notification.producer_name || notification.target_label || notification.message;
  return (text ?? "N").trim().charAt(0).toUpperCase() || "N";
}

// Where a row links: package reminders point at their package (labelled with
// the producer name), follow-based deliveries at the changed content.
function targetOf(
  notification: Notification,
): { href: string; label: string } | null {
  if (notification.wine_package_id) {
    return {
      href: `/wine-packages/${notification.wine_package_id}`,
      label:
        notification.producer_name ||
        `Package #${notification.wine_package_id}`,
    };
  }
  if (notification.target_path) {
    return {
      href: notification.target_path,
      label: notification.target_label || notification.target_path,
    };
  }
  return null;
}

// The signed-in user's notifications: wine-package lifecycle updates,
// review-deadline reminders plus follow-based events. Read state is per-user
// and the API is scoped to the caller. The layout mirrors the /following page.
function Notifications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const unreadOnly = searchParams.get("unread") === "true";
  const [busy, setBusy] = useState(false);

  const list = usePagedList<Notification>({
    fetcher: (params) => notificationsApi.list(params),
    extraParams: { unread: unreadOnly ? "true" : "" },
  });

  function setFilter(next: "all" | "unread") {
    const params = new URLSearchParams(searchParams);
    if (next === "unread") params.set("unread", "true");
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

  const currentFilter: "all" | "unread" = unreadOnly ? "unread" : "all";

  return (
    <main className="wine-app following-page notifications-page">
      <DetailHero
        kicker="Your cellar"
        title="Notifications"
        intro="Package requests, editorial decisions, arrivals and review deadlines, plus updates on the producers, wines, reviews and articles you follow."
      >
        <div className="following-page__summary" aria-label="Notifications summary">
          <div className="wine-detail__spec">
            <span className="wine-detail__spec-label">Notifications</span>
            <span className="wine-detail__spec-value">{list.totalCount}</span>
          </div>
          <div className="wine-detail__spec">
            <span className="wine-detail__spec-label">Viewing</span>
            <span className="wine-detail__spec-value">
              {currentFilter === "unread" ? "Unread" : "All"}
            </span>
          </div>
        </div>
      </DetailHero>

      <section className="wine-detail__section following-page__section">
        <div className="following-page__section-heading">
          <div>
            <p className="wine-kicker">Inbox</p>
            <h2>Notification feed</h2>
          </div>
          <div className="notifications-page__heading-actions">
            <div
              className="following-page__filters"
              role="tablist"
              aria-label="Notification filter"
            >
              {FILTERS.map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={currentFilter === value}
                  className={`following-page__filter${
                    currentFilter === value ? " following-page__filter--active" : ""
                  }`}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="wine-btn wine-btn--ghost wine-btn--sm"
              disabled={busy}
              onClick={() => void markAllRead()}
            >
              Mark all read
            </button>
          </div>
        </div>

        {list.error ? (
          <p
            className="following-page__status following-page__status--error"
            role="alert"
          >
            {list.error}{" "}
            <button className="wine-btn wine-btn--primary" onClick={list.reload}>
              Retry
            </button>
          </p>
        ) : list.loading ? (
          <p className="following-page__status">Loading your notifications…</p>
        ) : list.items.length === 0 ? (
          <div className="following-page__empty following-page__empty--compact">
            <h3>{unreadOnly ? "Nothing unread." : "No notifications yet."}</h3>
            <p>
              {unreadOnly
                ? "You are all caught up — new activity will show up here."
                : "Package updates and follow-based activity will show up here."}
            </p>
          </div>
        ) : (
          <ul className="following-page__list" aria-label="Notifications">
            {list.items.map((notification) => {
              const target = targetOf(notification);
              return (
                <li
                  key={notification.id}
                  className={`following-page__row notifications-page__row${
                    notification.read ? "" : " notifications-page__row--unread"
                  }`}
                >
                  <span className="following-page__monogram" aria-hidden="true">
                    {monogramChar(notification)}
                  </span>
                  <div className="following-page__item-copy">
                    <span className="following-page__type">
                      {typeLabel(notification)}
                    </span>
                    <span className="following-page__label">
                      {notification.message}
                    </span>
                    <span className="notifications-page__meta">
                      {formatDate(notification.scheduled_date)}
                      {notification.notification_type ===
                        "wine_package_deadline" &&
                        !notification.sent && <span>not sent yet</span>}
                      {!notification.read && (
                        <span className={badgeClass("info")}>Unread</span>
                      )}
                    </span>
                    {target && (
                      <Link
                        className="notifications-page__target"
                        to={target.href}
                      >
                        {target.label}
                      </Link>
                    )}
                  </div>
                  {notification.wine_package_id ? (
                    <PackageStatusBadge status={notification.package_status} />
                  ) : null}
                  {!notification.read && (
                    <button
                      type="button"
                      className="following-page__unfollow notifications-page__mark-read"
                      disabled={busy}
                      onClick={() => void markRead(notification)}
                    >
                      Mark read
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!list.error && !list.loading && list.totalPages > 1 && (
          <nav
            className="following-page__pagination"
            aria-label="Notifications pagination"
          >
            <button
              type="button"
              disabled={list.page <= 1}
              onClick={() => list.setPage(list.page - 1)}
            >
              &larr; Previous
            </button>
            <span>
              Page {list.page} of {list.totalPages} ({list.totalCount} total)
            </span>
            <button
              type="button"
              disabled={list.page >= list.totalPages}
              onClick={() => list.setPage(list.page + 1)}
            >
              Next &rarr;
            </button>
          </nav>
        )}
      </section>
    </main>
  );
}

export default Notifications;
