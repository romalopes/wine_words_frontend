import { useState } from "react";
import { Link } from "react-router-dom";
import styles from "../ApiHealth.module.css";
import type { ApiCheck } from "../../../services/apiHealth/apiHealthConfig";
import type { HealthCheckResult } from "../../../services/apiHealth/healthRunner";
import { getAuthToken } from "../../../services/api";
import { runCheck } from "../../../services/apiHealth/healthRunner";
import ResponseInspector from "./ResponseInspector";

export interface NotificationSendSandboxProps {
  check: ApiCheck;
  result: HealthCheckResult | null;
  running: boolean;
}

// The send-test-notification diagnostic is a SINGLE-WRITE flow: one POST
// delivers a real in-app notification to the signed-in admin and reports the
// unread count the notification bell will display. No form inputs are needed —
// the recipient is always the signed-in admin — so unlike the e-mail sandbox
// this is a one-button flow, but the result handling mirrors it.
export default function NotificationSendSandbox({
  check,
  result,
  running,
}: NotificationSendSandboxProps) {
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<HealthCheckResult | null>(result);

  async function handleSend() {
    setSending(true);
    setSentResult(null);

    const notificationResult = await runCheck(check, { getAuthToken });

    setSentResult(notificationResult);
    setSending(false);
  }

  const isSent = sentResult !== null;
  const payload = sentResult?.payload as
    | {
        notification_id?: number;
        notification_type?: string;
        message?: string;
        unread_count?: number;
      }
    | undefined;
  const unreadCount = payload?.unread_count;

  return (
    <div className={styles.emailSandbox}>
      <h3 className={styles.emailTitle}>Send Test Notification</h3>
      <p className={styles.emailDesc}>
        {check.description ||
          "Delivers a real in-app test notification to the signed-in admin and reports the unread count the notification bell will display."}
      </p>

      {isSent && sentResult?.passed && typeof unreadCount === "number" && (
        <div className={styles.emailTransport}>
          <span className={styles.emailTransportKey}>Unread (bell badge)</span>
          <span className={`${styles.emailTransportValue} ${styles.badge} ${styles.pass}`}>
            {unreadCount}
          </span>
          <span className={styles.emailTransportKey}>In-app feed</span>
          <span className={`${styles.emailTransportValue} ${styles.badge} ${styles.neutral}`}>
            <Link to="/notifications">View notifications</Link>
          </span>
        </div>
      )}

      <div className={styles.emailActions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={sending || running}
          onClick={() => void handleSend()}
        >
          {sending ? "Sending…" : "Send Test Notification"}
        </button>
      </div>

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
              : `Delivered “${payload?.message ?? "test notification"}” in ${sentResult.latencyMs}ms — the bell badge now shows ${unreadCount} unread.`}
          </span>
          <div className={styles.inspectorWrapper}>
            <ResponseInspector check={check} result={sentResult} />
          </div>
        </div>
      )}
    </div>
  );
}
