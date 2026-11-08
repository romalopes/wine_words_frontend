import { accountKey, withOfflineStorage } from "../db"
import type { OutboxOperation } from "../types"

export async function putOutboxOperation(operation: OutboxOperation): Promise<boolean> {
  return withOfflineStorage(async (db) => {
    await db.outbox.put({ ...operation, accountId: accountKey(operation.accountId) })
    return true
  }, false)
}

export async function listPendingOutbox(accountId: string | number) {
  const scope = accountKey(accountId)
  return withOfflineStorage(
    (db) => db.outbox.where("accountId").equals(scope).filter((row) => row.status !== "conflict").sortBy("createdAt"),
    [],
  )
}

export async function listAccountOutbox(accountId: string | number) {
  const scope = accountKey(accountId)
  return withOfflineStorage(
    (db) => db.outbox.where("accountId").equals(scope).sortBy("createdAt"),
    [],
  )
}

export async function deleteOutboxOperation(id: string): Promise<void> {
  await withOfflineStorage(async (db) => {
    await db.outbox.delete(id)
  }, undefined)
}

export async function getOutboxOperation(id: string) {
  return withOfflineStorage((db) => db.outbox.get(id), undefined)
}