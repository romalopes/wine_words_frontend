import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { shipmentTrackingsApi } from "../services/api";
import type { ShipmentTrackingWritePayload } from "../types/api";
import type { ShipmentTracking } from "../types/shipmentTracking";
import { formatDate, formatDateTime } from "../utils/dates";
import { errorMessage, errorStatus } from "../utils/errors";
import styles from "./winePackages.module.css";

/** Editable tracking fields. Dates are truncated to the `date` input format. */
interface TrackingFormState {
  carrier: string
  number: string
  status: string
  url: string
  estimated_delivery_at: string
}

interface ShipmentTrackingPanelProps {
  packageId: string | number
  canManage: boolean
  canRefresh?: boolean
  producerMode?: boolean
  /** Lets the package page refresh itself after a tracking change. */
  onChanged?: () => void
}

// Shipment tracking for a package: carrier, consignment number, the current
// status and the carrier's event history.
//
// Tracking is optional and carrier-independent: with no carrier credentials the
// row still works by hand, and "Refresh" simply reports that no live data was
// fetched. A carrier "Delivered" never marks the package as arrived — a
// reviewer always confirms that on the package itself.
function ShipmentTrackingPanel({
  packageId,
  canManage,
  canRefresh = canManage,
  producerMode = false,
  onChanged,
}: ShipmentTrackingPanelProps) {
  const [tracking, setTracking] = useState<ShipmentTracking | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [form, setForm] = useState<TrackingFormState>({
    carrier: "",
    number: "",
    status: "",
    url: "",
    estimated_delivery_at: "",
  });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await shipmentTrackingsApi.show(packageId);
      setTracking(data);
      setForm({
        carrier: data.carrier || "",
        number: data.number || "",
        status: data.status || "",
        url: data.url || "",
        estimated_delivery_at: data.estimated_delivery_at
          ? data.estimated_delivery_at.slice(0, 10)
          : "",
      });
    } catch (err) {
      // 404 simply means no tracking has been recorded yet.
      if (errorStatus(err) !== 404) {
        setError(errorMessage(err, "Failed to load tracking"));
      }
    } finally {
      setLoaded(true);
    }
  }, [packageId]);

  useEffect(() => {
    load();
  }, [load]);

  function updateField<K extends keyof TrackingFormState>(
    key: K,
    value: TrackingFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload: ShipmentTrackingWritePayload = {
        carrier: form.carrier,
        number: form.number,
        ...(producerMode ? {} : { status: form.status }),
        url: form.url || null,
        estimated_delivery_at: form.estimated_delivery_at || null,
      };
      const saved = await shipmentTrackingsApi.update(packageId, payload);
      setTracking(saved);
      setMessage("Tracking saved.");
      if (onChanged) onChanged();
    } catch (err) {
      setError(errorMessage(err, "Failed to save tracking"));
    } finally {
      setSaving(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    setMessage(null);

    try {
      const refreshed = await shipmentTrackingsApi.refresh(packageId);
      setTracking(refreshed);
      setForm((current) => ({
        ...current,
        status: refreshed.status || current.status,
        url: refreshed.url || current.url,
      }));
      setMessage(
        refreshed.provider_configured
          ? "Tracking refreshed from the carrier."
          : "No carrier credentials configured — the saved tracking was left unchanged.",
      );
      if (onChanged) onChanged();
    } catch (err) {
      setError(errorMessage(err, "Failed to refresh tracking"));
    } finally {
      setRefreshing(false);
    }
  }

  if (!loaded) {
    return (
      <div className={styles.section}>
        <h2>Shipment tracking</h2>
        <p className={styles.cellMuted}>Loading tracking…</p>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <h2>
        Shipment tracking{" "}
        <button
          type="button"
          className="wine-btn wine-btn--secondary wine-btn--sm"
          aria-expanded={!collapsed}
          aria-controls="wp-tracking-list"
          aria-label={
            collapsed ? "Show shipment tracking" : "Hide shipment tracking"
          }
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </h2>

      {!collapsed && (
        <div id="wp-tracking-list">
          {error && <p className="wine-management__error">{error}</p>}
          {message && <p className={styles.cellMuted}>{message}</p>}

          {tracking ? (
            <p className={styles.meta}>
              <span>
                <strong>{tracking.carrier || "Unknown carrier"}</strong>
                {tracking.number ? ` · ${tracking.number}` : ""}
              </span>
              <span>Status: {tracking.status || "—"}</span>
              {tracking.estimated_delivery_at && (
                <span>ETA {formatDate(tracking.estimated_delivery_at)}</span>
              )}
              {tracking.delivered_at && (
                <span className={styles.overdue}>
                  Carrier reports delivered{" "}
                  {formatDateTime(tracking.delivered_at)} — confirm arrival
                </span>
              )}
              {tracking.url && (
                <a href={tracking.url} target="_blank" rel="noreferrer">
                  Track on carrier site
                </a>
              )}
              {!tracking.provider_configured && (
                <span className={styles.cellMuted}>
                  No live carrier credentials — status is maintained by hand
                </span>
              )}
            </p>
          ) : (
            <p className={styles.cellMuted}>
              No tracking recorded for this package yet.
            </p>
          )}

          {Array.isArray(tracking?.events) && tracking.events.length > 0 && (
            <ul className={styles.cellMuted}>
              {tracking.events.map((event) => (
                <li key={event.id}>
                  {formatDateTime(event.event_at) || "—"} · {event.status}
                  {event.location ? ` · ${event.location}` : ""}
                </li>
              ))}
            </ul>
          )}

          {canManage && (
            <form className={styles.inlineForm} onSubmit={handleSave}>
              {!producerMode && <div className={styles.filterField}>
                <label htmlFor="tracking-carrier">Carrier</label>
                <input
                  id="tracking-carrier"
                  type="text"
                  placeholder="Australia Post"
                  value={form.carrier}
                  onChange={(event) =>
                    updateField("carrier", event.target.value)
                  }
                />
              </div>}
              <div className={styles.filterField}>
                <label htmlFor="tracking-number">Consignment number</label>
                <input
                  id="tracking-number"
                  type="text"
                  value={form.number}
                  onChange={(event) =>
                    updateField("number", event.target.value)
                  }
                />
              </div>
              <div className={styles.filterField}>
                <label htmlFor="tracking-status">Status</label>
                <input
                  id="tracking-status"
                  type="text"
                  placeholder="In transit"
                  value={form.status}
                  onChange={(event) =>
                    updateField("status", event.target.value)
                  }
                />
              </div>
              <div className={styles.filterField}>
                <label htmlFor="tracking-eta">Estimated delivery</label>
                <input
                  id="tracking-eta"
                  type="date"
                  value={form.estimated_delivery_at}
                  onChange={(event) =>
                    updateField("estimated_delivery_at", event.target.value)
                  }
                />
              </div>
              <div className={styles.inlineFormActions}>
                {canRefresh && <button
                  type="submit"
                  className="wine-btn wine-btn--primary wine-btn--lg"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save tracking"}
                </button>}
                <button
                  type="button"
                  className="wine-btn wine-btn--secondary"
                  onClick={handleRefresh}
                  disabled={refreshing || !tracking?.number}
                >
                  {refreshing ? "Refreshing…" : "Refresh from carrier"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default ShipmentTrackingPanel;
