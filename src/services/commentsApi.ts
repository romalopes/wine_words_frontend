import type { ApiRequester } from "./apiClient"
import type { CommentDTO, CommentThread, CommentableKind } from "../types/comment"

export type { ApiRequester } from "./apiClient"

/** Slug (preferred) or numeric id, exactly like the likes URLs. */
export type CommentableId = string | number

function commentsPath(kind: CommentableKind, id: CommentableId): string {
  const segment =
    kind === "wine" ? "wines" : kind === "review" ? "reviews" : "articles"
  return `/${segment}/${id}/comments`
}

export interface CommentsApi {
  list(kind: CommentableKind, id: CommentableId): Promise<CommentThread>
  /** New top-level comment on a wine / review / article. */
  create(kind: CommentableKind, id: CommentableId, body: string, idempotencyKey?: string): Promise<CommentDTO>
  /**
   * Reply to a comment. The API derives the commentable from the parent, so no
   * commentable type or id is ever sent here.
   */
  reply(commentId: number, body: string, idempotencyKey?: string): Promise<CommentDTO>
  update(commentId: number, body: string): Promise<CommentDTO>
  /** Soft delete: the thread keeps its shape and the API returns the tombstone. */
  remove(commentId: number): Promise<CommentDTO>
}

/**
 * Comments for every commentable type through one client. The kind only picks
 * the URL segment — the payloads and the thread shape are identical, which is
 * what makes the polymorphic backend invisible to the React components.
 */
export function createCommentsApi(request: ApiRequester): CommentsApi {
  return {
    list(kind, id) {
      return request<CommentThread>(commentsPath(kind, id), { method: "GET" })
    },
    create(kind, id, body, idempotencyKey) {
      return request<CommentDTO>(commentsPath(kind, id), {
        method: "POST",
        auth: true,
        body: { comment: { body } },
        ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
      })
    },
    reply(commentId, body, idempotencyKey) {
      return request<CommentDTO>(`/comments/${commentId}/replies`, {
        method: "POST",
        auth: true,
        body: { comment: { body } },
        ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
      })
    },
    update(commentId, body) {
      return request<CommentDTO>(`/comments/${commentId}`, {
        method: "PATCH",
        auth: true,
        body: { comment: { body } },
      })
    },
    remove(commentId) {
      return request<CommentDTO>(`/comments/${commentId}`, {
        method: "DELETE",
        auth: true,
      })
    },
  }
}