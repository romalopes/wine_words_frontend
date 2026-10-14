import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import type { Paginated, QueryParams } from "../types/common"
import { errorMessage } from "../utils/errors"

export interface UsePagedListOptions<T> {
  fetcher: (params: QueryParams) => Promise<T[] | Paginated<T>>
  extraParams?: QueryParams
  enabled?: boolean
  paramKey?: string
  perPage?: number
}

export interface PagedList<T> {
  items: T[]
  page: number
  setPage: (next: number | string) => void
  totalPages: number
  totalCount: number
  loading: boolean
  error: string | null
  reload: () => void
  /** Merge a partial update into one item by id, without refetching. */
  patchItem: (id: number | string, patch: Partial<T>) => void
}

// Reusable paginated-list state. Fetches one page at a time from an API
// endpoint that returns either T[] or { items, page, per_page, total_count,
// total_pages }, and keeps the current page in the URL search params.
function usePagedList<T>({
  fetcher,
  extraParams = {},
  enabled = true,
  paramKey = "page",
  perPage = 20,
}: UsePagedListOptions<T>): PagedList<T> {
  const [searchParams, setSearchParams] = useSearchParams()
  const pageFromUrl = Math.max(parseInt(searchParams.get(paramKey) ?? "1", 10) || 1, 1)

  const [items, setItems] = useState<T[]>([])
  const [page, setPageState] = useState(pageFromUrl)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const extraKey = JSON.stringify(extraParams)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load(): Promise<void> {
      try {
        setLoading(true)
        setError(null)
        const params = JSON.parse(extraKey) as QueryParams
        const data = await fetcherRef.current({ page, per_page: perPage, ...params })
        if (cancelled) return
        if (Array.isArray(data)) {
          setItems(data)
          setTotalPages(1)
          setTotalCount(data.length)
        } else {
          const nextItems = Array.isArray(data.items) ? data.items : []
          setItems(nextItems)
          setPageState(data.page || page)
          setTotalPages(Math.max(data.total_pages || 1, 1))
          setTotalCount(data.total_count ?? nextItems.length)
        }
      } catch (err: unknown) {
        if (!cancelled) setError(errorMessage(err, "Failed to load list"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [page, extraKey, reloadToken, enabled, perPage])

  const setPage = useCallback(
    (next: number | string) => {
      const value = Math.max(Number(next) || 1, 1)
      const params = new URLSearchParams(searchParams)
      if (value === 1) params.delete(paramKey)
      else params.set(paramKey, String(value))
      setSearchParams(params, { replace: false })
      setPageState(value)
      window.scrollTo({ top: 0, behavior: "smooth" })
    },
    [searchParams, setSearchParams, paramKey],
  )

  useEffect(() => {
    if (pageFromUrl !== page) setPageState(pageFromUrl)
  }, [pageFromUrl, page])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  const patchItem = useCallback((id: number | string, patch: Partial<T>) => {
    setItems((prev) =>
      prev.map((item) =>
        (item as { id?: unknown }).id === id ? { ...item, ...patch } : item,
      ),
    )
  }, [])

  return {
    items,
    page,
    setPage,
    totalPages,
    totalCount,
    loading,
    error,
    reload,
    patchItem,
  }
}

export default usePagedList
