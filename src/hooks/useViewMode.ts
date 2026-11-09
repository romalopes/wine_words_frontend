import { useCallback, useState } from "react"
import type { ViewMode } from "../types/common"

const isViewMode = (value: unknown): value is ViewMode =>
  value === "cards" || value === "list"

/**
 * Cards / List preference for one listing page.
 *
 * Persisted per page under `storageKey`, so the choice survives a navigation to
 * a detail page and back, and a full reload. Storage is entirely optional: a
 * private-mode browser (or a disabled cookie store) that throws on access falls
 * back to in-memory state instead of crashing the page.
 */
export function useViewMode(
  storageKey: string,
  fallback: ViewMode = "cards",
): [ViewMode, (value: ViewMode) => void] {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return fallback
    try {
      const stored = window.localStorage.getItem(storageKey)
      return isViewMode(stored) ? stored : fallback
    } catch {
      return fallback
    }
  })

  const setViewMode = useCallback(
    (value: ViewMode) => {
      setViewModeState(value)
      try {
        window.localStorage.setItem(storageKey, value)
      } catch {
        // Storage refused (private mode / quota). The in-memory choice stands
        // for this session; nothing here is worth interrupting the user over.
      }
    },
    [storageKey],
  )

  return [viewMode, setViewMode]
}

export default useViewMode
