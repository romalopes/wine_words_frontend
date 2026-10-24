import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import DetailHero from "./DetailHero"
import { articleProjectsApi } from "../services/api"
import type { ArticleProject, ArticleProjectStatus, DraftingStatus } from "../types/articleProject"
import { useAuth } from "../contexts/AuthContext"
import { canAccessArticleProjects } from "../constants/roles"
import usePagedList from "../hooks/usePagedList"
import Pagination from "./Pagination"
import styles from "./ArticleProjects.module.css"

const PROJECT_STATUSES: ArticleProjectStatus[] = [
  "initiated", "planning", "pending_wines", "researching", "tasting",
  "final_draft", "pending_editor_review", "reviewed_by_editor", "published",
  "on_hold", "cancelled",
]
const DRAFTING_STATUSES: DraftingStatus[] = ["not_initiated", "initiated", "in_progress", "finished"]

function readableStatus(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function deadlineLabel(articleProject: ArticleProject): string {
  if (!articleProject.deadline) return "No deadline"
  const formatted = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(`${articleProject.deadline}T00:00:00`),
  )
  return articleProject.overdue ? `Overdue · ${formatted}` : formatted
}

function ArticleProjects() {
  const { user } = useAuth()
  const [query, setQuery] = useState("")
  const [projectStatus, setProjectStatus] = useState("")
  const [draftingStatus, setDraftingStatus] = useState("")
  const [overdue, setOverdue] = useState(false)
  const [sort, setSort] = useState("updated_at")
  const canAccess = canAccessArticleProjects(user)

  const extraParams = useMemo(() => ({
    query: query.trim() || undefined,
    project_status: projectStatus || undefined,
    drafting_status: draftingStatus || undefined,
    overdue: overdue || undefined,
    sort,
  }), [draftingStatus, overdue, projectStatus, query, sort])

  const list = usePagedList<ArticleProject>({
    fetcher: (params) => articleProjectsApi.list(params),
    extraParams,
    enabled: canAccess,
  })

  if (!canAccess) {
    return <div className="wine-app"><p className="wine-management__error">Article Projects are available to Reviewers, Editors, and Admins.</p></div>
  }

  return (
    <div className="wine-app">
      <Link to="/" className="wine-detail__back">
        &larr; Back to Dashboard
      </Link>
      <DetailHero
        kicker="Editorial"
        title="Article Projects"
        intro="Track editorial assignments, wine requests, and drafting progress."
        actions={
          <Link className="auth-form__submit" to="/article-projects/new">
            New Article Project
          </Link>
        }
      />

      <section aria-label="Article Project filters" className={`${styles.filters} wine-management__filters`}>
        <div className={styles.filtersGrid}>
          <label htmlFor="search-input" className={styles.filterGroup}>
            <span>Search</span>
            <input id="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or publication" />
          </label>
          <label htmlFor="assignment-status" className={styles.filterGroup}>
            <span>Assignment status</span>
            <select id="assignment-status" value={projectStatus} onChange={(event) => setProjectStatus(event.target.value)}>
              <option value="">All statuses</option>
              {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{readableStatus(status)}</option>)}
            </select>
          </label>
          <label htmlFor="drafting-status" className={styles.filterGroup}>
            <span>Drafting status</span>
            <select id="drafting-status" value={draftingStatus} onChange={(event) => setDraftingStatus(event.target.value)}>
              <option value="">All drafting statuses</option>
              {DRAFTING_STATUSES.map((status) => <option key={status} value={status}>{readableStatus(status)}</option>)}
            </select>
          </label>
          <label htmlFor="sort" className={styles.filterGroup}>
            <span>Sort</span>
            <select id="sort" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="updated_at">Recently updated</option>
              <option value="created_at">Recently created</option>
              <option value="deadline">Deadline</option>
              <option value="name">Name</option>
            </select>
          </label>
          <label className={`${styles.filterGroup} ${styles.checkboxGroup}`}>
            <input type="checkbox" id="overdue-checkbox" checked={overdue} onChange={(event) => setOverdue(event.target.checked)} />
            <span>Overdue only</span>
          </label>
        </div>
      </section>

      {list.loading && <p className="wine-management__loading">Loading Article Projects…</p>}
      {list.error && (
        <div>
          <p className="wine-management__error">{list.error}</p>
          <button type="button" className="auth-form__submit" onClick={list.reload}>Retry</button>
        </div>
      )}
      {!list.loading && !list.error && list.items.length === 0 && (
        <div className="wine-management__empty"><p>No Article Projects match these filters.</p></div>
      )}
      {!list.loading && !list.error && list.items.length > 0 && (
        <>
          <div className="wine-management__grid">
            {list.items.map((articleProject) => (
              <article key={articleProject.id} className="wine-management__card">
                <div className="wine-management__card-header">
                  <h2>{articleProject.name}</h2>
                  <span className={articleProject.overdue ? "wine-management__color-badge wine-management__color-badge--red" : "wine-management__color-badge"}>
                    {readableStatus(articleProject.project_status)}
                  </span>
                </div>
                {articleProject.publication && <p className="wine-management__producer">{articleProject.publication}</p>}
                <p>Drafting: {readableStatus(articleProject.drafting_status)}</p>
                <p className={articleProject.overdue ? "wine-management__error" : undefined}>Deadline: {deadlineLabel(articleProject)}</p>
                <p>{articleProject.counts.total} tracked vintage{articleProject.counts.total === 1 ? "" : "s"} · {articleProject.counts.tasted} tasted</p>
                <p>Owner: {articleProject.created_by.display_name || "Unknown"}</p>
                <Link className="wine-btn wine-btn--secondary" to={`/article-projects/${articleProject.id}`}>View project</Link>
              </article>
            ))}
          </div>
          <Pagination page={list.page} totalPages={list.totalPages} totalCount={list.totalCount} onPageChange={list.setPage} />
        </>
      )}
    </div>
  )
}

export default ArticleProjects