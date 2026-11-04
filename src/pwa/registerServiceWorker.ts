const PWA_FLAG = "true"
export const PWA_UPDATE_EVENT = "wine-words:pwa-update"
export const PWA_OFFLINE_READY_EVENT = "wine-words:pwa-offline-ready"

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null

export function isPwaEnabled(): boolean {
  return import.meta.env.VITE_PWA_ENABLED === PWA_FLAG
}

/**
 * This guard deliberately does not register in tests, development, or dark builds.
 */
export function registerWineWordsServiceWorker(): void {
  if (!isPwaEnabled() || !import.meta.env.PROD || typeof navigator === "undefined") {
    return
  }

  // Importing the module starts the plugin-managed prompt registration. Keeping
  // it dynamic prevents disabled builds from evaluating any service-worker code.
  void import("virtual:pwa-register").then(({ registerSW }) => {
    updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => window.dispatchEvent(new Event(PWA_UPDATE_EVENT)),
      onOfflineReady: () => window.dispatchEvent(new Event(PWA_OFFLINE_READY_EVENT)),
    })
  })
}

export async function applyPwaUpdate(): Promise<void> {
  await updateServiceWorker?.(true)
}

/** Emergency rollback path for a cleanup release or support action. */
export async function unregisterWineWordsServiceWorkers(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))
}

export async function clearWineWordsPwaCaches(): Promise<void> {
  if (typeof caches === "undefined") return
  const keys = await caches.keys()
  await Promise.all(
    keys
      .filter((key) => /workbox|wine[-_ ]?words|precache/i.test(key))
      .map((key) => caches.delete(key)),
  )
}

export async function cleanupWineWordsPwa(): Promise<void> {
  await unregisterWineWordsServiceWorkers()
  await clearWineWordsPwaCaches()
}