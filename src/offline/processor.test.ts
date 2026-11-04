import "fake-indexeddb/auto"
import { ApiError } from "../services/ApiError"
import { commentsApi, likesApi } from "../services/api"
import { getOfflineDb } from "./db"
import { processOutbox } from "./processor"
import { getOutboxOperation, putOutboxOperation } from "./repositories/outboxRepository"

vi.mock("../services/api", () => ({
  commentsApi: { create: vi.fn(), reply: vi.fn() },
  likesApi: { like: vi.fn(), unlike: vi.fn() },
}))

const operation = {
  id: "comment-op",
  idempotencyKey: "comment-op",
  accountId: "7",
  entityType: "comment" as const,
  action: "create",
  payload: { kind: "wine", identifier: "barolo", body: "Hello" },
  createdAt: new Date().toISOString(),
  attempts: 0,
  status: "pending" as const,
}
const offlineDb = getOfflineDb()

beforeEach(async () => {
  await offlineDb.delete()
  await offlineDb.open()
  vi.mocked(commentsApi.create).mockReset()
  vi.mocked(likesApi.like).mockReset()
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
})

afterAll(() => offlineDb.delete())

it("syncs only the requested account and deletes a successful operation", async () => {
  vi.mocked(commentsApi.create).mockResolvedValue({} as never)
  await putOutboxOperation(operation)
  await putOutboxOperation({ ...operation, id: "other", idempotencyKey: "other", accountId: "8" })

  await processOutbox("7")

  expect(commentsApi.create).toHaveBeenCalledWith("wine", "barolo", "Hello", "comment-op")
  expect(await getOutboxOperation("comment-op")).toBeUndefined()
  expect(await getOutboxOperation("other")).toBeDefined()
})

it("keeps validation conflicts for explicit user resolution", async () => {
  vi.mocked(commentsApi.create).mockRejectedValue(new ApiError("invalid", 422, {}))
  await putOutboxOperation(operation)

  await processOutbox("7")

  expect(await getOutboxOperation("comment-op")).toMatchObject({
    status: "conflict",
    attempts: 1,
    lastError: "invalid",
  })
})

it("backs off retryable failures", async () => {
  vi.mocked(commentsApi.create).mockRejectedValue(new TypeError("network down"))
  await putOutboxOperation(operation)

  await processOutbox("7")

  const row = await getOutboxOperation("comment-op")
  expect(row).toMatchObject({ status: "failed", attempts: 1 })
  expect(Date.parse(row?.nextAttemptAt ?? "")).toBeGreaterThan(Date.now())
})