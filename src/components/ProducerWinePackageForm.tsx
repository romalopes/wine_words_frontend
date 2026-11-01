import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { accountApi, winePackagesApi } from "../services/api";
import type { ProducerSummary } from "../types/producer";
import { errorMessage } from "../utils/errors";
import styles from "./winePackages.module.css";

export default function ProducerWinePackageForm() {
  const navigate = useNavigate();
  const [producers, setProducers] = useState<ProducerSummary[]>([]);
  const [producerId, setProducerId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [shippingNotes, setShippingNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountApi
      .myProducers()
      .then((rows) => {
        const eligible = rows.filter(
          (row) =>
            row.can_edit &&
            (row.membership_type === "owner" ||
              row.membership_type === "manager"),
        );
        setProducers(eligible);
        if (eligible.length === 1 && eligible[0])
          setProducerId(String(eligible[0].id));
      })
      .catch((err) =>
        setError(errorMessage(err, "Failed to load your producers")),
      )
      .finally(() => setLoading(false));
  }, []);

  function packagePayload() {
    return {
      producer_id: Number(producerId),
      expected_at: expectedAt || null,
      producer_reference: reference || null,
      producer_notes: notes || null,
      shipping_notes: shippingNotes || null,
    };
  }

  async function createPackage(submitImmediately: boolean) {
    if (!producerId) {
      setError("Select the producer this request belongs to.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await winePackagesApi.create(packagePayload());
      if (submitImmediately) {
        try {
          await winePackagesApi.submit(created.id);
        } catch {
          // Creation already succeeded. Open the draft instead of leaving the
          // user on this form where retrying would create a duplicate package.
          navigate(`/wine-packages/${created.id}`);
          return;
        }
      }
      navigate(`/wine-packages/${created.id}`);
    } catch (err) {
      setError(errorMessage(err, "Failed to create the package request"));
      setSaving(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void createPackage(false);
  }

  if (loading)
    return <p className="wine-management__loading">Loading your producers…</p>;

  return (
    <div className="wine-app">
      <Link to="/wine-packages" className="wine-detail__back">
        &larr; Back to Wine Packages
      </Link>
      <p className="wine-kicker">Producer request</p>
      <h1>New Package Request</h1>
      <p className={styles.cellMuted}>
        Save a draft to add wines on the next screen, or create and submit the
        package now without wine lines.
      </p>
      {error && (
        <p className="wine-management__error" role="alert">
          {error}
        </p>
      )}
      {producers.length === 0 ? (
        <div className="wine-management__empty">
          <p>You do not manage an eligible producer account.</p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className={styles.filters}>
            <div className={styles.filterField}>
              <label htmlFor="request-producer">Producer</label>
              <select
                id="request-producer"
                required
                value={producerId}
                onChange={(event) => setProducerId(event.target.value)}
                disabled={producers.length === 1}
              >
                <option value="">Select producer…</option>
                {producers.map((producer) => (
                  <option key={producer.id} value={producer.id}>
                    {producer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="request-expected">Expected dispatch date</label>
              <input
                id="request-expected"
                type="date"
                value={expectedAt}
                onChange={(event) => setExpectedAt(event.target.value)}
              />
            </div>
            <div className={styles.filterField}>
              <label htmlFor="request-reference">Your reference</label>
              <input
                id="request-reference"
                type="text"
                maxLength={128}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </div>
          </div>
          <div className={styles.filters}>
            <div className={styles.filterField} style={{ flex: "1 1 22rem" }}>
              <label htmlFor="request-notes">Request notes</label>
              <textarea
                id="request-notes"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <div className={styles.filterField} style={{ flex: "1 1 22rem" }}>
              <label htmlFor="request-shipping-notes">Shipping notes</label>
              <textarea
                id="request-shipping-notes"
                rows={4}
                value={shippingNotes}
                onChange={(event) => setShippingNotes(event.target.value)}
              />
            </div>
          </div>
          <div className={styles.inlineFormActions}>
            <button
              type="submit"
              className="wine-btn wine-btn--primary wine-btn--lg"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Draft and Add Wines"}
            </button>
            <button
              type="button"
              className="wine-btn wine-btn--secondary wine-btn--lg"
              disabled={saving}
              onClick={() => void createPackage(true)}
            >
              {saving ? "Saving…" : "Create and Submit"}
            </button>
            <Link to="/wine-packages" className="wine-btn wine-btn--secondary">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
