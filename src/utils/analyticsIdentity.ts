/** Visitor identity management for analytics. */

const VISITOR_ID_KEY = "wine_words_visitor_id";
const SESSION_FALLBACK_KEY = "wine_words_visitor_id_session";

/**
 * Generate a v4-style UUID. Uses the native `crypto.randomUUID` when
 * available (Chrome 92+, Safari 15.4+, Firefox 103+), falling back to a
 * cryptographically-strong `crypto.getRandomValues`-based implementation so
 * older browsers don't break analytics entirely.
 */
function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version bits (4) and variant bits (10xx) per RFC 4122.
    const b6 = bytes[6] ?? 0;
    const b8 = bytes[8] ?? 0;
    bytes[6] = (b6 & 0x0f) | 0x40;
    bytes[8] = (b8 & 0x3f) | 0x80;
    const hex = (b: number | undefined) => (b ?? 0).toString(16).padStart(2, "0");
    return (
      hex(bytes[0]) +
      hex(bytes[1]) +
      hex(bytes[2]) +
      hex(bytes[3]) +
      "-" +
      hex(bytes[4]) +
      hex(bytes[5]) +
      "-" +
      hex(bytes[6]) +
      hex(bytes[7]) +
      "-" +
      hex(bytes[8]) +
      hex(bytes[9]) +
      "-" +
      hex(bytes[10]) +
      hex(bytes[11]) +
      hex(bytes[12]) +
      hex(bytes[13]) +
      hex(bytes[14]) +
      hex(bytes[15])
    );
  }
  // Last resort: Math.random-based UUID (not cryptographically strong, but
  // sufficient for analytics deduplication).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

  const id = generateUuid();
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
  } catch {
    // Storage may be unavailable (private mode); nothing to clean up.
  }
  try {
    sessionStorage.removeItem(SESSION_FALLBACK_KEY);
  } catch {
    // Storage may be unavailable (private mode); nothing to clean up.
  }
}