import { useCallback, useEffect, useRef, useState } from "react"
import { likesApi } from "../services/api"
import { errorStatus } from "../utils/errors"
import type { LikeableKind } from "../types/like"

export interface UseLikeOptions {
  kind: LikeableKind
  /** Slug (preferred) or numeric id used in the like URL. */
  identifier: string | number | null | undefined
  initialLiked: boolean | null | undefined
  initialCount: number | null | undefined
  /** When false (anonymous) the control renders read-only and never calls the API. */
  enabled?: boolean
  onChange?: (state: { liked: boolean; likes_count: number }) => void
}

/**
 * Server-truth like toggle. The API response is authoritative: the UI updates
 * only from `{ liked, likes_count }` after success, and a failure leaves the
 * previous state untouched. In-flight clicks are ignored (button disabled),
 * so double-clicks can't inflate the count.
 */
export function useLike({
  kind,
  identifier,
  initialLiked = false,
  initialCount = 0,
  enabled = true,
  onChange,
}: UseLikeOptions) {
  const [liked, setLiked] = useState(Boolean(initialLiked))
  const [count, setCount] = useState(Number(initialCount) || 0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Re-sync when the parent loads fresh server data (navigation, refetch).
  useEffect(() => {
    setLiked(Boolean(initialLiked))
    setCount(Number(initialCount) || 0)
  }, [kind, identifier, initialLiked, initialCount])

  const toggle = useCallback(async () => {
    if (!enabled || pending || identifier === null || identifier === undefined || identifier === "") return
    setPending(true)
    setError(null)
    try {
      const result = await likesApi.toggle(kind, identifier, liked)
      setLiked(result.liked)
      setCount(result.likes_count)
      onChangeRef.current?.({ liked: result.liked, likes_count: result.likes_count })
    } catch (err) {
      if (errorStatus(err) === 401) {
        setError("Sign in to like.")
      } else {
        setError(err instanceof Error && err.message ? err.message : "Couldn't update the like. Try again.")
      }
    } finally {
      setPending(false)
    }
  }, [enabled, pending, identifier, kind, liked])

  return { liked, count, pending, error, toggle, setLiked, setCount }
}
