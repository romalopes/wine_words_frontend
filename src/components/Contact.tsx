import { useRef, useState } from "react"
import { contactApi } from "../services/api"
import { useAuth } from "../contexts/AuthContext"
import { CONTACT_TYPES } from "../constants/contact"
import { errorData, errorMessage, errorText } from "../utils/errors"
import Turnstile from "./Turnstile"
import styles from "./contact.module.css"
import type { ContactMessageInput, ContactType } from "../types/contact"

/**
 * Public Contact page (IDENTITY_209 Phase 3).
 *
 * No sign-in is required. Client-side validation is a usability aid only: the
 * Rails API validates every field again, verifies the Turnstile token
 * server-side and applies rate limits. The success panel appears only after
 * the API confirms the message was stored.
 */

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

const MAX_NAME = 120
const MAX_EMAIL = 254
const MAX_SUBJECT = 180
const MAX_MESSAGE = 10_000

interface FormState {
  name: string
  email: string
  contact_type: ContactType | ""
  subject: string
  message: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const blankForm = (): FormState => ({
  name: "",
  email: "",
  contact_type: "",
  subject: "",
  message: "",
})

function validate(form: FormState, accountEmail = "", accountName = ""): FieldErrors {
  const errors: FieldErrors = {}
  const email = accountEmail || form.email
  const name = accountName || form.name
  if (!name.trim()) errors.name = "Please enter your name."
  if (!email.trim()) errors.email = "Please enter your email address."
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = "Please enter a valid email address."
  }
  if (!form.contact_type) errors.contact_type = "Please choose a category."
  if (!form.subject.trim()) errors.subject = "Please enter a subject."
  if (!form.message.trim()) errors.message = "Please enter your message."
  return errors
}

/** Field-keyed server errors (`details`) mapped onto the form inputs. */
function serverFieldErrors(error: unknown): FieldErrors {
  const details = errorData(error).details
  if (details === null || typeof details !== "object") return {}

  const mapped: FieldErrors = {}
  Object.entries(details as Record<string, unknown>).forEach(([field, messages]) => {
    if (!(field in blankForm())) return
    const text = Array.isArray(messages)
      ? messages.filter((line): line is string => typeof line === "string").join(", ")
      : String(messages)
    if (text) mapped[field as keyof FormState] = text
  })
  return mapped
}

