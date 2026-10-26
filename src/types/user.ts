/**
 * A *user-authored* tasting profile (`/wine_profiles`), distinct from the
 * static finder catalogue in `types/wineFinder.ts`. Deliberately not named
 * `WineProfile`, which is the catalogue's type.
 *
 * NOTE the `parameters` asymmetry with `Wine`: a profile serialises its
 * parameters as a Record of `{ [tasteParameterSlug]: score }` (see
 * `WineProfileSerializer#parameters`), whereas `WineSerializer#parameters`
 * returns an **array** of `{ taste_parameter_slug, score }`. Code that consumes
 * both must normalise — `src/components/Quiz.tsx#toScoreMap` does exactly that.
 */
export interface UserWineProfile {
  id?: number
  slug: string
  user_id?: number | null
  name?: string | null
  /** JSON text column — a list of grape names. */
  grapes?: string[] | string | null
  /** JSON text column — a list of region names. */
  regions?: string[] | string | null
  color?: string | null
  /** Free-text tasting note (a single string, not a list). */
  notes?: string[] | string | null
  serving?: string | null
  /** `{ acidity: 4, body: 2, ... }` — keyed by taste-parameter slug. */
  parameters?: Record<string, number>
}

/**
 * A raw line of `log/<env>.log`, as returned by `GET /logs` (no wrapping JSON
 * envelope — one `{ level, message, timestamp }` object per line). Distinct from
 * `AuditLog`, which is a database record.
 */
export interface LogEntry {
  id?: number | string
  timestamp?: string | null
  level?: string | null
  message?: string | null
  [key: string]: unknown
}

/** The user stub embedded in an audit entry — always has an id and email. */
export interface AuditLogUser {
  id: number
  display_name: string | null
  email: string
}

/**
 * A record touched by an audited request.
 *
 * `alive` is only present on the detail view (`GET /logs/:id` passes
 * `detailed: true`), where the API live-looks-up each polymorphic record to say
 * whether it still exists. It is absent from the list endpoint, so the type is
 * optional rather than `boolean | undefined`.
 */
export interface AuditLogObject {
  type: string
  id: number
  /** Snapshot label taken at log time, or the record's live name. May be null. */
  label?: string | null
  /** Only on the detail view: does the record still exist? */
  alive?: boolean
}

/** One row of the audit log — `logs_controller#log_json`. */
export interface AuditLog {
  id: number
  description: string | null
  user: AuditLogUser | null
  action: string | null
  method: string | null
  path: string | null
  status: number | null
  request_id: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string | null
  objects: AuditLogObject[]
}

import type { Paginated } from "./common"
import type { User } from "./authentication"
import type { Account } from "./account"
import type { ProducerMembershipType } from "./producer"

/**
 * A user row as the admin endpoints render it (`users#search`, `assign_roles`,
 * `assign_subscription`). Distinct from the `User` shape used for auth/`me`:
 * this one carries the numeric `role_ids` an admin's role checkboxes need and
 * an embedded subscription summary. See `users_controller#user_json`.
 */
export interface AdminUser {
  id: number
  email: string
  display_name: string | null
  first_name?: string | null
  last_name?: string | null
  /** Numeric role ids currently assigned — drives the role checkboxes. */
  role_ids: number[]
  /** Human-readable role names, e.g. ["Admin", "Reader"]. */
  roles: string[]
  subscription: SubscriptionSummary | null
}

/** The `{ id, name }` subscription stub embedded in user payloads. */
export interface SubscriptionSummary {
  id: number
  name: string
}

/**
 * One entry from `GET /api/v1/roles` — the admin role picker. The `name` is
 * already translated by the API (`Role.names[...]`), so it is display-ready.
 */
export interface RoleOption {
  id: number
  name: string
}

/**
 * The paginated envelope `users#search` returns when given a `page`. Reuses the
 * shared `Paginated<T>` rather than redeclaring it.
 */
export type AdminUserResults = Paginated<AdminUser>

export interface ImpersonationResponse {
  token: string
  impersonating: boolean
  effective_user: User
  real_user: User | null
}

/** Producer membership linking a user to a producer. */
export interface ProducerMembership {
  id: number
  user: {
    id: number
    display_name: string | null
    email: string
  }
  producer: {
    id: number
    name: string
    slug: string
    country: string | null
  }
  /**
   * Typed membership (issue #191). Always one of owner/manager/contributor;
   * there is no follower/viewer value.
   */
  membership_type: ProducerMembershipType
  /** Owners and managers may edit the producer; contributors are read-only. */
  can_edit?: boolean
  created_by: { id: number; display_name: string } | null
  created_at: string
  updated_at?: string
}

/** Detailed user info returned by GET /api/v1/users/:id (admin only). */
export interface UserDetail extends AdminUser {
  /** Admin-only personal information; omitted from catalogue-manager responses. */
  account?: Account
  analytics_opt_out: boolean
  producer_memberships: ProducerMembership[]
}

