import { accountKey, withOfflineStorage } from "../db"

export async function saveQuizSession(
  accountId: string | number | null | undefined,
  sessionId: string,
  version: string,
  data: unknown,
  completed = false,
): Promise<boolean> {
  const scope = accountKey(accountId)
  return withOfflineStorage(async (db) => {
    await db.quizSessions.put({
      key: `${scope}:${sessionId}`,
      accountId: scope,
      sessionId,
      version,
      data,
      completed,
      updatedAt: new Date().toISOString(),
    })
    return true
  }, false)
}

export async function getQuizSession(
  accountId: string | number | null | undefined,
  sessionId: string,
) {
  const scope = accountKey(accountId)
  return withOfflineStorage(
    (db) => db.quizSessions.get(`${scope}:${sessionId}`).then((row) => row ?? null),
    null,
  )
}