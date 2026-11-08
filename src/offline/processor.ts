import { commentsApi, likesApi } from "../services/api"
import { errorStatus } from "../utils/errors"
import type { CommentableKind } from "../types/comment"
import type { LikeableKind } from "../types/like"
import {
  deleteOutboxOperation,
  listPendingOutbox,
  putOutboxOperation,
} from "./repositories/outboxRepository"
import type { OutboxOperation } from "./types"

interface CommentPayload {
  kind?: CommentableKind
  identifier?: string | number
  parentId?: number
  body: string
}

interface LikePayload {
  kind: LikeableKind
  identifier: string | number
  desiredLiked: boolean
}

const RETRY_BASE_MS = 2_000
const RETRY_MAX_MS = 5 * 60_000

function retryDelay(attempts: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1), RETRY_MAX_MS)
}

async function execute(operation: OutboxOperation): Promise<void> {
  if (operation.entityType === "comment") {
    const payload = operation.payload as CommentPayload
    if (payload.parentId) {
      await commentsApi.reply(payload.parentId, payload.body, operation.idempotencyKey)
    } else if (payload.kind && payload.identifier !== undefined) {
      await commentsApi.create(
        payload.kind,
        payload.identifier,
        payload.body,
        operation.idempotencyKey,
      )
    }
    return
  }

  if (operation.entityType === "like") {
    const payload = operation.payload as LikePayload
    if (payload.desiredLiked) await likesApi.like(payload.kind, payload.identifier)
    else await likesApi.unlike(payload.kind, payload.identifier)
  }
}

export async function processOutbox(accountId: string | number): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return
  const now = Date.now()
  const operations = await listPendingOutbox(accountId)

  for (const operation of operations) {
    if (operation.nextAttemptAt && Date.parse(operation.nextAttemptAt) > now) continue
    const syncing: OutboxOperation = { ...operation, status: "syncing" }
    await putOutboxOperation(syncing)
    try {
      await execute(syncing)
      await deleteOutboxOperation(syncing.id)
      window.dispatchEvent(new CustomEvent("wine-words:outbox-synced"))
    } catch (error) {
      const status = errorStatus(error)
      const attempts = syncing.attempts + 1
      const conflict = status === 409 || status === 412 || status === 422
      await putOutboxOperation({
        ...syncing,
        attempts,
        status: conflict ? "conflict" : "failed",
        lastError: error instanceof Error ? error.message : "Sync failed",
        ...(conflict
          ? {}
          : { nextAttemptAt: new Date(Date.now() + retryDelay(attempts)).toISOString() }),
      })
      if (status === 401 || status === 403 || conflict) break
    }
  }
}

export function queueableFailure(error: unknown): boolean {
  const status = errorStatus(error)
  return status === null || status >= 500
}