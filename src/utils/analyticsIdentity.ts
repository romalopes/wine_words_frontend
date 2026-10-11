/** Visitor identity management for analytics. */

const VISITOR_ID_KEY = "wine_words_visitor_id";
const SESSION_FALLBACK_KEY = "wine_words_visitor_id_session";

/**
 * Get or create a persistent visitor UUID.
 * Uses localStorage (persistent) with sessionStorage fallback (private mode).
 * Falls back to in-memory only if both are unavailable.
 */
export function getVisitorId(): string {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(VISITOR_ID_KEY);
      if (stored) return stored;
    } catch {
      // Private mode / storage unavailable
    }

    try {
      const stored = sessionStorage.getItem(SESSION_FALLBACK_KEY);
      if (stored) return stored;
    } catch {
      // Session storage also unavailable
    }
  }

  const id = crypto.randomUUID();
  persistVisitorId(id);
  return id;
}

function persistVisitorId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VISITOR_ID_KEY, id);
  } catch {
    try {
      sessionStorage.setItem(SESSION_FALLBACK_KEY, id);
    } catch {
      // Completely unavailable — in-memory only (lost on refresh)
    }
  }
}

/** Clear the stored visitor ID (used on opt-out). */
export function clearVisitorId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(VISITOR_ID_KEY);
  } catch {}
  try {
    sessionStorage.removeItem(SESSION_FALLBACK_KEY);
  } catch {}
}