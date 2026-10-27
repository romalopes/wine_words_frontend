import { useState } from "react";

export interface AccountLifecycleControlsProps {
  /** The account being managed. */
  account: {
    deleted_at?: string | null;
    display_name?: string | null;
    email: string | null;
  };
  loading: boolean;
  error: string | null;
  blockingReasons: Array<{ code: string; message: string }>;
  onSoftDelete: () => void;
  onHardDelete: () => void;
  onReactivate: () => void;
}

/**
 * Reusable account lifecycle controls: shows the soft-delete status + CTA row,
 * and renders the confirmation modal (soft-delete / hard-delete / reactivate).
 *
 * The modal's open/close state is owned here so any caller that performs a
 * soft/hard delete flow can drop it in. The actual mutations stay in the
 * parent (they need the entity id + post-mutation navigation).
 *
 * Reusable elsewhere: ProducerDetail (producers) and WineDetail (wines) both
 * have soft-delete lifecycles with the same shape — only the `account` identity
 * and the three handlers differ, so this component is drop-in for those too.
 */
export default function AccountLifecycleControls({
  account,
  loading,
  error,
  blockingReasons,
  onSoftDelete,
  onHardDelete,
  onReactivate,
}: AccountLifecycleControlsProps) {
  const [modal, setModal] = useState(false);
  const displayName = account.display_name || account.email || "Unnamed account";

  return (
    <>
      <section
        className="mt-4"
        style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}
      >
        <h3>Account Lifecycle</h3>
        {account.deleted_at ? (
          <>
            <p className="text-muted">
              Soft-deleted at:{" "}
              {new Date(account.deleted_at).toLocaleString()}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={loading}
              onClick={onReactivate}
            >
              {loading ? "Reactivating…" : "Reactivate user"}
            </button>
          </>
        ) : (
          <>
            <p className="text-muted">Account is active.</p>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={() => setModal(true)}
            >
              Delete account
            </button>
          </>
        )}
        {error && <p className="text-danger mt-2">{error}</p>}
      </section>

      {modal && (
        <div
          className="dialog-backdrop"
          onClick={() => setModal(false)}
          role="presentation"
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Delete account"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog__header">
              <h3 className="dialog__title">Delete Account</h3>
              <button
                type="button"
                className="dialog__close"
                onClick={() => setModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="dialog__subtitle">
              Soft delete deactivates{" "}
              <strong>{displayName}</strong> and schedules permanent removal
              after 30 days. Their published content is preserved.
            </p>
            {error && <p className="dialog__error" role="alert">{error}</p>}
            {blockingReasons.length > 0 && (
              <ul className="dialog__hint">
                {blockingReasons.map((reason) => (
                  <li key={reason.code}>{reason.message}</li>
                ))}
              </ul>
            )}
            <div
              style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModal(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading}
                onClick={() => {
                  setModal(false);
                  onSoftDelete();
                }}
              >
                {loading ? "Working…" : "Soft delete"}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={loading}
                onClick={() => {
                  if (
                    window.confirm(
                      "Permanently delete this account now? This is irreversible and requires the hard-delete feature flag to be enabled.",
                    )
                  ) {
                    setModal(false);
                    onHardDelete();
                  }
                }}
              >
                {loading ? "Working…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
