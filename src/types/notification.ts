/** The notification kinds the API can schedule or deliver. */
export type NotificationType =
  | "wine_package_deadline"
  | "wine_package_arrived"
  | "wine_package_completed"
  | "wine_package_rejected"
  // Follow-based notifications (issue #192)
  | "review_published"
  | "review_updated"
  | "review_comment"
  | "article_published"
  | "article_updated"
  | "article_comment"
  | "wine_created"
  | "wine_updated"
  | "vintage_created"
  | "vintage_updated"
  | "producer_updated"

/**
 * One notification as returned by `NotificationSerializer`. Read state is exposed
 * both as a boolean and as the underlying timestamps, so the UI can render the
 * date while the list can just ask for `read`.
 *
 * Two row kinds share the shape: wine-package reminders (wine_package_id set)
 * and follow-based deliveries (notification_event_id set, target_path points at
 * the content that changed).
 */
export interface Notification {
  id: number
  notification_type: NotificationType
  message: string | null
  /** Null for a generic notification that is not tied to a package. */
  wine_package_id: number | null
  producer_name: string | null
  package_status: string | null
  notifiable_type: string | null
  notifiable_id: number | null
  /** Follow-based deliveries only (issue #192). */
  notification_event_id: number | null
  event_type: string | null
  actor_name: string | null
  /** Frontend route to the changed content, e.g. `/reviews/some-slug`. */
  target_path: string | null
  target_label: string | null
  /** The day the reminder is for, as a bare ISO date. */
  scheduled_date: string | null
  /** When the notification became visible in-app. */
  delivered_at: string | null
  sent_at: string | null
  read_at: string | null
  sent: boolean
  read: boolean
  created_at: string | null
}

export interface Configuration {
  logs_saved_to_database?: boolean
  use_test_email?: boolean
  test_email?: string | null
  mail_transport?: string | null
  settings?: Setting[]
}

export interface Setting {
  id: number | string
  key: string
  value: unknown
  [key: string]: unknown
}
