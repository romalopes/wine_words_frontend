import type { CommentDTO } from "../../types/comment";

interface CommentActionsProps {
  comment: CommentDTO
  pending: boolean
  canReply: boolean
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
}

/**
 * The Reply / Edit / Delete row of one comment.
 *
 * Which buttons appear is decided by the SERVER (`comment.editable`,
 * `comment.deletable`, resolved through Comments::Permission) plus whether the
 * viewer may comment at all. Hiding a control is only a convenience — the API
 * rejects the action regardless, so this never becomes the security boundary.
 */
export default function CommentActions({
  comment,
  pending,
  canReply,
  onReply,
  onEdit,
  onDelete,
}: CommentActionsProps) {
  if (comment.deleted) return null

  return (
    <div className="comment-actions">
      {canReply && (
        <button type="button" onClick={onReply} disabled={pending}>
          Reply
        </button>
      )}
      {comment.editable && (
        <button type="button" onClick={onEdit} disabled={pending}>
          Edit
        </button>
      )}
      {comment.deletable && (
        <button type="button" onClick={onDelete} disabled={pending}>
          Delete
        </button>
      )}
    </div>
  )
}