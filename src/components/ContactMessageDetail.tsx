import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { contactApi } from "../services/api"
import { useAuth } from "../contexts/AuthContext"
import { canManageContactMessages } from "../constants/roles"
import { contactTypeLabel } from "../constants/contact"
import DetailHero from "./DetailHero"
import { errorMessage } from "../utils/errors"
import { formatDate } from "../utils/dates"
import styles from "./contact.module.css"
import type { ContactMessage, ContactMessageStatus } from "../types/contact"

/**
 * One contact message (IDENTITY_209 Phase 4).
 *
 * The body is rendered as plain text by React — it is never interpreted as
 * HTML. Status changes are confirmed by the API before the UI updates, and
 * every transition is idempotent server-side.
 */
export default function ContactMessageDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const allowed = canManageContactMessages(user)

  const [message, setMessage] = useState<ContactMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setMessage(await contactApi.get(id))
    } catch (err) {
      setError(errorMessage(err, "Failed to load this message."))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (allowed) void load()
    else setLoading(false)
  }, [allowed, load])

  async function changeStatus(status: ContactMessageStatus) {
    if (!message || busy) return
    setBusy(true)
    setActionError(null)
    try {
      setMessage(await contactApi.updateStatus(message.id, status))
    } catch (err) {
      setActionError(errorMessage(err, "Could not update this message. Please try again."))
    } finally {
      setBusy(false)
    }
  }

  if (!allowed) {
    return (
      <div className="wine-app">
        <DetailHero
          title="Contact message"
          intro="This page is restricted to Editor and Admin accounts."
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="wine-app">
        <p className={styles.muted}>Loading message…</p>
      </div>
    )
  }

  if (error || !message) {
    return (
      <div className="wine-app">
        <p className={styles.error} role="alert">
          {error ?? "Message not found."}
        </p>
        <div className={styles.actions}>
          <button type="button" className="wine-btn wine-btn--primary" onClick={load}>
            Retry
          </button>
          <Link to="/settings/contact-messages" className="wine-btn wine-btn--secondary">
            Back to inbox
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="wine-app">
      <DetailHero
        kicker={`Contact message #${message.id}`}
        title={message.subject}
        intro={`From ${message.name} — ${contactTypeLabel(message.contact_type)}`}
      />

      <div className={styles.card}>
        {actionError && (
          <p className={styles.error} role="alert">
            {actionError}
          </p>
        )}

        <dl className={styles.detailMeta}>
          <div>
            <dt>From</dt>
            <dd>
              {message.name}
              <br />
              <a href={`mailto:${message.email}`}>{message.email}</a>
            </dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{contactTypeLabel(message.contact_type)}</dd>
          </div>
          <div>
            <dt>Received</dt>
            <dd>{formatDate(message.created_at)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span
                className={`${styles.statusBadge} ${styles[`status-${message.status}`]}`}
              >
                {message.status}
              </span>
            </dd>
          </div>
        </dl>

        <p className={styles.messageBody}>{message.message}</p>

        <div className={styles.actions} style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="wine-btn wine-btn--primary"
            disabled={busy || message.status === "read"}
            onClick={() => changeStatus("read")}
          >
            Mark as read
          </button>
          <button
            type="button"
            className="wine-btn wine-btn--secondary"
            disabled={busy || message.status === "unread"}
            onClick={() => changeStatus("unread")}
          >
            Mark as unread
          </button>
          <button
            type="button"
            className="wine-btn wine-btn--danger"
            disabled={busy || message.status === "archived"}
            onClick={() => changeStatus("archived")}
          >
            Archive
          </button>
          <Link to="/settings/contact-messages" className="wine-btn wine-btn--ghost">
            Back to inbox
          </Link>
        </div>
      </div>
    </div>
  )
}
