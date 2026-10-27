import { useCallback, useEffect, useState, type FormEvent } from "react";
import { usersApi } from "../services/api";
import type { AccountInvitation, UserDetail } from "../types/user";
import { errorMessage, errorText } from "../utils/errors";

interface Props {
  user: UserDetail;
  onUserUpdated: (user: UserDetail) => void;
}

export default function InvitationManagement({ user, onUserUpdated }: Props) {
  const [email, setEmail] = useState(user.email ?? "");
  const [history, setHistory] = useState<AccountInvitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistory(await usersApi.invitations.list(user.id));
  }, [user.id]);

  useEffect(() => {
    setEmail(user.email ?? "");
    loadHistory().catch((err) => setError(errorMessage(err, "Failed to load invitation history")));
  }, [loadHistory, user.email]);

  async function saveEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      const updated = await usersApi.updateInvitationEmail(user.id, email.trim());
      onUserUpdated(updated);
      setNotice("Invitation email updated.");
    } catch (err) {
      setError(errorText(err) ?? errorMessage(err, "Failed to update email"));
    } finally { setBusy(false); }
  }

  async function act(action: "send" | "resend" | "revoke") {
    setBusy(true); setError(null); setNotice(null);
    try {
      await usersApi.invitations[action](user.id);
      await loadHistory();
      setNotice(action === "revoke" ? "Invitation revoked." : "Invitation email submitted for delivery.");
    } catch (err) {
      setError(errorText(err) ?? errorMessage(err, "Invitation action failed"));
      await loadHistory().catch(() => undefined);
    } finally { setBusy(false); }
  }

  const usable = history.find((invitation) => invitation.usable);
  return (
    <section className="managed-account-panel">
      <h3>Account invitation</h3>
      <p>Status: <strong>{user.account_status}</strong></p>
      {user.account_status === "unclaimed" && (
        <>
          <form className="managed-account-form managed-account-form--inline" onSubmit={saveEmail}>
            <label>Invitation email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <button className="admin-pagination__btn" disabled={busy} type="submit">Save email</button>
          </form>
          <div className="managed-account-actions">
            <button className="auth-form__submit" disabled={busy || !email.trim()} onClick={() => act(history.length ? "resend" : "send")} type="button">
              {history.length ? "Resend invitation" : "Send invitation"}
            </button>
            {usable && <button className="admin-pagination__btn" disabled={busy} onClick={() => act("revoke")} type="button">Revoke invitation</button>}
          </div>
        </>
      )}
      {notice && <p className="auth-card__status" role="status">{notice}</p>}
      {error && <p className="admin-user-error" role="alert">{error}</p>}
      <h4>History</h4>
      {history.length === 0 ? <p>No invitations have been issued.</p> : (
        <ul className="invitation-history">
          {history.map((invitation) => (
            <li key={invitation.id}>
              <strong>{invitation.status}</strong> · {invitation.email} · expires {new Date(invitation.expires_at).toLocaleString()}
              {invitation.delivery_status && <> · delivery {invitation.delivery_status}</>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}