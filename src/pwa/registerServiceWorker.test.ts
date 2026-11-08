import {
  clearWineWordsPwaCaches,
  unregisterWineWordsServiceWorkers,
} from "./registerServiceWorker"

describe("PWA cleanup", () => {
  it("unregisters every service worker registration", async () => {
    const unregister = vi.fn().mockResolvedValue(true)
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
    })

    await unregisterWineWordsServiceWorkers()
    expect(unregister).toHaveBeenCalledOnce()
  })

  it("deletes only Wine Words and Workbox caches", async () => {
    const deleteCache = vi.fn().mockResolvedValue(true)
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: {
        keys: vi.fn().mockResolvedValue(["workbox-precache-v2", "wine-words-images", "other-app"]),
        delete: deleteCache,
      },
    })

    await clearWineWordsPwaCaches()
    expect(deleteCache).toHaveBeenCalledWith("workbox-precache-v2")
    expect(deleteCache).toHaveBeenCalledWith("wine-words-images")
    expect(deleteCache).not.toHaveBeenCalledWith("other-app")
  })
})