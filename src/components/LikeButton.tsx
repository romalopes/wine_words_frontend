import { useLike } from "../hooks/useLike"
import { useAuth } from "../contexts/AuthContext"
import type { LikeableKind } from "../types/like"

interface LikeButtonProps {
  kind: LikeableKind
  identifier: string | number | null | undefined
  initialLiked?: boolean | null | undefined
  initialCount?: number | null | undefined
  onChange?: (state: { liked: boolean; likes_count: number }) => void
  className?: string
}

/**
 * Heart toggle for wines, reviews and articles. Anonymous users see the
 * read-only count; authenticated users can toggle via POST/DELETE /like.
 * All state comes from the API response (server truth), never local +1/-1.
 */
export default function LikeButton({
  kind,
  identifier,
  initialLiked = false,
  initialCount = 0,
  onChange,
  className = "",
}: LikeButtonProps) {
  const { isAuthenticated } = useAuth()
  const { liked, count, pending, error, toggle } = useLike({
    kind,
    identifier,
    initialLiked,
    initialCount,
    enabled: isAuthenticated,
    ...(onChange ? { onChange } : {}),
  })

  if (!isAuthenticated) {
    return (
      <span
        className={`like-button like-button--readonly ${className}`.trim()}
        title={`${count} ${count === 1 ? "like" : "likes"}`}
        aria-label={`${count} likes`}
      >
        <span aria-hidden="true">♡</span> {count}
      </span>
    )
  }

  return (
    <span className="like-button__wrap">
      <button
        type="button"
        className={`like-button${liked ? " like-button--liked" : ""} ${className}`.trim()}
        onClick={(e) => {
          e.stopPropagation()
          void toggle()
        }}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? `Unlike (${count} likes)` : `Like (${count} likes)`}
        title={liked ? "Unlike" : "Like"}
      >
        <span aria-hidden="true">{liked ? "♥" : "♡"}</span> {count}
      </button>
      {error && (
        <span className="like-button__error" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}
