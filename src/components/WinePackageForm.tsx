import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { usersApi, winePackagesApi } from "../services/api";
import type { WinePackageWritePayload } from "../types/api";
import type { AdminUser } from "../types/user";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin } from "../constants/roles";
import ProducerSearch from "./ProducerSearch";
import { sourceLabel } from "../constants/winePackages";
import { todayInputValue } from "../utils/dates";
import ImageManager from "./ImageManager";
import { imagesApi } from "../services/api";
import { errorMessage } from "../utils/errors";
import { responseItems } from "../types/common";

import styles from "./winePackages.module.css";
import ProducerWinePackageForm from "./ProducerWinePackageForm";

/**
 * One entry mode: the copy shown above the form plus the status/source the
 * backend should start the package with.
 */
interface PackageModeConfig {
  title: string
  help: string
  status: string
  source: string
}

// The four ways a package enters the workflow. `status` is the entry point the
// backend expects; the rest is presentation copy.
const MODES = {
  arrived: {
    title: "Record Received Package",
    help: "Wines that have physically arrived. The review deadline defaults to one month from today.",
    status: "arrived",
    source: "unexpected",
  },
  announced: {
    title: "Add Expected Package",
    help: "Wines a producer says are on their way. Add tracking later from the package page.",
    status: "announced",
    source: "manual",
  },
  requested: {
    title: "Add Producer Request",
    help: "A producer has asked Wine Words to review these wines.",
    status: "requested",
    source: "producer_request",
  },
  draft: {
    title: "New Wine Package",
    help: "Start with the basics and pick the workflow up later.",
    status: "draft",
    source: "manual",
  },
} satisfies Record<string, PackageModeConfig>;

type PackageMode = keyof typeof MODES;

function isPackageMode(value: string | null): value is PackageMode {
  return value !== null && value in MODES;
}

/** The editable package fields, all held as strings for the controlled inputs. */
interface PackageFormState {
  producer_id: string
  producer_name: string
  source: string
  expected_at: string
  arrived_at: string
  review_deadline: string
  notes: string
}

