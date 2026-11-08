import { useCallback, useEffect, useState } from "react"
import { useAuth } from "../contexts/AuthContext"
import { isOfflineEnabled } from "../constants/featureFlags"
import { listAccountOutbox, processOutbox } from "../offline"

export default function SyncStatus() {
  const { user, isAuthenticated } = useAuth()
  const [pending, setPending] = useState(0)
  const [conflicts, setConflicts] = useState(0)
  const accountId = user?.id

  const refresh = useCallback(async () => {
    if (!isOfflineEnabled() || !isAuthenticated || accountId === undefined) {
      setPending(0)
      setConflicts(0)
      return
    }
    const rows = await listAccountOutbox(accountId)
    setPending(rows.filter((row) => row.status !== "conflict").length)
    setConflicts(rows.filter((row) => row.status === "conflict").length)
  }, [accountId, isAuthenticated])

  useEffect(() => {
    if (!isOfflineEnabled() || accountId === undefined) return
    const sync = () => void processOutbox(accountId).finally(refresh)
    const foreground = () => {
      if (document.visibilityState === "visible") sync()
    }
    window.addEventListener("online", sync)
    window.addEventListener("wine-words:outbox-queued", sync)
    window.addEventListener("wine-words:outbox-synced", refresh)
    document.addEventListener("visibilitychange", foreground)
    void refresh().then(sync)
    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("wine-words:outbox-queued", sync)
      window.removeEventListener("wine-words:outbox-synced", refresh)
      document.removeEventListener("visibilitychange", foreground)
    }
  }, [accountId, refresh])

  if (!isOfflineEnabled() || (pending === 0 && conflicts === 0)) return null
  return (
    <div className="sync-status" role="status">
      {conflicts > 0
        ? `${conflicts} change${conflicts === 1 ? "" : "s"} need attention`
        : `${pending} change${pending === 1 ? "" : "s"} waiting to sync`}
    </div>
  )
}