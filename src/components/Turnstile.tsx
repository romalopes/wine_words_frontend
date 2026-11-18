import { useEffect, useRef } from "react"

/**
 * Cloudflare Turnstile widget (IDENTITY_209 Phase 3).
 *
 * The browser only ever sees the PUBLIC site key. It solves the challenge,
 * hands the token to the caller, and the Rails API verifies that token
 * server-side — a client-side success callback is never treated as proof.
 *
 * When no site key is configured (development/test) the widget renders a
 * short note and emits a null token; the API decides whether verification is
 * required (it fails closed in production).
 */

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId?: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_ID = "cf-turnstile-script"
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

// Loaded once per browser session and shared by every widget instance.
let scriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("Turnstile failed to load")), {
        once: true,
      })
      return
    }

    const script = document.createElement("script")
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Turnstile failed to load"))
    document.head.appendChild(script)
  })

  return scriptPromise
}

export interface TurnstileProps {
  /** Public site key from VITE_TURNSTILE_SITE_KEY. Never a secret. */
  siteKey?: string | undefined
  /** Optional action name checked by the API when TURNSTILE_EXPECTED_ACTION is set. */
  action?: string
  /** Receives the token on success and null on expiry/error. */
  onToken: (token: string | null) => void
  /** Change this value to force a fresh challenge (e.g. after a failed submit). */
  resetKey?: number
}

export default function Turnstile({ siteKey, action = "contact", onToken, resetKey = 0 }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Keep the latest callback out of the effect's dependency list, otherwise
  // every parent render would tear the widget down and solve it again.
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    if (!siteKey) {
      onTokenRef.current(null)
      return
    }

    let cancelled = false
    let widgetId: string | null = null

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        })
      })
      .catch(() => {
        // The widget could not load (offline, blocked). Emit no token: the API
        // rejects the submission when verification is required.
        if (!cancelled) onTokenRef.current(null)
      })

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId)
        } catch {
          // The widget may already be gone after a navigation.
        }
      }
    }
  }, [siteKey, action, resetKey])

  if (!siteKey) {
    return (
      <p className="contact-form__turnstile-note" role="note">
        Human verification is not configured in this environment.
      </p>
    )
  }

  return <div className="contact-form__turnstile" ref={containerRef} />
}