// Create / edit a wine package.
//
// On create the entry mode decides the starting status — "arrived" both starts
// the review clock and schedules the deadline reminders on the backend. On edit
// the status and source are intentionally not editable: they belong to the
// workflow actions on the detail page.
function WinePackageForm() {
  const { id } = useParams<{ id: string }>();
  // Written as a comparison rather than `Boolean(id)` so TS keeps the
  // `id !== undefined` narrowing wherever `editing` is checked.
  const editing = id !== undefined;
  const navigate = useNavigate();
  const { user } = useAuth();
  // users#search is admin-only, so the reviewer field is only offered to admins.
  const canPickReviewer = isAdmin(user);
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const producerRequestMode = !editing && requestedMode === "request";
  // ?mode= only wins when it names a real mode; anything else falls back to draft.
  const initialMode: PackageMode = isPackageMode(requestedMode)
    ? requestedMode
    : "draft";

  const [mode, setMode] = useState<PackageMode>(initialMode);
  const [form, setForm] = useState<PackageFormState>({
    producer_id: "",
    producer_name: "",
    source: isPackageMode(requestedMode)
      ? MODES[requestedMode].source
      : "manual",
    expected_at: "",
    arrived_at: initialMode === "arrived" ? todayInputValue() : "",
    review_deadline: "",
    notes: "",
  });
  const [reviewerId, setReviewerId] = useState("");
  const [reviewerResults, setReviewerResults] = useState<AdminUser[]>([]);
  // Existing server-side images (editing mode) and locally staged files that
  // upload right after creation (create mode).
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [existingImageIds, setExistingImageIds] = useState<Array<number | null>>(
    [],
  );
  const [stagedImages, setStagedImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The id is the effect's input: bail out in create mode, and capture it as
    // a const so the narrowing holds inside `load` (a closure over a possibly
    // reassigned parameter binding loses it).
    const packageId = id;
    if (packageId === undefined) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const pkg = await winePackagesApi.show(packageId);
        if (cancelled) return;
        // reviewer_id is a number in the payload but the input is text-backed.
        setReviewerId(pkg.reviewer_id ? String(pkg.reviewer_id) : "");
        setExistingImages(Array.isArray(pkg.images) ? pkg.images : []);
        setExistingImageIds(Array.isArray(pkg.image_ids) ? pkg.image_ids : []);
        setForm({
          producer_id: String(pkg.producer_id ?? ""),
          producer_name: pkg.producer_name || "",
          source: pkg.source || "manual",
          expected_at: pkg.expected_at || "",
          // Dates come back as full timestamps but the input wants a bare day.
          arrived_at: pkg.arrived_at ? pkg.arrived_at.slice(0, 10) : "",
          review_deadline: pkg.review_deadline || "",
          notes: pkg.notes || "",
        });
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, "Failed to load wine package"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [editing, id]);

  function updateField<K extends keyof PackageFormState>(
    key: K,
    value: PackageFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // Switching entry mode also switches the default source, mirroring the
  // backend's notion of where the package came from.
  function chooseMode(next: PackageMode) {
    setMode(next);
    updateField("source", MODES[next].source);
  }

  function handleProducerChange(id: string | number, name: string) {
    setForm((current) => ({
      ...current,
      producer_id: id ? String(id) : "",
      producer_name: name || "",
    }));
  }

  async function searchReviewers() {
    try {
      // A `page` is sent, so the API answers with the pagination envelope.
      // `responseItems` unwraps that (and a bare array) so the picker shows rows
      // either way — `Array.isArray(data) ? data : []` would always be empty.
      const data = await usersApi.search("");
      setReviewerResults(responseItems(data));
    } catch (err) {
      setError(errorMessage(err, "Could not search users"));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: WinePackageWritePayload = {
        producer_id: Number(form.producer_id),
        notes: form.notes,
      };

      if (editing) {
        payload.expected_at = form.expected_at || null;
        payload.arrived_at = form.arrived_at || null;
        payload.review_deadline = form.review_deadline || null;
        if (canPickReviewer && reviewerId) payload.reviewer_id = Number(reviewerId);
        await winePackagesApi.update(id, payload);
        navigate(`/wine-packages/${id}`);
        return;
      }

      payload.source = form.source;
      payload.status = MODES[mode].status;
      if (form.expected_at) payload.expected_at = form.expected_at;
      if (mode === "arrived") {
        payload.arrived_at = form.arrived_at || todayInputValue();
        if (form.review_deadline) payload.review_deadline = form.review_deadline;
      }

      const created = await winePackagesApi.create(payload);
      // Upload any images staged before creation, then land on the detail
      // page. A failed image upload does not lose the package — the user can
      // retry from the detail page.
      if (stagedImages.length > 0) {
        try {
          await imagesApi.upload("wine_package", created.id, stagedImages);
          setStagedImages([]);
        } catch (imgErr) {
          setError(
            errorMessage(
              imgErr,
              "Package created, but some images could not be uploaded. Retry from the package page.",
            ),
          );
          setSaving(false);
          return;
        }
      }
      navigate(`/wine-packages/${created.id}`);
    } catch (err) {
      setError(errorMessage(err, "Failed to save wine package"));
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="wine-app">
        <p className="wine-management__loading">Loading wine package…</p>
      </div>
    );
  }

  if (producerRequestMode) return <ProducerWinePackageForm />;

  const modeConfig = MODES[mode];

  return (
    <div className="wine-app">
      <Link
        to={editing ? `/wine-packages/${id}` : "/wine-packages"}
        className="wine-detail__back"
      >
        &larr; Back to Wine Packages
      </Link>

      <div className={styles.header}>
        <div>
          <p className="wine-kicker">Cellar</p>
          <h1>{editing ? `Edit Package #${id}` : modeConfig.title}</h1>
          <p className={styles.cellMuted}>{modeConfig.help}</p>
        </div>
      </div>

      {error && <p className="wine-management__error">{error}</p>}

      <form onSubmit={handleSubmit}>
        {!editing && (
          <fieldset className={styles.filters}>
            <legend className="visually-hidden">What do these wines represent?</legend>
            {Object.entries(MODES).map(([key, config]) => (
              <label key={key} className={styles.checkboxField}>
                <input
                  type="radio"
                  name="package-entry-mode"
                  value={key}
                  checked={mode === key}
                  onChange={() => chooseMode(key as PackageMode)}
                />
                {config.title}
              </label>
            ))}
          </fieldset>
        )}

        <div className={styles.filters}>
          <div className={styles.filterField}>
            <ProducerSearch value={form.producer_name} onChange={handleProducerChange} />
          </div>

          {editing ? (
            <div className={styles.filterField}>
              <label>Source</label>
              <span className={styles.cellMuted}>{sourceLabel(form.source)}</span>
            </div>
          ) : (
            <div className={styles.filterField}>
              <label htmlFor="package-source">Source</label>
              <select
                id="package-source"
                value={form.source}
                onChange={(event) => updateField("source", event.target.value)}
              >
                <option value="manual">Manual</option>
                <option value="unexpected">Unexpected delivery</option>
                <option value="producer_request">Producer request</option>
                <option value="producer_announcement">Producer announcement</option>
              </select>
            </div>
          )}

          <div className={styles.filterField}>
            <label htmlFor="package-expected">Expected date</label>
            <input
              id="package-expected"
              type="date"
              value={form.expected_at}
              onChange={(event) => updateField("expected_at", event.target.value)}
            />
          </div>

          {(editing || mode === "arrived") && (
            <div className={styles.filterField}>
              <label htmlFor="package-arrived">Arrived date</label>
              <input
                id="package-arrived"
                type="date"
                value={form.arrived_at}
                onChange={(event) => updateField("arrived_at", event.target.value)}
              />
            </div>
          )}

          {(editing || mode === "arrived") && (
            <div className={styles.filterField}>
              <label htmlFor="package-deadline">Review deadline</label>
              <input
                id="package-deadline"
                type="date"
                value={form.review_deadline}
                onChange={(event) => updateField("review_deadline", event.target.value)}
              />
              {!editing && (
                <span className={styles.cellMuted}>Defaults to one month after arrival</span>
              )}
            </div>
          )}
        </div>

        {editing && canPickReviewer && (
          <div className={styles.filters}>
            <div className={styles.filterField}>
              <label htmlFor="package-reviewer">Reviewer (user id)</label>
              <input
                id="package-reviewer"
                type="number"
                min="1"
                value={reviewerId}
                onChange={(event) => setReviewerId(event.target.value)}
              />
            </div>
            <button type="button" className="wine-btn wine-btn--secondary" onClick={searchReviewers}>
              Look up users
            </button>
            {reviewerResults.length > 0 && (
              <div className={styles.filterField}>
                <label htmlFor="package-reviewer-pick">Pick a reviewer</label>
                <select
                  id="package-reviewer-pick"
                  value=""
                  onChange={(event) => setReviewerId(event.target.value)}
                >
                  <option value="">Select…</option>
                  {reviewerResults.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.display_name || candidate.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className={styles.filters}>
          <div className={styles.filterField} style={{ flex: "1 1 24rem" }}>
            <label htmlFor="package-notes">Notes</label>
            <textarea
              id="package-notes"
              rows={4}
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </div>
        </div>

        <div className={styles.filters}>
          <div style={{ flex: "1 1 24rem" }}>
            <label className="image-manager__label">
              Package images (optional — photos of the package, labels, damage…)
            </label>
            <ImageManager
              imageableType="wine_package"
              imageableId={editing ? id : null}
              images={existingImages}
              imageIds={existingImageIds}
              onFilesChange={(files) => setStagedImages(files)}
              onImagesChange={async () => {
                if (!editing) return;
                const reloaded = await winePackagesApi.show(id);
                setExistingImages(Array.isArray(reloaded.images) ? reloaded.images : []);
                setExistingImageIds(Array.isArray(reloaded.image_ids) ? reloaded.image_ids : []);
              }}
            />
          </div>
        </div>

        <div className={styles.inlineFormActions}>
          <button type="submit" className="wine-btn wine-btn--primary wine-btn--lg" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Create Package"}
          </button>
          <Link
            to={editing ? `/wine-packages/${id}` : "/wine-packages"}
            className="wine-btn wine-btn--secondary"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default WinePackageForm;