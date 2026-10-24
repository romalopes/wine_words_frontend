import type { ProducerMembershipType } from "../types/producer"

export const ROLES = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  REVIEWER: "Reviewer",
  READER: "Reader",
  GUEST: "Guest",
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export interface RoleUser {
  roles?: readonly string[] | null
}

const WINE_MANAGER_ROLES: readonly string[] = [ROLES.ADMIN, ROLES.EDITOR, ROLES.REVIEWER]

export function canManageWinesRole(user: RoleUser | null | undefined): boolean {
  return user?.roles?.some((role) => WINE_MANAGER_ROLES.includes(role)) ?? false
}

export const isContentManager = canManageWinesRole

export function isAdmin(user: RoleUser | null | undefined): boolean {
  return user?.roles?.some((role) => role === ROLES.ADMIN) ?? false
}

export function canManageGrapes(user: RoleUser | null | undefined): boolean {
  return canManageWinesRole(user)
}

export function canManageAllPackages(user: RoleUser | null | undefined): boolean {
  return user?.roles?.some((role) => role === ROLES.ADMIN || role === ROLES.EDITOR) ?? false
}

/** Admins and Editors only (excludes Reviewers) — used for the `source` badge. */
export function canSeeSource(user: RoleUser | null | undefined): boolean {
  return user?.roles?.some((role) => role === ROLES.ADMIN || role === ROLES.EDITOR) ?? false
}

/** Admins and Editors only — can access user management pages and manage producer memberships. */
export function canManageUsers(user: RoleUser | null | undefined): boolean {
  return user?.roles?.some((role) => role === ROLES.ADMIN || role === ROLES.EDITOR) ?? false
}

/**
 * Producer deletion is restricted to global Admins and Editors (issue #191).
 * Reviewers and producer owners/managers may edit but not delete.
 */
export function canDeleteProducers(user: RoleUser | null | undefined): boolean {
  return user?.roles?.some((role) => role === ROLES.ADMIN || role === ROLES.EDITOR) ?? false
}

export function canAccessPackages(user: RoleUser | null | undefined): boolean {
  return canManageWinesRole(user)
}

export const canCreatePackage = canAccessPackages

export function canAccessAnalytics(user: RoleUser | null | undefined): boolean {
  return user?.roles?.some((role) => role === ROLES.ADMIN || role === ROLES.EDITOR || role === ROLES.REVIEWER) ?? false
}

export const canAccessArticleProjects = canManageWinesRole

/** Role options for admin UI checkboxes. */
export const USER_ROLE_OPTIONS = [
  { id: 1, name: "Admin" },
  { id: 2, name: "Editor" },
  { id: 3, name: "Reviewer" },
  { id: 4, name: "Reader" },
  { id: 5, name: "Guest" },
] as const

// --- Producer memberships (issue #191) -------------------------------------
// Mirror of ProducerMembership::MEMBERSHIP_TYPES on the API. `follower` and
// `viewer` are intentionally absent: following a producer is out of scope.
export const PRODUCER_MEMBERSHIP_TYPES = ["owner", "manager", "contributor"] as const

export const PRODUCER_MEMBERSHIP_LABELS: Record<ProducerMembershipType, string> = {
  owner: "Owner",
  manager: "Manager",
  contributor: "Contributor",
}

/** Human-readable badge text for a membership type. */
export function producerMembershipLabel(type: ProducerMembershipType | null | undefined): string {
  return type ? PRODUCER_MEMBERSHIP_LABELS[type] : "Unknown"
}

/**
 * Owners and managers may edit the producer they belong to. Contributors are
 * read-only. Global Admin/Editor/Reviewer rights are handled separately by
 * `canManageWinesRole`; the API's `can_edit` flag is authoritative.
 */
export function canEditProducerMembership(
  type: ProducerMembershipType | null | undefined,
): boolean {
  return type === "owner" || type === "manager"
}

/**
 * Checks if a user can manage producer memberships.
 * Admins, Editors, and Reviewers can manage all memberships.
 * Owners and managers of the specific producer can also manage memberships.
 */
export function canManageProducerMembership(
  user: RoleUser | null | undefined,
): boolean {
  if (!user) return false;
  // Admins, Editors, and Reviewers can manage all memberships
  const WINE_MANAGER_ROLES: readonly string[] = [ROLES.ADMIN, ROLES.EDITOR, ROLES.REVIEWER];
  if (user.roles?.some((role) => WINE_MANAGER_ROLES.includes(role))) {
    return true;
  }
  // Owner or manager of the specific producer membership can manage it
  return false;
}
