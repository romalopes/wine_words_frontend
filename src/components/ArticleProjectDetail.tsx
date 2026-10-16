import { useCallback, useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { articleProjectsApi, reviewsApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageAllPackages } from "../constants/roles";
import { errorMessage, errorStatus } from "../utils/errors";
import type {
  ArticleProjectDetail as ArticleProjectDetailType,
  ArticleProjectNotebook,
  ArticleProjectVintageLink,
  ArticleProjectWorkspaceTab,
} from "../types/articleProject";
import type { Review } from "../types/review";
import type { Article } from "../types/article";
import ArticleProjectForm from "./ArticleProjectForm";
import ArticleForm from "./ArticleForm";
import ReviewForm from "./ReviewForm";
import RichTextEditor from "./RichTextEditor";

const TABS: Array<{ id: ArticleProjectWorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "article", label: "Article" },
  { id: "wines-notes", label: "Wines & Notes" },
];
const readable = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "muted";
}) {
  return (
    <div
      className={`article-project-detail__stat${tone === "danger" ? " article-project-detail__stat--danger" : tone === "muted" ? " article-project-detail__stat--muted" : ""}`}
    >
      <span className="article-project-detail__stat-label">{label}</span>
      <strong className="article-project-detail__stat-value">{value}</strong>
    </div>
  );
}

