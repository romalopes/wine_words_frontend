export type QueryValue = string | number | boolean | null | undefined

export type QueryParams = Record<string, QueryValue | QueryValue[]>

export interface Paginated<T> {
  items: T[]
  page: number
  per_page?: number
  total_count?: number
  total_pages: number
}

export interface PaginationParams {
  page?: number
  per_page?: number
  [key: string]: QueryValue | QueryValue[] | undefined
}

export type ResourceResponse<T> = T[] | Paginated<T>

/**
 * The items of a `ResourceResponse`, whichever of the two shapes the API chose.
 *
 * Several endpoints return a bare array when no `page` is requested and the
 * pagination envelope when one is (see the Rails `render_paginated` helper).
 * Callers that only need the rows should use this instead of
 * `Array.isArray(data) ? data : []`, which silently empties the paginated case.
 */
export function responseItems<T>(response: ResourceResponse<T>): T[] {
  return Array.isArray(response) ? response : response.items
}

/**
 * Identifies the entity a link dialog should attach the selected record to.
 * `type` must match a key of the dialog's `LINK_ENDPOINTS` map
 * ("category" | "region" | "grape" | "producer" for wines).
 */
export type LinkEntityType = "category" | "region" | "grape" | "producer" | "country"

export interface LinkEntityContext {
  type: LinkEntityType
  id: number
  name?: string | null
}

export interface ApiResponse<T> {
  data: T
  status: number
}

/**
 * How a listing renders its rows: an image-card grid, or a table. Shared by
 * every page that offers the Cards / List switch so the persisted preference
 * and the toggle component speak the same vocabulary.
 */
export type ViewMode = "cards" | "list"