export default function Contact() {
  const { user } = useAuth()
  // Signed-in visitors never retype their identity: we show their account name
  // and email, use them for the submission, and still let the API validate.
  const accountEmail = user?.email?.trim() ?? ""
  const accountName = user
    ? user.display_name?.trim() ||
      user.first_name?.trim() ||
      (user.email ? user.email.slice(0, user.email.indexOf("@")) : "")
    : ""
  const [form, setForm] = useState<FormState>(blankForm)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileReset, setTurnstileReset] = useState(0)
  // Honeypot: untouched by humans, filled by naive bots.
  const honeypotRef = useRef<HTMLInputElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const clientErrors = validate(form, accountEmail, accountName)
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors)
      setError("Please correct the highlighted fields.")
      return
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("Please complete the human verification before sending.")
      return
    }

    setBusy(true)
    setError(null)
    setFieldErrors({})

    const payload: ContactMessageInput = {
      name: accountName || form.name.trim(),
      email: accountEmail || form.email.trim(),
      contact_type: form.contact_type as ContactType,
      subject: form.subject.trim(),
      message: form.message.trim(),
      website: honeypotRef.current?.value ?? "",
    }
    if (turnstileToken) payload.turnstile_token = turnstileToken

    try {
      await contactApi.create(payload)
      setSubmitted(true)
      setForm(blankForm())
      setTurnstileToken(null)
      setTurnstileReset((value) => value + 1)
      if (honeypotRef.current) honeypotRef.current.value = ""
      headingRef.current?.focus()
    } catch (err) {
      setFieldErrors(serverFieldErrors(err))
      setError(
        errorText(err) ??
          errorMessage(err, "We could not send your message. Please try again."),
      )
      // A Turnstile token is single-use; ask for a fresh challenge.
      setTurnstileToken(null)
      setTurnstileReset((value) => value + 1)
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.hero}>
          <h1 ref={headingRef} tabIndex={-1}>
            Contact Wine Words
          </h1>
          <p>Questions, submissions and feedback all land in the same inbox.</p>
        </div>

        <div className={styles.card}>
          <div className={styles.success} role="status">
            <strong>Thank you — your message has been received.</strong>
            <span>We will reply to the email address you provided.</span>
          </div>
          <div className={styles.actions} style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="wine-btn wine-btn--primary"
              onClick={() => {
                setSubmitted(false)
                setError(null)
              }}
            >
              Send another message
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>Contact Wine Words</h1>
        <p>
          Send a general enquiry, propose a wine for review, or report a problem.
          No account is needed.
        </p>
      </div>

      <div className={styles.card}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.row}>
            {accountName ? (
              <div className={`${styles.field} ${fieldErrors.name ? styles.fieldInvalid : ""}`}>
                <label htmlFor="contact-name">Name</label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  value={accountName}
                  readOnly
                  aria-describedby="contact-name-hint"
                />
                <span id="contact-name-hint" className={styles.hint}>
                  Sending as your account name.
                </span>
                {fieldErrors.name && (
                  <span id="contact-name-error" className={styles.fieldError}>
                    {fieldErrors.name}
                  </span>
                )}
              </div>
            ) : (
              <div className={`${styles.field} ${fieldErrors.name ? styles.fieldInvalid : ""}`}>
                <label htmlFor="contact-name">
                  Name<span className={styles.required} aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  maxLength={MAX_NAME}
                  required
                  value={form.name}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "contact-name-error" : undefined}
                  onChange={(event) => update("name", event.target.value)}
                />
                {fieldErrors.name && (
                  <span id="contact-name-error" className={styles.fieldError}>
                    {fieldErrors.name}
                  </span>
                )}
              </div>
            )}

            {accountEmail ? (
              <div className={`${styles.field} ${fieldErrors.email ? styles.fieldInvalid : ""}`}>
                <label htmlFor="contact-email">Email</label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  value={accountEmail}
                  readOnly
                  aria-describedby="contact-email-hint"
                />
                <span id="contact-email-hint" className={styles.hint}>
                  We will reply to your account email.
                </span>
                {fieldErrors.email && (
                  <span id="contact-email-error" className={styles.fieldError}>
                    {fieldErrors.email}
                  </span>
                )}
              </div>
            ) : (
              <div className={`${styles.field} ${fieldErrors.email ? styles.fieldInvalid : ""}`}>
                <label htmlFor="contact-email">
                  Email<span className={styles.required} aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={MAX_EMAIL}
                  required
                  value={form.email}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "contact-email-error" : undefined}
                  onChange={(event) => update("email", event.target.value)}
                />
                {fieldErrors.email && (
                  <span id="contact-email-error" className={styles.fieldError}>
                    {fieldErrors.email}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className={`${styles.field} ${fieldErrors.contact_type ? styles.fieldInvalid : ""}`}>
            <label htmlFor="contact-type">
              Category<span className={styles.required} aria-hidden="true">*</span>
            </label>
            <select
              id="contact-type"
              name="contact_type"
              required
              value={form.contact_type}
              aria-invalid={Boolean(fieldErrors.contact_type)}
              aria-describedby={fieldErrors.contact_type ? "contact-type-error" : undefined}
              onChange={(event) => update("contact_type", event.target.value as ContactType)}
            >
              <option value="">Choose a category</option>
              {CONTACT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {fieldErrors.contact_type && (
              <span id="contact-type-error" className={styles.fieldError}>
                {fieldErrors.contact_type}
              </span>
            )}
          </div>

          <div className={`${styles.field} ${fieldErrors.subject ? styles.fieldInvalid : ""}`}>
            <label htmlFor="contact-subject">
              Subject<span className={styles.required} aria-hidden="true">*</span>
            </label>
            <input
              id="contact-subject"
              name="subject"
              type="text"
              maxLength={MAX_SUBJECT}
              required
              value={form.subject}
              aria-invalid={Boolean(fieldErrors.subject)}
              aria-describedby={fieldErrors.subject ? "contact-subject-error" : undefined}
              onChange={(event) => update("subject", event.target.value)}
            />
            {fieldErrors.subject && (
              <span id="contact-subject-error" className={styles.fieldError}>
                {fieldErrors.subject}
              </span>
            )}
          </div>

          <div className={`${styles.field} ${fieldErrors.message ? styles.fieldInvalid : ""}`}>
            <label htmlFor="contact-message">
              Message<span className={styles.required} aria-hidden="true">*</span>
            </label>
            <textarea
              id="contact-message"
              name="message"
              maxLength={MAX_MESSAGE}
              required
              value={form.message}
              aria-invalid={Boolean(fieldErrors.message)}
              aria-describedby={
                fieldErrors.message
                  ? "contact-message-error contact-message-hint"
                  : "contact-message-hint"
              }
              onChange={(event) => update("message", event.target.value)}
            />
            <span id="contact-message-hint" className={styles.hint}>
              {form.message.length} / {MAX_MESSAGE} characters
            </span>
            {fieldErrors.message && (
              <span id="contact-message-error" className={styles.fieldError}>
                {fieldErrors.message}
              </span>
            )}
          </div>

          {/* Honeypot — hidden from people and assistive technology. */}
          <div className={styles.honeypot} aria-hidden="true">
            <label htmlFor="contact-website">Website</label>
            <input
              id="contact-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              ref={honeypotRef}
            />
          </div>

          <div className={styles.turnstile}>
            <Turnstile
              siteKey={TURNSTILE_SITE_KEY}
              action="contact"
              resetKey={turnstileReset}
              onToken={setTurnstileToken}
            />
          </div>

          <p className={styles.privacy}>
            We use the details you provide only to respond to this enquiry.
            Messages are stored securely and visible to authorised Wine Words
            Editors and Admins. See our privacy policy for how to request removal.
          </p>

          <div className={styles.actions}>
            <button type="submit" className="wine-btn wine-btn--primary" disabled={busy}>
              {busy ? "Sending…" : "Send message"}
            </button>
            <span className={styles.hint}>Fields marked * are required.</span>
          </div>
        </form>
      </div>
    </div>
  )
}

