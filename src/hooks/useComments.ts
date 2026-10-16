import { useCallback, useEffect, useState } from "react"
import { commentsApi } from "../services/api"
import { errorStatus } from "../utils/errors"
import type { CommentDTO, CommentableKind } from "../types/comment"
import type { CommentableId } from "../services/commentsApi"

export interface UseCommentsOptions {
  kind: CommentableKind
  /** Slug (preferred) or numeric id used in the comments URL. */
  identifier: CommentableId | null | undefined
}

/**
 * Loads and mutates one comment thread.
 *
 * Server truth, exactly like `useLike`: a mutation never patches local state
 * from what the client guessed — the record the API returns replaces the one in
 * the thread, so `editable` / `deletable` / `deleted` always reflect the current
 * authorization state rather than a stale client-side assumption.
 *
 * Optimistic-free on purpose: a failed request leaves the thread untouched and
 * surfaces an error message.
 */
export function useComments({ kind, identifier }: UseCommentsOptions) {
  const [comments, setComments] = useState<CommentDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasIdentifier = identifier !== null && identifier !== undefined && identifier !== ""

  const load = useCallback(async () => {
    if (!hasIdentifier) {
      setComments([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const thread = await commentsApi.list(kind, identifier as CommentableId)
      setComments(thread.comments)
    } catch (err) {
      setError(describe(err, "Couldn't load the comments."))
    } finally {
      setLoading(false)
    }
  }, [kind, identifier, hasIdentifier])

  // Re-fetch whenever the resource changes (navigation between two wines, say).
  useEffect(() => {
    void load()
  }, [load])

  /** Replace one comment wherever it sits in the tree (top level or a reply). */
  const replaceComment = useCallback((updated: CommentDTO) => {
    setComments((current) => {
      const apply = (list: CommentDTO[]): CommentDTO[] =>
        list.map((comment) => {
          if (comment.id === updated.id) return updated
          if (comment.replies.length > 0) {
            return { ...comment, replies: apply(comment.replies) }
          }
          return comment
        })
      return apply(current)
    })
  }, [])

  /**
   * Adds a created reply to the thread.
   *
   * The parent comes from the API's own `parent_id`, NOT from the id the form was
   * opened against: replying to a reply attaches the new comment to that reply's
   * parent, so the row the user clicked and the row the reply belongs to can
   * differ. Walking the whole tree (rather than only the top level) keeps the
   * insertion correct wherever the server put it.
   */
  const appendReply = useCallback((reply: CommentDTO) => {
    const parentId = reply.parent_id
    if (parentId === null || parentId === undefined) return

    setComments((current) => {
      const apply = (list: CommentDTO[]): CommentDTO[] =>
        list.map((comment) => {
          if (comment.id === parentId) {
            return { ...comment, replies: [...comment.replies, reply] }
          }
          if (comment.replies.length > 0) {
            return { ...comment, replies: apply(comment.replies) }
          }
          return comment
        })
      return apply(current)
    })
  }, [])

  /**
   * Runs a mutation and folds the returned record back into the thread.
   *
   * The error is recorded AND re-thrown, so a calling form can tell a
   * successful submit (clear the textarea) from a failed one (keep the text).
   */
  const mutate = useCallback(
    async (action: () => Promise<CommentDTO>, after: (comment: CommentDTO) => void) => {
      setPending(true)
      setError(null)
      try {
        after(await action())
      } catch (err) {
        setError(describe(err, "Couldn't save the comment. Try again."))
        throw err
      } finally {
        setPending(false)
      }
    },
    [],
  )

  const create = useCallback(
    (body: string) =>
      mutate(
        () => commentsApi.create(kind, identifier as CommentableId, body),
        (created) => setComments((current) => [...current, created]),
      ),
    [mutate, kind, identifier],
  )

  const reply = useCallback(
    (commentId: number, body: string) =>
      mutate(
        () => commentsApi.reply(commentId, body),
        // The server decides the parent (see appendReply), not the clicked id.
        (created) => appendReply(created),
      ),
    [mutate, appendReply],
  )

  const update = useCallback(
    (commentId: number, body: string) =>
      mutate(() => commentsApi.update(commentId, body), replaceComment),
    [mutate, replaceComment],
  )

  const remove = useCallback(
    (commentId: number) =>
      mutate(() => commentsApi.remove(commentId), replaceComment),
    [mutate, replaceComment],
  )

  return {
    comments,
    /** Total number of top-level comments — what the section header shows. */
    count: comments.length,
    loading,
    pending,
    error,
    reload: load,
    create,
    reply,
    update,
    remove,
    setError,
  }
}

/** A 401/403 needs a different sentence than a generic network failure. */
function describe(error: unknown, fallback: string): string {
  const status = errorStatus(error)
  if (status === 403) return "Your account cannot comment."
  if (status === 401) return "Sign in to join the discussion."
  if (error instanceof Error && error.message) return error.message
  return fallback
}