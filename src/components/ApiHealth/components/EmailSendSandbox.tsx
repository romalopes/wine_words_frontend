import { useState, type FormEvent } from "react";
import styles from "../ApiHealth.module.css";
import type { ApiCheck } from "../../../services/apiHealth/apiHealthConfig";
import type { HealthCheckResult } from "../../../services/apiHealth/healthRunner";
import { getAuthToken } from "../../../services/api";
import { runCheck } from "../../../services/apiHealth/healthRunner";
import ResponseInspector from "./ResponseInspector";

export interface EmailSendSandboxProps {
  check: ApiCheck;
  result: HealthCheckResult | null;
  running: boolean;
  transportResult?: HealthCheckResult | null;
}

// The send-test-email diagnostic is a SINGLE-WRITE flow: one POST carries the
// recipient + body, the API delivers it and reports the configured/effective
// transports. There is no create/delete pair and nothing is persisted, so this
// sandbox owns its own input form and result (unlike the WRITE_SANDBOX, which
// is a create+delete pair with no user input).
export default function EmailSendSandbox({
  check,
  result,
  running,
  transportResult,
}: EmailSendSandboxProps) {
  const [to, setTo] = useState("");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<HealthCheckResult | null>(result);

  // Extract transports from the email-transport check result
  const transportPayload = transportResult?.payload as
    | { configured_transport?: string; effective_transport?: string }
    | undefined;
  const configuredTransportFromApi = transportPayload?.configured_transport ?? "—";
  const effectiveTransportFromApi = transportPayload?.effective_transport ?? "—";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setSentResult(null);

    const body = JSON.stringify({
      to: to.trim(),
      content: content.trim(),
      subject: subject.trim() || undefined,
    });

    // E-mail is a multi-step hand-off: the React page builds the request and
    // the health runner (and therefore the existing auth token + latency
    // instrumentation) handles it. A plain `POST`/`GET` config item in
    // apiHealthConfig has a fixed payload, so this is the dedicated path.
    const emailResult = await runCheck(check, {
      getAuthToken,
      body,
    });

    setSentResult(emailResult);
    setSending(false);
  }

  const isSent = sentResult !== null;
  const payload = sentResult?.payload as
    | {
        configured_transport?: string;
        effective_transport?: string;
        recipients?: string[];
      }
    | undefined;
  const configuredTransport = payload?.configured_transport ?? "—";
  const effectiveTransport = payload?.effective_transport ?? "—";

  return (
    <div className={styles.emailSandbox}>
      <h3 className={styles.emailTitle}>Send Test E-mail</h3>
      <p className={styles.emailDesc}>
        {check.description ||
          "Sends a one-off test e-mail whose subject and body embed the effectively used MAIL_TRANSPORT."}
      </p>

      {/* Show current MAIL_TRANSPORT from /health/email/transport endpoint */}
      <div className={styles.emailTransport}>
        <span className={styles.emailTransportKey}>Configured MAIL_TRANSPORT</span>
        <span className={`${styles.emailTransportValue} ${styles.badge} ${styles.neutral}`}>
          {configuredTransportFromApi}
        </span>
        <span className={styles.emailTransportKey}>Effective transport</span>
        <span className={`${styles.emailTransportValue} ${styles.badge} ${styles.neutral}`}>
          {effectiveTransportFromApi}
        </span>
      </div>

      {/* Show transports when we have a successful result */}
      {isSent && sentResult?.passed && (
        <div className={styles.emailTransport}>
          <span className={styles.emailTransportKey}>Configured MAIL_TRANSPORT</span>
          <span className={`${styles.emailTransportValue} ${styles.badge} ${styles.neutral}`}>
            {configuredTransport}
          </span>
          <span className={styles.emailTransportKey}>Effective transport</span>
          <span className={`${styles.emailTransportValue} ${styles.badge} ${styles.neutral}`}>
            {effectiveTransport}
          </span>
        </div>
      )}

      <form className={styles.emailForm} onSubmit={handleSubmit}>
        <label className={styles.emailField}>
          <span className={styles.emailLabel}>TO</span>
          <input
            className={styles.emailInput}
            type="email"
            value={to}
            placeholder="ops@example.com"
            onChange={(event) => setTo(event.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className={styles.emailField}>
          <span className={styles.emailLabel}>Content</span>
          <textarea
            className={styles.emailTextarea}
            value={content}
            placeholder="Body of the test email…"
            rows={4}
            onChange={(event) => setContent(event.target.value)}
            required
          />
        </label>
        <label className={styles.emailField}>
          <span className={styles.emailLabel}>
            Subject <span className={styles.emailHint}>(optional)</span>
          </span>
          <input
            className={styles.emailInput}
            value={subject}
            placeholder="Review reminder"
            onChange={(event) => setSubject(event.target.value)}
          />
        </label>
        <div className={styles.emailActions}>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={sending || running}
          >
            {sending ? "Sending…" : "Send Test E-mail"}
          </button>
        </div>
      </form>

      {isSent && sentResult && (
        <div className={styles.emailResult}>
          <span
            className={`${styles.badge} ${
              sentResult.passed ? styles.pass : styles.fail
            }`}
          >
            {sentResult.passed ? "PASS" : "FAIL"}
          </span>
          <span className={styles.statusText}>
            {sentResult.error
              ? sentResult.error
              : `Delivered to ${(sentResult.payload as { recipients?: string[] } | undefined)?.recipients?.[0] ?? "the supplied recipient"} in ${sentResult.latencyMs}ms`}
          </span>
          <div className={styles.inspectorWrapper}>
            <ResponseInspector check={check} result={sentResult} />
          </div>
        </div>
      )}
    </div>
  );
}
