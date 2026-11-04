import { useEffect, useState } from "react"
import { pushSubscriptionsApi } from "../services/api"

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function subscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON()
  return {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  }
}

export default function PushNotificationControl() {
  const supported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!supported) return
    void navigator.serviceWorker.ready.then((registration) =>
      registration.pushManager.getSubscription().then((subscription) => setEnabled(Boolean(subscription))),
    )
  }, [supported])

  async function enable() {
    setBusy(true)
    setStatus(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus("Push notifications were not enabled. You can still use the notification bell.")
        return
      }
      const [{ public_key: publicKey }, registration] = await Promise.all([
        pushSubscriptionsApi.vapidPublicKey(),
        navigator.serviceWorker.ready,
      ])
      if (!publicKey) throw new Error("Push notifications are not configured on the server.")
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeBase64Url(publicKey),
        }))
      await pushSubscriptionsApi.create(subscriptionPayload(subscription))
      setEnabled(true)
      setStatus("Push notifications enabled on this device.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn't enable push notifications.")
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setStatus(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const browserSubscription = await registration.pushManager.getSubscription()
      const records = await pushSubscriptionsApi.list()
      const record = records.find((row) => row.endpoint === browserSubscription?.endpoint)
      if (record) await pushSubscriptionsApi.remove(record.id)
      await browserSubscription?.unsubscribe()
      setEnabled(false)
      setStatus("Push notifications disabled on this device.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn't disable push notifications.")
    } finally {
      setBusy(false)
    }
  }

  if (!supported) {
    return <p className="following-page__status">Push notifications are not supported in this browser.</p>
  }

  return (
    <div className="following-page__pref-row push-notification-control">
      <div>
        <strong>Device push notifications</strong>
        <span>Best-effort alerts; the Wine Words notification bell remains canonical.</span>
      </div>
      <button type="button" disabled={busy} onClick={() => void (enabled ? disable() : enable())}>
        {busy ? "Working…" : enabled ? "Disable on this device" : "Enable on this device"}
      </button>
      {status && <p role="status">{status}</p>}
    </div>
  )
}