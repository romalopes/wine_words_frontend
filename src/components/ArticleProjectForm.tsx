import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Link, useNavigate } from "react-router-dom";
import { articleProjectsApi } from "../services/api";
import { errorMessage, errorStatus, errorText } from "../utils/errors";
import type {
  ArticleProjectDetail,
  ArticleProjectLookupItem,
  ArticleProjectStatus,
  ArticleProjectWorkspaceTab,
  ArticleProjectWritePayload,
  DraftingStatus,
} from "../types/articleProject";

const PROJECT_STATUSES: ArticleProjectStatus[] = [
  "initiated",
  "planning",
  "pending_wines",
  "researching",
  "tasting",
  "final_draft",
  "pending_editor_review",
  "reviewed_by_editor",
  "published",
  "on_hold",
  "cancelled",
];
const DRAFTING_STATUSES: DraftingStatus[] = [
  "not_initiated",
  "initiated",
  "in_progress",
  "finished",
];
const BOTTLE_CONDITIONS = [
  "not_assessed",
  "good",
  "damaged",
  "leaking",
  "other",
] as const;
type ProducerRow = {
  id?: number;
  producer_id: number;
  name: string;
  contacted: boolean;
  request_confirmed: boolean;
  notes: string;
};
type VintageRow = {
  id?: number;
  vintage_id: number;
  label: string;
  producer_id: number | null;
  requested: boolean;
  received: boolean;
  selected: boolean;
  tasted: boolean;
  date_received: string;
  bottle_condition: string;
  notes: string;
};
type ReviewRow = { id?: number; review_id: number; label: string };
type FormState = {
  name: string;
  publication: string;
  editor_name: string;
  editor_email: string;
  project_status: ArticleProjectStatus;
  drafting_status: DraftingStatus;
  deadline: string;
  target_word_count: string;
  description: string;
  article_id: number | null;
  article_label: string;
  producers: ProducerRow[];
  vintages: VintageRow[];
  reviews: ReviewRow[];
};

const blankForm = (): FormState => ({
  name: "",
  publication: "",
  editor_name: "",
  editor_email: "",
  project_status: "initiated",
  drafting_status: "not_initiated",
  deadline: "",
  target_word_count: "",
  description: "",
  article_id: null,
  article_label: "",
  producers: [],
  vintages: [],
  reviews: [],
});
const readable = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const labelOf = (item: ArticleProjectLookupItem) =>
  "display_name" in item
    ? `${item.display_name}${item.wine_name ? ` — ${item.wine_name}` : ""}`
    : "name" in item
      ? item.name
      : "wine_name" in item
        ? `${item.title}${item.wine_name ? ` — ${item.wine_name}` : ""}`
        : item.title;
function formFromProject(project: ArticleProjectDetail): FormState {
  return {
    name: project.name,
    publication: project.publication ?? "",
    editor_name: project.editor_name ?? "",
    editor_email: project.editor_email ?? "",
    project_status: project.project_status,
    drafting_status: project.drafting_status,
    deadline: project.deadline ?? "",
    target_word_count: project.target_word_count?.toString() ?? "",
    description: project.description ?? "",
    article_id: project.article?.id ?? null,
    article_label: project.article?.title ?? "",
    producers: project.article_project_producers.map((row) => ({
      id: row.id,
      producer_id: row.producer.id,
      name: row.producer.name,
      contacted: row.contacted,
      request_confirmed: row.request_confirmed,
      notes: row.notes ?? "",
    })),
    vintages: project.article_project_vintages.map((row) => ({
      id: row.id,
      vintage_id: row.vintage.id,
      label: `${row.vintage.display_name}${row.vintage.wine_name ? ` — ${row.vintage.wine_name}` : ""}`,
      producer_id: row.vintage.producer_id,
      requested: row.requested,
      received: row.received,
      selected: row.selected,
      tasted: row.tasted,
      date_received: row.date_received ?? "",
      bottle_condition: row.bottle_condition,
      notes: row.notes ?? "",
    })),
    reviews: project.article_project_reviews.map((row) => ({
      id: row.id,
      review_id: row.review.id,
      label: `${row.review.title}${row.review.wine_name ? ` — ${row.review.wine_name}` : ""}`,
    })),
  };
}

