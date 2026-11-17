import { useEffect, useState } from "react"
import { tradeApi } from "../services/api"
import type { TradeMessage } from "../types/trade"
import styles from "./trade.module.css"

type ApiMode = "staff" | "submitter"

interface TradeMessagesProps {
  packageId: number
  guestToken?: string
  /** Which API endpoints to use: "staff" for admin/editor (default), "submitter" for submitter/guest view. */
  mode?: ApiMode
}

export default function TradeMessages({
  packageId,
  guestToken,
  mode = "staff",
}: TradeMessagesProps) {
  const [messages, setMessages] = useState<TradeMessage[]>([])
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      if (mode === "staff") {
        setMessages(await tradeApi.getStaffMessages(packageId))
      } else {
        setMessages(await tradeApi.listMessages(packageId, guestToken))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load messages")
    }
  }

  useEffect(() => {
    load()
  }, [packageId, guestToken, mode])

  async function send() {
    if (!body.trim()) return
    setBusy(true)
    setError(null)
    try {
      const message = mode === "staff"
        ? await tradeApi.sendStaffMessage(packageId, body.trim())
        : await tradeApi.sendMessage(packageId, body.trim(), guestToken)
      setMessages((current) => [...current, message])
      setBody("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.card}>
      <h2>Conversation</h2>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.timeline}>
        {messages.length === 0 ? (
          <p className={styles.muted}>No messages yet.</p>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={styles.message}>
              <div className={styles.messageMeta}>
                <span className={styles.messageSender}>
                  {message.sender_name}
                </span>
                <span className={styles.messageSenderType}>
                  {message.sender_type}
                </span>
                {new Date(message.created_at).toLocaleString()}
              </div>
              <div>{message.body}</div>
            </article>
          ))
        )}
      </div>
      <div className={styles.field} style={{ marginTop: "1rem" }}>
        <label htmlFor="trade-message">Send a message</label>
        <textarea
          id="trade-message"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Ask a question or add information…"
          disabled={busy}
        />
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className="wine-btn wine-btn--primary"
          disabled={busy || !body.trim()}
          onClick={send}
        >
          {busy ? "Sending…" : "Send message"}
        </button>
      </div>
      <p className={styles.muted}>
        The submitter is notified by email and in their in-app notifications.
      </p>
    </section>
  )
}