/** The notification kinds the API can schedule. */
export type NotificationType =
  | "wine_package_deadline"
  | "wine_package_arrived"
  | "wine_package_completed"
  | "wine_package_rejected"

/**
 * One notification as returned by `NotificationSerializer`. Read state is exposed
 * both as a boolean and as the underlying timestamps, so the UI can render the
 * date while the list can just ask for `read`.
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
  /** The day the reminder is for, as a bare ISO date. */
  scheduled_date: string | null
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