function NotebookEditor({
  notebook,
  onSave,
  onCancel,
  onReload,
}: {
  notebook?: ArticleProjectNotebook;
  onSave: (title: string, content: string) => Promise<void>;
  onCancel: () => void;
  onReload?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(notebook?.title ?? "");
  const [content, setContent] = useState(notebook?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Notebook title is required.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setConflict(false);
      await onSave(title.trim(), content);
    } catch (err) {
      setConflict(errorStatus(err) === 409);
      setError(errorMessage(err, "Could not save notebook."));
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <label>
        Notebook title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={255}
          disabled={saving}
        />
      </label>
      <RichTextEditor
        value={content}
        onChange={setContent}
        label="Notebook content"
        placeholder="Write tasting or research notes…"
      />
      {error && <p className="wine-management__error">{error}</p>}
      {conflict && onReload && (
        <div className="article-project-detail__notebook-conflict">
          <span>Your unsaved notebook changes are still here.</span>
          <button
            className="btn-link"
            type="button"
            onClick={() => void onReload()}
            disabled={saving}
          >
            Reload notebook
          </button>
        </div>
      )}
      <div className="article-project-detail__actions">
        <button className="btn-action" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save notebook"}
        </button>
        <button
          className="btn-link"
          type="button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ArticleProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [project, setProject] = useState<ArticleProjectDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notebookEditor, setNotebookEditor] = useState<{
    vintageId: number;
    notebook?: ArticleProjectNotebook;
  } | null>(null);
  const [creatingReviewId, setCreatingReviewId] = useState<number | null>(null);
  const [reviewEditor, setReviewEditor] = useState<Review | null>(null);
  const [creatingArticle, setCreatingArticle] = useState(false);
  const [unlinkedArticle, setUnlinkedArticle] = useState<Article | null>(null);
  const [linkingArticle, setLinkingArticle] = useState(false);
  const editing = location.pathname.endsWith("/edit");
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const activeTab: ArticleProjectWorkspaceTab = TABS.some(
    (tab) => tab.id === requestedTab,
  )
    ? (requestedTab as ArticleProjectWorkspaceTab)
    : "overview";
  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      setProject(await articleProjectsApi.show(id));
    } catch (err) {
      setError(errorMessage(err, "Could not load Article Project"));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  function selectTab(tab: ArticleProjectWorkspaceTab) {
    const search = new URLSearchParams(location.search);
    if (tab === "overview") search.delete("tab");
    else search.set("tab", tab);
    navigate({
      pathname: location.pathname,
      search: search.toString() ? `?${search.toString()}` : "",
    });
  }
  function tabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (
      !(["ArrowLeft", "ArrowRight", "Home", "End"] as string[]).includes(
        event.key,
      )
    )
      return;
    event.preventDefault();
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TABS.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) %
            TABS.length;
    const nextTab = TABS[target];
    if (!nextTab) return;
    selectTab(nextTab.id);
    window.requestAnimationFrame(() =>
      document.getElementById(`article-project-tab-${nextTab.id}`)?.focus(),
    );
  }
  async function destroy() {
    if (
      !project ||
      !window.confirm(
        `Delete Article Project “${project.name}”? This cannot be undone.`,
      )
    )
      return;
    try {
      setDeleting(true);
      await articleProjectsApi.destroy(project.id);
      navigate("/article-projects");
    } catch (err) {
      setError(errorMessage(err, "Could not delete Article Project"));
      setDeleting(false);
    }
  }
  async function saveNotebook(
    vintageId: number,
    notebook: ArticleProjectNotebook | undefined,
    title: string,
    content: string,
  ) {
    if (!project) return;
    if (notebook)
      await articleProjectsApi.updateNotebook(
        project.id,
        vintageId,
        notebook.id,
        { title, content, lock_version: notebook.lock_version },
      );
    else
      await articleProjectsApi.createNotebook(project.id, vintageId, {
        title,
        content,
      });
    setNotebookEditor(null);
    await load();
  }
  async function removeNotebook(
    vintageId: number,
    notebook: ArticleProjectNotebook,
  ) {
    if (
      !project ||
      !window.confirm(
        `Delete notebook “${notebook.title}”? This cannot be undone.`,
      )
    )
      return;
    try {
      await articleProjectsApi.destroyNotebook(
        project.id,
        vintageId,
        notebook.id,
        notebook.lock_version,
      );
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not delete notebook."));
    }
  }
  async function reloadNotebook(vintageId: number, notebookId: number) {
    if (!project) return;
    const fresh = await articleProjectsApi.show(project.id);
    const notebook = fresh.article_project_vintages
      .find((row) => row.id === vintageId)
      ?.article_project_notebooks?.find((row) => row.id === notebookId);
    setProject(fresh);
    setNotebookEditor(notebook ? { vintageId, notebook } : null);
  }
  async function createReview(
    vintageId: number,
    notebook: ArticleProjectNotebook,
  ) {
    if (!project) return;
    try {
      setCreatingReviewId(notebook.id);
      setError(null);
      setReviewEditor(
        await articleProjectsApi.createReviewFromNotebook(
          project.id,
          vintageId,
          notebook.id,
        ),
      );
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not create draft review."));
    } finally {
      setCreatingReviewId(null);
    }
  }
  async function editReview(reviewId: number) {
    try {
      setReviewEditor(await reviewsApi.show(reviewId));
    } catch (err) {
      setError(errorMessage(err, "Could not load review."));
    }
  }
  async function linkArticle(article: Article) {
    if (!project) return;
    try {
      setLinkingArticle(true);
      setError(null);
      await articleProjectsApi.update(project.id, {
        article_id: article.id,
        lock_version: project.lock_version,
      });
      setCreatingArticle(false);
      setUnlinkedArticle(null);
      await load();
    } catch (err) {
      setUnlinkedArticle(article);
      setError(
        errorMessage(
          err,
          "The Article draft was created, but could not be linked to this project.",
        ),
      );
    } finally {
      setLinkingArticle(false);
    }
  }
  if (loading)
    return (
      <main className="wine-app">
        <p className="wine-management__loading">Loading Article Project…</p>
      </main>
    );
  if (!project)
    return (
      <main className="wine-app">
        <p className="wine-management__error">
          {error ?? "Article Project not found."}
        </p>
        <Link className="auth-form__submit" to="/article-projects">
          Back to Article Projects
        </Link>
      </main>
    );
  if (editing)
    return (
      <main className="wine-app article-project-detail">
        <Link
          className="wine-detail__back"
          to={`/article-projects/${project.id}${activeTab === "overview" ? "" : `?tab=${activeTab}`}`}
        >
          ← Back to Article Project
        </Link>
        <header className="article-project-detail__hero">
          <div className="article-project-detail__hero-main">
            <p className="wine-kicker">Editorial project</p>
            <div className="article-project-detail__title-row">
              <h1>{project.name}</h1>
              <div className="article-project-detail__badges">
                <span className="article-project-detail__badge">Editing</span>
                <span className="article-project-detail__badge article-project-detail__badge--draft">
                  {readable(activeTab)}
                </span>
              </div>
            </div>
            {project.publication && (
              <p className="article-project-detail__subtitle">
                {project.publication}
              </p>
            )}
          </div>
        </header>
        <div
          className="article-project-detail__tabs"
          role="tablist"
          aria-label="Article Project workspace"
        >
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              id={`article-project-tab-${tab.id}`}
              className={`article-project-detail__tab${activeTab === tab.id ? " article-project-detail__tab--active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`article-project-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => tabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          id={`article-project-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`article-project-tab-${activeTab}`}
        >
          <ArticleProjectForm
            embedded
            activeTab={activeTab}
            project={project}
            returnTo={`/article-projects/${project.id}${activeTab === "overview" ? "" : `?tab=${activeTab}`}`}
            onSaved={(saved) => {
              setProject(saved);
              navigate(
                `/article-projects/${saved.id}${activeTab === "overview" ? "" : `?tab=${activeTab}`}`,
                { replace: true },
              );
            }}
          />
        </div>
      </main>
    );
  const manageable =
    canManageAllPackages(user) ||
    Number(project.created_by.id) === Number(user?.id);
  const progress =
    project.target_word_count && project.actual_word_count
      ? Math.min(
          100,
          Math.round(
            (project.actual_word_count / project.target_word_count) * 100,
          ),
        )
      : null;
  const editPath = `/article-projects/${project.id}/edit${activeTab === "overview" ? "" : `?tab=${activeTab}`}`;
  const winesNotes = (
    <>
      <section className="article-project-detail__panel">
        <div className="article-project-detail__panel-heading">
          <h2>Producers</h2>
          <span className="article-project-detail__count">
            {project.article_project_producers.length}
          </span>
        </div>
        {project.article_project_producers.length ? (
          <ul className="article-project-detail__cards">
            {project.article_project_producers.map((row) => (
              <li key={row.id}>
                <div className="article-project-detail__card-head">
                  <Link
                    to={`/producers/${row.producer.slug ?? row.producer.id}`}
                  >
                    {row.producer.name}
                  </Link>
                </div>
                {row.notes && <p>{row.notes}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="article-project-detail__empty">No producers linked.</p>
        )}
      </section>
      <section className="article-project-detail__panel">
        <div className="article-project-detail__panel-heading">
          <h2>Wines &amp; notebooks</h2>
          <span className="article-project-detail__count">
            {project.article_project_vintages.length}
          </span>
        </div>
        {project.article_project_vintages.length ? (
          <ul className="article-project-detail__cards">
            {project.article_project_vintages.map(
              (row: ArticleProjectVintageLink) => (
                <li key={row.id}>
                  <div className="article-project-detail__card-head">
                    {row.vintage.wine_slug ? (
                      <Link to={`/wines/${row.vintage.wine_slug}`}>
                        {row.vintage.display_name}
                        {row.vintage.wine_name
                          ? ` — ${row.vintage.wine_name}`
                          : ""}
                      </Link>
                    ) : (
                      <strong>{row.vintage.display_name}</strong>
                    )}
                    <div className="article-project-detail__chips">
                      {(
                        ["requested", "received", "selected", "tasted"] as const
                      )
                        .filter((flag) => row[flag])
                        .map((flag) => (
                          <span
                            key={flag}
                            className="article-project-detail__chip"
                          >
                            {readable(flag)}
                          </span>
                        ))}
                    </div>
                  </div>
                  {row.notes && <p>{row.notes}</p>}
                  <h3>Notebooks</h3>
                  {(row.article_project_notebooks ?? []).map((notebook) => (
                    <div
                      key={notebook.id}
                      className="article-project-detail__notebook"
                    >
                      {notebookEditor?.notebook?.id === notebook.id ? (
                        <NotebookEditor
                          key={`${notebook.id}-${notebook.lock_version}`}
                          notebook={notebook}
                          onSave={(title, content) =>
                            saveNotebook(row.id, notebook, title, content)
                          }
                          onCancel={() => setNotebookEditor(null)}
                          onReload={() => reloadNotebook(row.id, notebook.id)}
                        />
                      ) : (
                        <>
                          <h4>{notebook.title}</h4>
                          <div className="article-project-detail__actions">
                            {manageable && (
                              <>
                                <button
                                  className="btn-link"
                                  type="button"
                                  onClick={() =>
                                    setNotebookEditor({
                                      vintageId: row.id,
                                      notebook,
                                    })
                                  }
                                >
                                  Edit notebook
                                </button>
                                <button
                                  className="btn-link"
                                  type="button"
                                  disabled={creatingReviewId === notebook.id}
                                  onClick={() =>
                                    void createReview(row.id, notebook)
                                  }
                                >
                                  {creatingReviewId === notebook.id
                                    ? "Creating draft…"
                                    : "Create draft review"}
                                </button>
                                <button
                                  className="btn-link danger"
                                  type="button"
                                  onClick={() =>
                                    void removeNotebook(row.id, notebook)
                                  }
                                >
                                  Delete notebook
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {!(row.article_project_notebooks ?? []).length && (
                    <p className="article-project-detail__empty">
                      No notebooks yet.
                    </p>
                  )}
                  {manageable &&
                    (notebookEditor?.vintageId === row.id &&
                    !notebookEditor.notebook ? (
                      <NotebookEditor
                        onSave={(title, content) =>
                          saveNotebook(row.id, undefined, title, content)
                        }
                        onCancel={() => setNotebookEditor(null)}
                      />
                    ) : (
                      <button
                        className="btn-link"
                        type="button"
                        onClick={() => setNotebookEditor({ vintageId: row.id })}
                      >
                        Add notebook
                      </button>
                    ))}
                </li>
              ),
            )}
          </ul>
        ) : (
          <p className="article-project-detail__empty">No wines linked.</p>
        )}
      </section>
      <section className="article-project-detail__panel">
        <div className="article-project-detail__panel-heading">
          <h2>Reviews</h2>
          <span className="article-project-detail__count">
            {project.article_project_reviews.length}
          </span>
        </div>
        {project.article_project_reviews.length ? (
          <ul className="article-project-detail__cards">
            {project.article_project_reviews.map((row) => (
              <li key={row.id}>
                <div className="article-project-detail__card-head">
                  <Link to={`/reviews/${row.review.slug ?? row.review.id}`}>
                    {row.review.title}
                  </Link>
                  {row.review.wine_name && (
                    <span className="article-project-detail__chip">
                      {row.review.wine_name}
                      {row.review.vintage_year
                        ? ` ${row.review.vintage_year}`
                        : ""}
                    </span>
                  )}
                  {manageable && (
                    <button
                      className="btn-link"
                      type="button"
                      onClick={() => void editReview(row.review.id)}
                    >
                      Edit review
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="article-project-detail__empty">No reviews linked.</p>
        )}
      </section>
      {reviewEditor && (
        <section className="article-project-detail__panel">
          <div className="article-project-detail__panel-heading">
            <h2>Edit draft review</h2>
          </div>
          <ReviewForm
            review={reviewEditor}
            vintageYear={reviewEditor.vintage_year ?? null}
            onSaved={() => {
              setReviewEditor(null);
              void load();
            }}
            onCancel={() => setReviewEditor(null)}
          />
        </section>
      )}
    </>
  );
  return (
    <main className="wine-app article-project-detail">
      <Link className="wine-detail__back" to="/article-projects">
        ← Back to Article Projects
      </Link>
      {error && <p className="article-project-detail__error">{error}</p>}
      <header className="article-project-detail__hero">
        <div className="article-project-detail__hero-main">
          <p className="wine-kicker">Editorial project</p>
          <div className="article-project-detail__title-row">
            <h1>{project.name}</h1>
            <div className="article-project-detail__badges">
              <span className="article-project-detail__badge">
                {readable(project.project_status)}
              </span>
              <span className="article-project-detail__badge article-project-detail__badge--draft">
                {readable(project.drafting_status)}
              </span>
              {project.overdue && (
                <span className="article-project-detail__badge article-project-detail__badge--overdue">
                  Overdue
                </span>
              )}
            </div>
          </div>
          {project.publication && (
            <p className="article-project-detail__subtitle">
              {project.publication}
            </p>
          )}
        </div>
        {manageable && (
          <div className="article-project-detail__actions">
            <button
              className="auth-form__submit"
              type="button"
              onClick={() => navigate(editPath)}
            >
              Edit Article Project
            </button>
            <button
              className="review-form__cancel"
              type="button"
              disabled={deleting}
              onClick={() => void destroy()}
            >
              {deleting ? "Deleting…" : "Delete Article Project"}
            </button>
          </div>
        )}
      </header>
      <div
        className="article-project-detail__tabs"
        role="tablist"
        aria-label="Article Project workspace"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            id={`article-project-tab-${tab.id}`}
            className={`article-project-detail__tab${activeTab === tab.id ? " article-project-detail__tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`article-project-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => tabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "overview" && (
        <div
          id="article-project-panel-overview"
          role="tabpanel"
          aria-labelledby="article-project-tab-overview"
        >
          <div className="article-project-detail__stats">
            <Stat
              label="Target words"
              value={project.target_word_count?.toLocaleString() ?? "—"}
            />
            <Stat
              label="Actual words"
              value={project.actual_word_count?.toLocaleString() ?? "—"}
            />
            <Stat
              label="Remaining"
              value={project.word_count_remaining?.toLocaleString() ?? "—"}
              tone={
                project.word_count_remaining != null &&
                project.word_count_remaining < 0
                  ? "danger"
                  : "muted"
              }
            />
            <Stat label="Wines" value={String(project.counts.total)} />
          </div>
          {progress != null && (
            <div className="article-project-detail__progress">
              <span>Article progress</span>
              <div>
                <i style={{ width: `${progress}%` }} />
              </div>
              <strong>{progress}%</strong>
            </div>
          )}
          <div className="article-project-detail__two-col">
            <section className="article-project-detail__panel">
              <div className="article-project-detail__panel-heading">
                <h2>Assignment</h2>
              </div>
              {project.description && (
                <p className="article-project-detail__description">
                  {project.description}
                </p>
              )}
              <dl className="article-project-detail__meta">
                <div>
                  <dt>Editor</dt>
                  <dd>{project.editor_name || "—"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{project.editor_email || "—"}</dd>
                </div>
                <div>
                  <dt>Deadline</dt>
                  <dd>{project.deadline || "—"}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{project.created_by.display_name || "—"}</dd>
                </div>
              </dl>
            </section>
            <section className="article-project-detail__panel">
              <div className="article-project-detail__panel-heading">
                <h2>Tasting pipeline</h2>
              </div>
              <ul className="article-project-detail__pipeline">
                {(["requested", "received", "selected", "tasted"] as const).map(
                  (flag) => (
                    <li key={flag}>
                      <span>{readable(flag)}</span>
                      <strong>{project.counts[flag]}</strong>
                      <div className="article-project-detail__bar">
                        <i
                          style={{
                            width: `${project.counts.total ? Math.round((project.counts[flag] / project.counts.total) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </section>
          </div>
        </div>
      )}
      {activeTab === "article" && (
        <section
          id="article-project-panel-article"
          className="article-project-detail__panel"
          role="tabpanel"
          aria-labelledby="article-project-tab-article"
        >
          <div className="article-project-detail__panel-heading">
            <h2>Article</h2>
          </div>
          {project.article ? (
            <>
              <Link
                className="article-project-detail__linked"
                to={`/articles/${project.article.slug ?? project.article.id}`}
              >
                <span>{project.article.title}</span>
                <em>{readable(project.article.status)}</em>
              </Link>
              <p className="article-project-detail__description">
                The linked article remains independently managed in the article
                workflow.
              </p>
              {manageable && (
                <button
                  className="btn-link"
                  type="button"
                  onClick={() => navigate(editPath)}
                >
                  Change linked article
                </button>
              )}
            </>
          ) : (
            <>
              <p className="article-project-detail__empty">
                No article is linked to this project yet.
              </p>
              {manageable && (
                <div className="article-project-detail__article-actions">
                  <button
                    className="auth-form__submit"
                    type="button"
                    onClick={() => {
                      setCreatingArticle(true);
                      setUnlinkedArticle(null);
                      setError(null);
                    }}
                  >
                    Create new Article
                  </button>
                  <button
                    className="btn-link"
                    type="button"
                    onClick={() => navigate(editPath)}
                  >
                    Link an existing article
                  </button>
                </div>
              )}
              {unlinkedArticle && (
                <div className="article-project-detail__notice" role="alert">
                  <p>
                    “{unlinkedArticle.title}” was created but is not linked to
                    this project yet.
                  </p>
                  <button
                    className="auth-form__submit"
                    type="button"
                    disabled={linkingArticle}
                    onClick={() => void linkArticle(unlinkedArticle)}
                  >
                    {linkingArticle ? "Linking…" : "Retry linking Article"}
                  </button>
                </div>
              )}
              {creatingArticle && !unlinkedArticle && (
                <div className="article-project-detail__article-editor">
                  <h3>Create Article draft</h3>
                  <ArticleForm
                    onSaved={(saved) => {
                      if (saved) void linkArticle(saved);
                    }}
                    onCancel={() => setCreatingArticle(false)}
                  />
                </div>
              )}
            </>
          )}
        </section>
      )}
      {activeTab === "wines-notes" && (
        <div
          id="article-project-panel-wines-notes"
          role="tabpanel"
          aria-labelledby="article-project-tab-wines-notes"
        >
          {winesNotes}
        </div>
      )}
    </main>
  );
}
