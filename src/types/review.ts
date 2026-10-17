import type { ImageDetail } from "./image"

export interface Review {
  id: number
  slug: string
  title: string
  likes_count?: number
  liked_by_current_user?: boolean
  comment?: string | null
  score?: number | null
  status: string
  drink_from?: number | null
  drink_to?: number | null
  drink_plus?: boolean | null
  user_id?: number | null
  reviewer_name?: string | null
  vintage_id?: number | null
  vintage_year?: number | null
  vintage_no_vintage?: boolean | null
  wine_name?: string | null
  wine_slug?: string | null
  category?: string | null
  categories?: Array<{ id: number; name: string; slug: string }>
  category_ids?: number[]
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
  /** Primary image of the reviewed wine, used when this review has no image. */
  wine_image?: string | null
  /** Content origin: manual | substack | wine_front. Visible to Admin/Editor only. */
  source?: string | null
  published_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  [key: string]: unknown
}
