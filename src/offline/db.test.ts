import "fake-indexeddb/auto"
import { WineWordsOfflineDb, clearOfflineAccount, setOfflineDbForTests } from "./db"
import { cacheContent, getCachedContent } from "./repositories/contentRepository"
import { putOutboxOperation } from "./repositories/outboxRepository"

describe("offline database", () => {
  let db: WineWordsOfflineDb

  beforeEach(() => {
    db = new WineWordsOfflineDb(`wine-words-test-${crypto.randomUUID()}`)
    setOfflineDbForTests(db)
  })

  afterEach(async () => {
    db.close()
    await db.delete()
    setOfflineDbForTests(null)
  })

  it("keeps cached content isolated by account", async () => {
    await cacheContent(1, "review", "same-review", { id: 1, slug: "same-review", title: "One", status: "published" })
    await cacheContent(2, "review", "same-review", { id: 1, slug: "same-review", title: "Two", status: "published" })

    expect((await getCachedContent(1, "review", "same-review"))?.data.title).toBe("One")
    expect((await getCachedContent(2, "review", "same-review"))?.data.title).toBe("Two")
  })

  it("purges all account-scoped tables on logout without touching another account", async () => {
    await cacheContent(1, "review", "one", { id: 1, slug: "one", title: "One", status: "published" })
    await cacheContent(2, "review", "two", { id: 2, slug: "two", title: "Two", status: "published" })
    await putOutboxOperation({
      id: "operation-1",
      idempotencyKey: "operation-1",
      accountId: "1",
      entityType: "comment",
      action: "create",
      payload: { body: "Draft" },
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    })

    await clearOfflineAccount(1)

    expect(await getCachedContent(1, "review", "one")).toBeNull()
    expect(await getCachedContent(2, "review", "two")).not.toBeNull()
    expect(await db.outbox.where("accountId").equals("1").count()).toBe(0)
  })
})