function Lookup({
  kind,
  producerId,
  onPick,
  placeholder,
  disabledIds,
}: {
  kind: "article" | "producer" | "vintage" | "review";
  producerId?: number;
  onPick: (item: ArticleProjectLookupItem) => void;
  placeholder: string;
  disabledIds: number[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArticleProjectLookupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const id = ++requestId.current;
      setLoading(true);
      try {
        const found = await articleProjectsApi.lookup(kind, term, producerId);
        if (id === requestId.current)
          setResults(found.filter((item) => !disabledIds.includes(item.id)));
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [disabledIds, kind, producerId, query]);
  return (
    <div className="article-project-form__lookup">
      <input
        aria-label={`${readable(kind)} search`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
      />
      {loading && (
        <span className="article-project-form__searching">Searching…</span>
      )}
      {results.length > 0 && (
        <ul className="article-project-form__lookup-results">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(item);
                  setQuery("");
                  setResults([]);
                }}
              >
                Add {labelOf(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface ArticleProjectFormProps {
  project?: ArticleProjectDetail;
  onSaved?: (project: ArticleProjectDetail) => void;
  activeTab?: ArticleProjectWorkspaceTab;
  embedded?: boolean;
  returnTo?: string;
}
export default function ArticleProjectForm({
  project,
  onSaved,
  activeTab = "overview",
  embedded = false,
  returnTo,
}: ArticleProjectFormProps) {
  const navigate = useNavigate();
  const editing = Boolean(project);
  const [form, setForm] = useState<FormState>(() =>
    project ? formFromProject(project) : blankForm(),
  );
  const [removedProducerIds, setRemovedProducerIds] = useState<number[]>([]);
  const [removedVintageIds, setRemovedVintageIds] = useState<number[]>([]);
  const [removedReviewIds, setRemovedReviewIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const initial = useRef(
    JSON.stringify(project ? formFromProject(project) : blankForm()),
  );
  const dirty =
    JSON.stringify(form) !== initial.current ||
    removedProducerIds.length > 0 ||
    removedVintageIds.length > 0 ||
    removedReviewIds.length > 0;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const anchor = (event: MouseEvent) => {
      if (
        !dirty ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (link && !window.confirm("Discard unsaved Article Project changes?"))
        event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", anchor, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", anchor, true);
    };
  }, [dirty]);
  const producerIds = useMemo(
    () => form.producers.map((row) => row.producer_id),
    [form.producers],
  );
  const vintageIds = useMemo(
    () => form.vintages.map((row) => row.vintage_id),
    [form.vintages],
  );
  const reviewIds = useMemo(
    () => form.reviews.map((row) => row.review_id),
    [form.reviews],
  );
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const remove = <T extends { id?: number }>(
    key: "producers" | "vintages" | "reviews",
    index: number,
    rows: T[],
    setRemoved: Dispatch<SetStateAction<number[]>>,
  ) => {
    const row = rows[index];
    if (row?.id) setRemoved((current) => [...current, row.id!]);
    update(
      key,
      rows.filter((_, rowIndex) => rowIndex !== index) as unknown as FormState[typeof key],
    );
  };
  const backTo =
    returnTo ??
    (editing && project
      ? `/article-projects/${project.id}`
      : "/article-projects");
  async function reloadAfterConflict() {
    if (!project) return;
    try {
      const fresh = await articleProjectsApi.show(project.id);
      const next = formFromProject(fresh);
      setForm(next);
      initial.current = JSON.stringify(next);
      setRemovedProducerIds([]);
      setRemovedVintageIds([]);
      setRemovedReviewIds([]);
      setConflict(false);
      setError(null);
    } catch (err) {
      setError(
        errorMessage(err, "Could not reload the current Article Project"),
      );
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setConflict(false);
    const payload: ArticleProjectWritePayload = {
      name: form.name,
      publication: form.publication || null,
      editor_name: form.editor_name || null,
      editor_email: form.editor_email || null,
      project_status: form.project_status,
      drafting_status: form.drafting_status,
      deadline: form.deadline || null,
      target_word_count: form.target_word_count
        ? Number(form.target_word_count)
        : null,
      description: form.description || null,
      article_id: form.article_id,
      article_project_producers_attributes: [
        ...form.producers.map((row) => ({
          ...(row.id ? { id: row.id } : { producer_id: row.producer_id }),
          contacted: row.contacted,
          request_confirmed: row.request_confirmed,
          notes: row.notes || null,
        })),
        ...removedProducerIds.map((id) => ({ id, _destroy: true })),
      ],
      article_project_vintages_attributes: [
        ...form.vintages.map((row) => ({
          ...(row.id ? { id: row.id } : { vintage_id: row.vintage_id }),
          requested: row.requested,
          received: row.received,
          selected: row.selected,
          tasted: row.tasted,
          date_received: row.date_received || null,
          bottle_condition: row.bottle_condition,
          notes: row.notes || null,
        })),
        ...removedVintageIds.map((id) => ({ id, _destroy: true })),
      ],
      article_project_reviews_attributes: [
        ...form.reviews.map((row) =>
          row.id ? { id: row.id } : { review_id: row.review_id },
        ),
        ...removedReviewIds.map((id) => ({ id, _destroy: true })),
      ],
    };
    try {
      const saved =
        editing && project
          ? await articleProjectsApi.update(project.id, {
              ...payload,
              lock_version: project.lock_version,
            })
          : await articleProjectsApi.create(payload);
      initial.current = JSON.stringify(form);
      onSaved?.(saved as ArticleProjectDetail);
      if (!onSaved) navigate(`/article-projects/${saved.id}`);
    } catch (err) {
      setConflict(errorStatus(err) === 409);
      setError(
        errorText(err) ?? errorMessage(err, "Could not save Article Project"),
      );
    } finally {
      setSaving(false);
    }
  }
  const addProducer = (item: ArticleProjectLookupItem) =>
    setForm((current) => ({
      ...current,
      producers: [
        ...current.producers,
        {
          producer_id: item.id,
          name: labelOf(item),
          contacted: false,
          request_confirmed: false,
          notes: "",
        },
      ],
    }));
  const addVintage = (item: ArticleProjectLookupItem) =>
    setForm((current) => ({
      ...current,
      vintages: [
        ...current.vintages,
        {
          vintage_id: item.id,
          label: labelOf(item),
          producer_id: "producer_id" in item ? item.producer_id : null,
          requested: false,
          received: false,
          selected: false,
          tasted: false,
          date_received: "",
          bottle_condition: "not_assessed",
          notes: "",
        },
      ],
    }));
  const Wrapper = embedded ? "div" : "main";
  return (
    <Wrapper
      className={`wine-app article-project-form-page${embedded ? " article-project-form-page--embedded" : ""}`}
    >
      <Link className="wine-detail__back" to={backTo}>
        ← {editing ? "Back to Article Project" : "Back to Article Projects"}
      </Link>
      <header className="article-project-form__header">
        <div>
          <p className="wine-kicker">Editorial workspace</p>
          <h1>{editing ? "Edit Article Project" : "New Article Project"}</h1>
          <p>
            Keep the assignment, sourcing, and tasting workflow in one place.
          </p>
        </div>
        {editing && (
          <span className="article-project-form__status">
            {readable(form.project_status)}
          </span>
        )}
      </header>
      {error && (
        <p
          role="alert"
          className="article-project-form__notice article-project-form__notice--error"
        >
          {error}
        </p>
      )}
      {conflict && (
        <div className="article-project-form__notice">
          <span>This project was changed elsewhere.</span>
          <button
            type="button"
            className="auth-form__submit"
            onClick={reloadAfterConflict}
          >
            Reload server version
          </button>
        </div>
      )}
      <form
        className={`article-project-form${embedded ? ` article-project-form--tab-${activeTab}` : ""}`}
        onSubmit={submit}
      >
        <section className="article-project-form__section article-project-form__section--overview">
          <div className="article-project-form__section-heading">
            <div>
              <p className="wine-kicker">Assignment</p>
              <h2>Project details</h2>
            </div>
            <p>Define the editorial brief and delivery target.</p>
          </div>
          <div className="article-project-form__grid">
            <label className="article-project-form__field article-project-form__field--wide">
              <span>
                Name <b>*</b>
              </span>
              <input
                aria-label="Name"
                required
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </label>
            <label className="article-project-form__field">
              <span>Publication</span>
              <input
                aria-label="Publication"
                value={form.publication}
                onChange={(event) => update("publication", event.target.value)}
              />
            </label>
            <label className="article-project-form__field">
              <span>Deadline</span>
              <input
                aria-label="Deadline"
                type="date"
                value={form.deadline}
                onChange={(event) => update("deadline", event.target.value)}
              />
            </label>
            <label className="article-project-form__field">
              <span>Assignment status</span>
              <select
                aria-label="Assignment status"
                value={form.project_status}
                onChange={(event) =>
                  update(
                    "project_status",
                    event.target.value as ArticleProjectStatus,
                  )
                }
              >
                {PROJECT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {readable(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="article-project-form__field">
              <span>Drafting status</span>
              <select
                aria-label="Drafting status"
                value={form.drafting_status}
                onChange={(event) =>
                  update(
                    "drafting_status",
                    event.target.value as DraftingStatus,
                  )
                }
              >
                {DRAFTING_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {readable(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="article-project-form__field">
              <span>Target word count</span>
              <input
                aria-label="Target word count"
                type="number"
                min="1"
                value={form.target_word_count}
                onChange={(event) =>
                  update("target_word_count", event.target.value)
                }
              />
            </label>
          </div>
          <label className="article-project-form__field">
            <span>Description</span>
            <textarea
              aria-label="Description"
              rows={5}
              value={form.description}
              placeholder="Outline the story angle, tasting scope, or editorial notes."
              onChange={(event) => update("description", event.target.value)}
            />
          </label>
        </section>
        <section className="article-project-form__section article-project-form__section--overview">
          <div className="article-project-form__section-heading">
            <div>
              <p className="wine-kicker">Contacts</p>
              <h2>Editorial contact</h2>
            </div>
            <p>Optional, but useful for delivery and approvals.</p>
          </div>
          <div className="article-project-form__grid">
            <label className="article-project-form__field">
              <span>Editor name</span>
              <input
                value={form.editor_name}
                onChange={(event) => update("editor_name", event.target.value)}
              />
            </label>
            <label className="article-project-form__field">
              <span>Editor email</span>
              <input
                type="email"
                value={form.editor_email}
                onChange={(event) => update("editor_email", event.target.value)}
              />
            </label>
          </div>
        </section>
        <section className="article-project-form__section article-project-form__section--article">
          <div className="article-project-form__section-heading">
            <div>
              <p className="wine-kicker">Content</p>
              <h2>Article</h2>
            </div>
            <p>Link the draft or published story when available.</p>
          </div>
          <Lookup
            kind="article"
            placeholder="Search your articles"
            disabledIds={form.article_id ? [form.article_id] : []}
            onPick={(item) =>
              setForm((current) => ({
                ...current,
                article_id: item.id,
                article_label: labelOf(item),
              }))
            }
          />
          {form.article_id ? (
            <div className="article-project-form__linked-item">
              <strong>{form.article_label}</strong>
              <button
                type="button"
                className="article-project-form__remove"
                onClick={() => {
                  update("article_id", null);
                  update("article_label", "");
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <p className="article-project-form__empty">
              No Article linked yet.
            </p>
          )}
        </section>
        <section className="article-project-form__section article-project-form__section--wines-notes">
          <div className="article-project-form__section-heading">
            <div>
              <p className="wine-kicker">Sourcing</p>
              <h2>
                Producers <span>{form.producers.length}</span>
              </h2>
            </div>
            <p>Add producers and track outreach.</p>
          </div>
          <Lookup
            kind="producer"
            placeholder="Search producers"
            disabledIds={producerIds}
            onPick={addProducer}
          />
          {form.producers.length === 0 && (
            <p className="article-project-form__empty">
              No producers selected.
            </p>
          )}
          <div className="article-project-form__rows">
            {form.producers.map((row, index) => (
              <article
                className="article-project-form__row"
                key={row.id ?? row.producer_id}
              >
                <header>
                  <strong>{row.name}</strong>
                  <button
                    type="button"
                    className="article-project-form__remove"
                    onClick={() =>
                      remove(
                        "producers",
                        index,
                        form.producers,
                        setRemovedProducerIds,
                      )
                    }
                  >
                    Remove
                  </button>
                </header>
                <div className="article-project-form__checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={row.contacted}
                      onChange={(event) =>
                        update(
                          "producers",
                          form.producers.map((item, i) =>
                            i === index
                              ? { ...item, contacted: event.target.checked }
                              : item,
                          ),
                        )
                      }
                    />{" "}
                    Contacted
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={row.request_confirmed}
                      onChange={(event) =>
                        update(
                          "producers",
                          form.producers.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  request_confirmed: event.target.checked,
                                  contacted:
                                    event.target.checked || item.contacted,
                                }
                              : item,
                          ),
                        )
                      }
                    />{" "}
                    Request confirmed
                  </label>
                </div>
                <label className="article-project-form__field">
                  <span>Notes</span>
                  <input
                    aria-label={`${row.name} notes`}
                    value={row.notes}
                    placeholder="Outreach or sample notes"
                    onChange={(event) =>
                      update(
                        "producers",
                        form.producers.map((item, i) =>
                          i === index
                            ? { ...item, notes: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
              </article>
            ))}
          </div>
        </section>
        <section className="article-project-form__section article-project-form__section--wines-notes">
          <div className="article-project-form__section-heading">
            <div>
              <p className="wine-kicker">Tasting</p>
              <h2>
                Wines <span>{form.vintages.length}</span>
              </h2>
            </div>
            <p>
              {form.producers.length === 1
                ? "Results are filtered to the selected producer."
                : "Add wines to request, receive, and taste."}
            </p>
          </div>
          <Lookup
            kind="vintage"
            {...(form.producers.length === 1 &&
            form.producers[0]?.producer_id != null
              ? { producerId: form.producers[0].producer_id }
              : {})}
            placeholder="Search wine or vintage year"
            disabledIds={vintageIds}
            onPick={addVintage}
          />
          {form.vintages.length === 0 && (
            <p className="article-project-form__empty">No wines selected.</p>
          )}
          <div className="article-project-form__rows">
            {form.vintages.map((row, index) => (
              <article
                className="article-project-form__row"
                key={row.id ?? row.vintage_id}
              >
                <header>
                  <strong>{row.label}</strong>
                  <button
                    type="button"
                    className="article-project-form__remove"
                    onClick={() =>
                      remove(
                        "vintages",
                        index,
                        form.vintages,
                        setRemovedVintageIds,
                      )
                    }
                  >
                    Remove
                  </button>
                </header>
                <div className="article-project-form__checks">
                  {(
                    ["requested", "received", "selected", "tasted"] as const
                  ).map((field) => (
                    <label key={field}>
                      <input
                        type="checkbox"
                        checked={row[field]}
                        onChange={(event) =>
                          update(
                            "vintages",
                            form.vintages.map((item, i) =>
                              i === index
                                ? { ...item, [field]: event.target.checked }
                                : item,
                            ),
                          )
                        }
                      />{" "}
                      {readable(field)}
                    </label>
                  ))}
                </div>
                <div className="article-project-form__grid">
                  <label className="article-project-form__field">
                    <span>Date received</span>
                    <input
                      type="date"
                      disabled={!row.received}
                      value={row.date_received}
                      onChange={(event) =>
                        update(
                          "vintages",
                          form.vintages.map((item, i) =>
                            i === index
                              ? { ...item, date_received: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="article-project-form__field">
                    <span>Condition</span>
                    <select
                      disabled={!row.received}
                      value={row.bottle_condition}
                      onChange={(event) =>
                        update(
                          "vintages",
                          form.vintages.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  bottle_condition: event.target.value,
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      {BOTTLE_CONDITIONS.map((value) => (
                        <option key={value} value={value}>
                          {readable(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="article-project-form__field">
                  <span>Notes</span>
                  <input
                    aria-label={`${row.label} notes`}
                    value={row.notes}
                    placeholder="Bottle, tasting, or selection notes"
                    onChange={(event) =>
                      update(
                        "vintages",
                        form.vintages.map((item, i) =>
                          i === index
                            ? { ...item, notes: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
              </article>
            ))}
          </div>
        </section>
        <section className="article-project-form__section article-project-form__section--wines-notes">
          <div className="article-project-form__section-heading">
            <div>
              <p className="wine-kicker">Supporting work</p>
              <h2>
                Reviews <span>{form.reviews.length}</span>
              </h2>
            </div>
            <p>Attach completed reviews that support this story.</p>
          </div>
          <Lookup
            kind="review"
            placeholder="Search your reviews"
            disabledIds={reviewIds}
            onPick={(item) =>
              setForm((current) => ({
                ...current,
                reviews: [
                  ...current.reviews,
                  { review_id: item.id, label: labelOf(item) },
                ],
              }))
            }
          />
          {form.reviews.length === 0 && (
            <p className="article-project-form__empty">No reviews linked.</p>
          )}
          <div className="article-project-form__rows">
            {form.reviews.map((row, index) => (
              <div
                className="article-project-form__linked-item"
                key={row.id ?? row.review_id}
              >
                <strong>{row.label}</strong>
                <button
                  type="button"
                  className="article-project-form__remove"
                  onClick={() =>
                    remove("reviews", index, form.reviews, setRemovedReviewIds)
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
        <footer className="article-project-form__actions">
          <div>
            <button
              type="submit"
              className="auth-form__submit"
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Create Article Project"}
            </button>
            <button
              type="button"
              className="review-form__cancel"
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm("Discard unsaved Article Project changes?")
                )
                  navigate(backTo);
              }}
            >
              Cancel
            </button>
          </div>
          <p>{dirty ? "Unsaved changes" : "All changes saved"}</p>
        </footer>
      </form>
    </Wrapper>
  );
}
