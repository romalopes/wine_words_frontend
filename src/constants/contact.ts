import type { ContactMessageStatus, ContactType } from "../types/contact"

/**
 * Contact-form categories, mirroring `ContactMessage::CONTACT_TYPES` on the
 * API (IDENTITY_209). Stable API values are the `value`; only the labels may
 * change. The API rejects anything outside this list, so keep the two in sync.
 */
export const CONTACT_TYPES: ReadonlyArray<{ value: ContactType; label: string }> = [
  { value: "general", label: "General enquiry" },
  { value: "wine_submission", label: "Wine submission / Producer enquiry" },
  { value: "content", label: "Wine review or article" },
  { value: "business", label: "Business / Partnership" },
  { value: "support", label: "Technical support" },
  { value: "feedback", label: "Feedback / Suggestion" },
  { value: "other", label: "Other" },
]

/** Human label for one contact-type value (falls back to the raw value). */
export function contactTypeLabel(value: string | null | undefined): string {
  if (!value) return "Unknown"
  return CONTACT_TYPES.find((type) => type.value === value)?.label ?? value.replace(/_/g, " ")
}

/** Inbox status tabs: "all" is a UI-only filter, the rest map to API values. */
export const CONTACT_MESSAGE_STATUS_FILTERS: ReadonlyArray<{
  value: "all" | ContactMessageStatus
  label: string
}> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "archived", label: "Archived" },
]

export function contactMessageStatusLabel(status: ContactMessageStatus): string {
  switch (status) {
    case "unread":
      return "Unread"
    case "read":
      return "Read"
    case "archived":
      return "Archived"
  }
}
