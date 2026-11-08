import { formatDateTime } from "../utils/dates"

interface OfflineBadgeProps {
  cachedAt: string | null
  offlineCopy?: boolean
  savedOffline?: boolean
  onToggleSave?: (() => void) | undefined
  busy?: boolean
}

export default function OfflineBadge({
  cachedAt,
  offlineCopy = false,
  savedOffline = false,
  onToggleSave,
  busy = false,
}: OfflineBadgeProps) {
  if (!cachedAt && !onToggleSave) return null

  return (
    <div className="offline-badge" role="status">
      <span>
        {offlineCopy ? "Offline copy" : savedOffline ? "Saved offline" : "Available offline"}
        {cachedAt ? ` · updated ${formatDateTime(cachedAt) ?? cachedAt}` : ""}
      </span>
      {onToggleSave && (
        <button type="button" disabled={busy} onClick={onToggleSave}>
          {busy ? "Saving…" : savedOffline ? "Remove offline save" : "Save offline"}
        </button>
      )}
    </div>
  )
}