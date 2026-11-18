import type { Paginated } from "./common"

/** Stable API values — mirrors ContactMessage::CONTACT_TYPES in the Rails API. */
export type ContactType =
  | "general"
  | "wine_submission"
  | "content"
  | "business"
  | "support"
  | "feedback"
  | "other"

/** Mirrors ContactMessage::STATUSES. */
export type ContactMessageStatus = "unread" | "read" | "archived"

/** One public contact submission as returned by the inbox endpoints. */
export interface ContactMessage {
  id: number
  name: string
  email: string
  contact_type: ContactType
  subject: string
  status: ContactMessageStatus
  read: boolean
  archived: boolean
  read_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  /** Present on the detail endpoint only; list rows never include the body. */
  message?: string
}

/**
 * Inbox list envelope. The API adds `unread_count` (archived messages are
 * excluded) to the shared pagination envelope.
 */
export interface ContactMessageListResponse extends Paginated<ContactMessage> {
  unread_count: number
}

/** The public form payload. `website` is the honeypot and is never stored. */
export interface ContactMessageInput {
  name: string
  email: string
  contact_type: ContactType
  subject: string
  message: string
  turnstile_token?: string
  website?: string
}

/** Minimal receipt from POST /api/v1/contact_messages. */
export interface ContactMessageReceipt {
  status: string
}
