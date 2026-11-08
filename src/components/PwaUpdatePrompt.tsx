import { useEffect, useState } from "react"
import {
  applyPwaUpdate,
  isPwaEnabled,
  PWA_OFFLINE_READY_EVENT,
  PWA_UPDATE_EVENT,
} from "../pwa/registerServiceWorker"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return ios && !standalone
}

export default function PwaUpdatePrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissedInstall, setDismissedInstall] = useState(false)
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const enabled = isPwaEnabled()

  useEffect(() => {
    if (!enabled) return
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    const onUpdate = () => setNeedRefresh(true)
    const onOfflineReady = () => setOfflineReady(true)
    window.addEventListener(PWA_UPDATE_EVENT, onUpdate)
    window.addEventListener(PWA_OFFLINE_READY_EVENT, onOfflineReady)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener(PWA_UPDATE_EVENT, onUpdate)
      window.removeEventListener(PWA_OFFLINE_READY_EVENT, onOfflineReady)
    }
  }, [enabled])

  if (!enabled) return null

  const showInstall = !dismissedInstall && (Boolean(installEvent) || isIosSafari())
  if (!needRefresh && !offlineReady && !showInstall) return null

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
  }

  return (
    <aside className="pwa-prompt" aria-live="polite" aria-label="App status">
      {needRefresh ? (
        <>
          <strong>Wine Words has an update.</strong>
          <button type="button" onClick={() => void applyPwaUpdate()}>Reload</button>
          <button type="button" onClick={() => setNeedRefresh(false)}>Later</button>
        </>
      ) : offlineReady ? (
        <>
          <span>Wine Words is ready for offline use.</span>
          <button type="button" onClick={() => setOfflineReady(false)}>Dismiss</button>
        </>
      ) : (
        <>
          <span>
            {installEvent
              ? "Install Wine Words for quicker access."
              : "On iPhone or iPad, use Share, then Add to Home Screen."}
          </span>
          {installEvent && <button type="button" onClick={() => void install()}>Install</button>}
          <button type="button" onClick={() => setDismissedInstall(true)}>Not now</button>
        </>
      )}
    </aside>
  )
}