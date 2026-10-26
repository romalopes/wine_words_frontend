import type { Category } from "./catalog"
import type { GrapeRef } from "./catalog"
import type { Country, Region } from "./reference"
import type { ImageDetail } from "./image"

export interface Vintage {
  id: number
  year: number | null
  prompt?: string | null
  price?: number | null
  no_vintage?: boolean
  reviews_count?: number
}

export interface Wine {
  id: number
  slug: string
  name: string
  likes_count?: number
  liked_by_current_user?: boolean
  color?: string | null
  sparkling?: boolean | null
  fortified?: boolean | null
  closure?: string | null
  alcohol_percentage?: number | null
  volume_ml?: number | null
  volume_label?: string | null
  prompt?: string | null
  designation_name?: string | null
  producer?: ProducerSummary | null
  category?: string | null
  category_id?: number | null
  categories?: Category[]
  grapes?: GrapeRef[]
  regions?: Region[]
  parameters?: WineTasteParameter[]
  /**
   * The WineProfile this wine was linked to (explicitly, or auto-assigned on
   * create when no taste parameters were submitted). The `parameters` scores
   * are a snapshot copied at creation time and do not re-sync if the profile
   * later changes.
   */
  wine_profile_id?: number | null
  /** `{ id, slug, name }` stub of the linked profile, or null. */
  wine_profile?: { id: number; slug: string; name: string } | null
  vintages?: Vintage[]
  /**
   * Ordered image URL strings — `image_urls` in Rails (ImageAttributes).
   * NOTE: this is `string[]`, not `Image[]`. The rich per-image objects live in
   * `image_details`; `images` is the flat backward-compatible URL list.
   */
  images?: string[]
  /** Image record ids, position-ordered. */
  image_ids?: number[]
  /** Rich image objects: `{ id, url, filename, content_type, position, primary }`. */
  image_details?: ImageDetail[]
  /** URL of the primary (else first) image, or null when there are none. */
  primary_image?: string | null
  [key: string]: unknown
}

export interface ProducerSummary {
  id: number
  slug: string
  name: string
  address?: string | null
  email?: string | null
}

export interface WineTasteParameter {
  id: number
  taste_parameter_id: number
  taste_parameter_slug: string
  score: number
}

/**
 * One entry of `vintages_attributes` on a wine create/update. `id` is only sent
 * for rows that already exist in the database — the API treats its presence as
 * "update this row" and its absence as "create a new one".
 */
export interface VintageWrite {
  id?: number
  year: number
  prompt: string | null
  price: number | null
  no_vintage: boolean
}

/**
 * The lean `WineListSerializer` payload (list, table and grouped views).
 * Optional because the show/quick-create endpoints return a full `Wine`
 * without the counter, and both are stored in the same component state.
 */
export interface WineListItem extends Wine {
  vintages_count?: number
}

export type { Country }
