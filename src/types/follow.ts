/** Follow target kinds (issue #192). Vintages and users are out of scope. */
export type FollowableType = "Producer" | "Wine" | "Review" | "Article"

/** One follow row as returned by `FollowSerializer`. */
export interface Follow {
  id: number
  followable_type: FollowableType
  followable_id: number
  /** Display name (Producer/Wine) or title (Review/Article). */
  target_label: string | null
  target_slug: string | null
  /** Frontend route to the target, e.g. `/wines/penfolds-bin-389`. */
  target_path: string | null
  following: boolean
  created_at: string | null
}

/** Answer to `GET /api/v1/follows/status`. */
export interface FollowStatus {
  followable_type: FollowableType
  followable_id: number
  follow_id: number | null
  following: boolean
}

/** Answer to `GET /api/v1/follows/statuses`. */
export interface FollowStatuses {
  followable_type: FollowableType
  followed_ids: number[]
}

export interface FollowWritePayload {
  followable_type: FollowableType
  /** Numeric id of the target; the API also resolves slugs. */
  followable_id?: number | string
  /** Slug form of the target (preferred on detail pages). */
  followable_slug?: string
}