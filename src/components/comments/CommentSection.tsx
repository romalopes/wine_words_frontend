import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import CommentForm from "./CommentForm"
import CommentList from "./CommentList"
import { useAuth } from "../../contexts/AuthContext"
import { useComments } from "../../hooks/useComments"
import type { CommentableId } from "../../services/commentsApi"
import type { CommentableKind } from "../../types/comment"

interface CommentSectionProps {
  /** Which polymorphic endpoint to talk to. */
  kind: CommentableKind
  /** Slug (preferred) or numeric id of the wine / review / article. */
  identifier: CommentableId | null | undefined
  title?: string
}

/**
 * The complete commenting UI for a wine, a review or an article.
 *
 * One component for all three because the API already flattened the
 * polymorphism: the kind only selects the URL. `CommentSection` owns loading,
 * the empty state and the logged-out / no-permission state; the sub-components
 * stay presentational.
 */
export default function CommentSection({
  kind,
  identifier,
  title = "Comments",
}: CommentSectionProps) {
  const { isAuthenticated, user } = useAuth()
  const {
    comments,
    count,
    loading,
    pending,
    error,
    offlineCopy,
    cachedAt,
    create,
    reply,
    update,
    remove,
  } = useComments({ kind, identifier })

  // Id of the comment with an open inline reply/edit form, or null. While one is
  // open it owns the error message, so the top-level form and the list banner
  // stand down — the failure is then reported exactly once, which also means a
  // screen reader announces it once.
  const [inlineFormOwner, setInlineFormOwner] = useState<number | null>(null)

  // Mirrors Comments::Permission: every signed-in account may comment except a
  // pure Guest. The API re-checks this — this only decides what to render.
  const canComment = isAuthenticated && canCommentAs(user?.roles)

  // Deep link from a card: when the URL carries #comments, move real keyboard
  // focus here, not just the viewport. A plain anchor jump scrolls but leaves
  // focus on the document, so the next Tab would restart from the top of the
  // page — the section would look focused on screen and behave as if it were not.
  const sectionRef = useRef<HTMLElement | null>(null)
  const location = useLocation()
  // Ring shown only while the deep-linked section holds focus; cleared on blur so
  // the marker does not stay on screen after the user tabs away.
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (location.hash !== "#comments") return

    const node = sectionRef.current
    if (!node) return

    node.focus({ preventScroll: true })
    node.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [location.hash, comments.length])

  return (
    <section
      className={focused ? "comments comments--focused" : "comments"}
      aria-label={title}
      id="comments"
      ref={sectionRef}
      // Focusable so it can receive focus programmatically. Not in the tab
      // order: a Tab stop that is only interesting right after arriving from a
      // card link would be noise for everyone else.
      tabIndex={-1}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <h2 className="comments__title">
        {title} ({count})
      </h2>

      {offlineCopy && (
        <p className="comments__offline-status" role="status">
          Offline comments · last updated {cachedAt ? new Date(cachedAt).toLocaleString() : "previously"}
        </p>
      )}

      {!isAuthenticated ? (
        <p className="comments__status">Please log in to join the discussion.</p>
      ) : canComment ? (
        <CommentForm
          label="Add a comment"
          submitLabel="Comment"
          pending={pending}
          error={inlineFormOwner === null ? error : null}
          onSubmit={create}
        />
      ) : (
        <p className="comments__status">
          Your current plan does not include commenting. Upgrade to join the discussion.
        </p>
      )}

      <CommentList
        comments={comments}
        loading={loading}
        pending={pending}
        error={error}
        canReply={canComment}
        onReply={reply}
        onUpdate={update}
        onDelete={remove}
        onFormOpenChange={setInlineFormOwner}
        suppressError={inlineFormOwner !== null}
      />
    </section>
  )
}

/**
 * True for any role other than Guest — the same rule as User#commenter? on the
 * server. Written as a denial of Guest rather than an allow-list so a role added
 * later keeps working on the client too.
 */
export function canCommentAs(roles: string[] | undefined | null): boolean {
  if (!roles || roles.length === 0) return false
  return roles.some((role) => role !== "Guest")
}