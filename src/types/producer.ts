import type { Country } from "./reference"
import type { Wine } from "./wine"

/** Mirrors `address_json` in Api::V1::ProducersController. */
export interface ProducerAddress {
  id: number
  street_address: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: Country | null
}

/** `address` as rendered by the list columns (a single formatted line). */
export interface ProducerAddressSummary {
  id?: number
  street_address?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: Country | null
}

/** A region attached to a producer: `{ id, name, country_name }`. */
export interface ProducerRegionRef {
  id: number
  name: string
  country_name?: string | null
}

/** A grape attached to a producer: `{ id, name, color }`. */
export interface ProducerGrapeRef {
  id: number
  name: string
  color?: string | null
}

export interface Producer {
  id: number
  slug: string
  name: string
  legal_name?: string | null
  address?: ProducerAddress | null
  email?: string | null
  website?: string | null
  description?: string | null
  producer_type?: string | null
  instagram?: string | null
  facebook?: string | null
  phone?: string | null
  founded_year?: number | null
  active?: boolean
  country?: Country | null
  /**
   * Each entry is `{ id, name, country_name }` — the association payload from
   * `producer_json`, not a full `Region` record.
   */
  regions?: ProducerRegionRef[]
  /**
   * Each entry is `{ id, name, color }` — grape associations carry a colour so
   * the form can recolour the tag chips.
   */
  grapes?: ProducerGrapeRef[]
  logo_url?: string | null
  /**
   * Ordered image URL strings — `image_urls` in the producers controller.
   * NOTE: this is `string[]`, not `Image[]`; producers expose no rich
   * `image_details` payload, only `logo_url` and these flat URLs.
   */
  images?: string[]
  wines?: Wine[]
  wines_count?: number
  [key: string]: unknown
}

/**
 * Payload of `GET /producers/search` (`producer_search_json`). Note that
 * `address` is the formatted street address string here, not the nested
 * `address_json` object returned by the other producer endpoints.
 */
export interface ProducerSearchResult {
  id: number
  slug: string
  name: string
  address?: string | null
  email?: string | null
  website?: string | null
  description?: string | null
  producer_type?: string | null
  instagram?: string | null
  facebook?: string | null
  country?: Country | null
  logo_url?: string | null
  [key: string]: unknown
}

export interface SubscriptionFeature {
  id: number
  name: string
}

/** Lightweight producer summary for /account/producers endpoint. */
export interface ProducerSummary {
  id: number
  name: string
  slug: string
  country: string | null
  email: string | null
  producer_type: string | null
  founded_year: number | null
}
