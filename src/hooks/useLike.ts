import { useCallback, useEffect, useRef, useState } from "react"
import { likesApi } from "../services/api"
import { errorStatus } from "../utils/errors"
import type { LikeableKind } from "../types/like"
import { isOfflineEnabled } from "../constants/featureFlags"
import { putOutboxOperation, queueableFailure } from "../offline"

export interface UseLikeOptions {
  kind: LikeableKind
  /** Slug (preferred) or numeric id used in the like URL. */
  identifier: string | number | null | undefined
  initialLiked: boolean | null | undefined
  initialCount: number | null | undefined
  /** When false (anonymous) the control renders read-only and never calls the API. */
  enabled?: boolean
  accountId?: string | number | null
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
  accountId,
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
      if (isOfflineEnabled() && accountId != null && queueableFailure(err)) {
        const desiredLiked = !liked
        const operationId = `like:${accountId}:${kind}:${identifier}`
        await putOutboxOperation({
          id: operationId,
          idempotencyKey: operationId,
          accountId: String(accountId),
          entityType: "like",
          entityId: `${kind}:${identifier}`,
          action: "set",
          payload: { kind, identifier, desiredLiked },
          createdAt: new Date().toISOString(),
          attempts: 0,
          status: "pending",
        })
        const nextCount = Math.max(0, count + (desiredLiked ? 1 : -1))
        setLiked(desiredLiked)
        setCount(nextCount)
        onChangeRef.current?.({ liked: desiredLiked, likes_count: nextCount })
        setError("Waiting to sync")
        window.dispatchEvent(new CustomEvent("wine-words:outbox-queued"))
        return
      }
      if (errorStatus(err) === 401) {
        setError("Sign in to like.")
      } else {
        setError(err instanceof Error && err.message ? err.message : "Couldn't update the like. Try again.")
      }
    } finally {
      setPending(false)
    }
  }, [enabled, pending, identifier, kind, liked, count, accountId])

  return { liked, count, pending, error, toggle, setLiked, setCount }
}
