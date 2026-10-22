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
