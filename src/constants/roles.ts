import type { ProducerMembershipType } from "../types/producer"
import type { User, ProducerMembership } from "../types/authentication"

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
  can_access_wine_packages?: boolean
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
  return canManageWinesRole(user) || user?.can_access_wine_packages === true
}

/** Editorial package creation remains restricted to catalogue staff/reviewers. */
export const canCreatePackage = canManageWinesRole

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

/**
 * Checks if a user is an Admin or Editor (global editorial roles).
 */
export function isAdminOrEditor(user: RoleUser | null | undefined): boolean {
  return user?.roles?.some((role) => role === ROLES.ADMIN || role === ROLES.EDITOR) ?? false;
}

/**
 * Checks if a user is related to a specific producer.
 * Returns true if the user has any producer membership (owner, manager, contributor)
 * for the given producer ID.
 */
export function isUserRelatedToProducer(
  user: User | null | undefined,
  producerId: number | null | undefined,
): boolean {
  if (!user || !producerId) return false;
  // Check if user has producer_memberships (from detailed user object)
  const memberships = (user as User & { producer_memberships?: ProducerMembership[] }).producer_memberships;
  if (!memberships?.length) return false;
  return memberships.some((m) => m.producer.id === producerId);
}

/**
 * Determines if the score should be visible to the current user.
 * Three-tier score visibility:
 * - Score >= 90 (Silver/Gold): ALWAYS visible to everyone (including not logged in)
 * - 85 <= Score < 90 (Bronze): Visible only to wine managers (Admin/Editor/Reviewer)
 *   and producer members (owner/manager/contributor)
 * - Score < 85: Visible only to wine managers (Admin/Editor/Reviewer)
 *   and producer members (owner/manager/contributor)
 */
export function shouldShowScore(
  score: number | null | undefined,
  user: User | null | undefined,
  producerId: number | null | undefined,
): boolean {
  if (score == null) return false;
  
  // Score >= 90: Always visible to everyone (including not logged in)
  if (score >= 90) return true;
  
  // Score < 90: Requires authentication and authorization
  if (!user) return false; // Not logged in — scores are hidden
  if (canManageWinesRole(user)) return true; // Admin, Editor, Reviewer
  if (isUserRelatedToProducer(user, producerId)) return true;
  return false;
}
