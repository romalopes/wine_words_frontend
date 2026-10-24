import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { articlesApi, reviewsApi } from "../services/api"
import { useAuth } from "../contexts/AuthContext"
import { canManageWinesRole } from "../constants/roles"
import usePagedList from "../hooks/usePagedList"
import Pagination from "./Pagination"
import DeadlineBadge from "./DeadlineBadge"
import { formatDate, formatDateTime } from "../utils/dates"
import { errorMessage } from "../utils/errors"
import type { Article } from "../types/article"
import type { Review } from "../types/review"
import type { QueryParams } from "../types/common"
import "./ContentManagementList.css"
import DetailHero from "./DetailHero"

type ContentKind = "review" | "article"
type ContentItem = Review | Article
type ContentStatus = "draft" | "published" | "archived"

interface ContentManagementListProps { kind: ContentKind }

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" }, { value: "draft", label: "Draft" },
  { value: "published", label: "Published" }, { value: "archived", label: "Archived" },
] as const
const DEADLINE_OPTIONS = [
  { value: "", label: "All deadlines" }, { value: "overdue", label: "Overdue" },
  { value: "due_soon", label: "Due soon (next 7 days)" }, { value: "none", label: "No deadline" },
  { value: "has", label: "Has deadline" },
] as const
const SORT_OPTIONS = [
  { value: "created_desc", label: "Created: newest first" }, { value: "created_asc", label: "Created: oldest first" },
  { value: "updated_desc", label: "Updated: newest first" }, { value: "updated_asc", label: "Updated: oldest first" },
  { value: "deadline_asc", label: "Deadline: earliest first" }, { value: "deadline_desc", label: "Deadline: latest first" },
  { value: "title_asc", label: "Title: A–Z" }, { value: "title_desc", label: "Title: Z–A" },
  { value: "published_desc", label: "Published: newest first" }, { value: "published_asc", label: "Published: oldest first" },
] as const

function paramValue(params: URLSearchParams, key: string, allowed: readonly string[], fallback = ""): string {
  const value = params.get(key) ?? fallback
  return allowed.includes(value) ? value : fallback
}

function contentImage(item: ContentItem, isReview: boolean): string | null {
  if (item.primary_image) return item.primary_image
  if (item.images?.[0]) return item.images[0]
  if (isReview) return (item as Review).wine_image ?? null
  return null
}

function ContentManagementList({ kind }: ContentManagementListProps) {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const canManage = canManageWinesRole(user)
  const isReview = kind === "review"
  const singular = isReview ? "Review" : "Article"
  const plural = isReview ? "Reviews" : "Articles"
  const basePath = `/settings/${kind}s`
  const [searchInput, setSearchInput] = useState(searchParams.get("query") ?? "")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const scope = paramValue(searchParams, "scope", ["", "mine"])
  const status = paramValue(searchParams, "status", STATUS_OPTIONS.map((option) => option.value))
  const deadline = paramValue(searchParams, "deadline", DEADLINE_OPTIONS.map((option) => option.value))
  const sort = paramValue(searchParams, "sort", SORT_OPTIONS.map((option) => option.value), "created_desc")
  const query = searchParams.get("query") ?? ""

  useEffect(() => setSearchInput(query), [query])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim()
      if (next === query) return
      const params = new URLSearchParams(searchParams)
      if (next) params.set("query", next)
      else params.delete("query")
      params.delete("page")
      setSearchParams(params, { replace: true })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query, searchInput, searchParams, setSearchParams])

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value); else params.delete(key)
    params.delete("page")
    setSearchParams(params)
  }
  const clearFilters = () => setSearchParams(sort === "created_desc" ? {} : { sort })
  const extraParams = useMemo<QueryParams>(() => ({ query: query || undefined, scope: scope || undefined, status: status || undefined, deadline: deadline || undefined, sort }), [deadline, query, scope, sort, status])
  const list = usePagedList<ContentItem>({ enabled: canManage, fetcher: (params) => isReview ? reviewsApi.all(params) : articlesApi.list(params), extraParams })
  const hasActiveFilters = Boolean(query || scope || status || deadline || sort !== "created_desc")
  const currentPath = `${basePath}${searchParams.size ? `?${searchParams.toString()}` : ""}`
  const detailPath = (item: ContentItem, edit = false) => `/${kind}s/${item.slug ?? item.id}${edit ? "/edit" : ""}?returnTo=${encodeURIComponent(currentPath)}`

  async function changeStatus(item: ContentItem, next: ContentStatus) {
    if (item.status === next || busyId !== null) return
    try {
      setBusyId(item.id); setActionError(null)
      const payload = next === "published" && !item.published_at ? { status: next, published_at: new Date().toISOString() } : { status: next }
      if (isReview) await reviewsApi.updateStatus(item.id, payload); else await articlesApi.updateStatus(item.id, payload)
      list.patchItem(item.id, { status: next, published_at: payload.published_at ?? item.published_at } as Partial<ContentItem>)
    } catch (error) { setActionError(errorMessage(error, `Failed to update ${singular.toLowerCase()}`)) }
    finally { setBusyId(null) }
  }

  if (!canManage) return <main className="wine-app"><Link to={isReview ? "/reviews" : "/articles"} className="wine-detail__back">&larr; Back to {plural}</Link><DetailHero kicker="Settings" title={`Manage ${plural}`} intro="Access denied. You do not have permission to manage content." /><p className="wine-management__error" role="alert">You do not have permission to manage {plural.toLowerCase()}.</p></main>

  return <main className="wine-app">
    <Link to={isReview ? "/reviews" : "/articles"} className="wine-detail__back">
      &larr; Back to {plural}
    </Link>
    <DetailHero
      kicker="Settings"
      title={`Manage ${plural}`}
      intro="Search, filter, and update content using your existing permissions."
      actions={
        <Link to={`/${kind}s?new=true`} className="auth-form__submit">
          + Add {singular}
        </Link>
      }
    />
    <section className="content-management__toolbar" aria-label={`${plural} filters`}>
      <label className="content-management__field"><span>Search</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={`Search ${plural.toLowerCase()}…`} /></label>
      <label className="content-management__field"><span>Status</span><select value={status} onChange={(event) => setFilter("status", event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="content-management__field"><span>Deadline</span><select value={deadline} onChange={(event) => setFilter("deadline", event.target.value)}>{DEADLINE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="content-management__field"><span>Sort</span><select value={sort} onChange={(event) => setFilter("sort", event.target.value)}>{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="content-management__mine"><input type="checkbox" checked={scope === "mine"} onChange={(event) => setFilter("scope", event.target.checked ? "mine" : "")} />My {plural}</label>
      {hasActiveFilters && <button type="button" className="content-management__clear" onClick={clearFilters}>Clear filters</button>}
    </section>
    <section aria-label={`${plural} results`} aria-busy={list.loading}>
      {actionError && <p className="wine-management__error" role="alert">{actionError}</p>}
      {list.loading ? <p className="wine-management__loading" role="status">Loading {plural.toLowerCase()}…</p> : list.error ? <div role="alert"><p className="wine-management__error">{list.error}</p><button type="button" className="auth-form__submit" onClick={list.reload}>Retry</button></div> : list.items.length === 0 ? <div className="wine-management__empty"><p>{hasActiveFilters ? `No ${plural.toLowerCase()} match your filters.` : `No ${plural.toLowerCase()} found.`}</p></div> : <>
        <p className="content-management__count">{list.totalCount} {list.totalCount === 1 ? singular.toLowerCase() : plural.toLowerCase()}</p>
        <div className="content-management__table-wrap"><table className="grapes-table producers-table content-management__table"><thead><tr><th className="producers-table__image-col">Image</th><th>{isReview ? "Title / wine" : "Title"}</th><th>Author</th><th>Status</th><th>Deadline</th><th>Created</th><th>Updated</th>{!isReview && <th>Published</th>}<th>Actions</th></tr></thead><tbody>{list.items.map((item, index) => <tr key={item.id} className={index % 2 === 0 ? "grapes-row--even" : "grapes-row--odd"}>
          <td>{contentImage(item, isReview) ? <img src={contentImage(item, isReview) ?? undefined} alt={item.title} className="producers-table__thumb" /> : <span className="producers-table__thumb producers-table__thumb--empty" aria-hidden="true" />}</td><td><Link className="grapes-table__link" to={detailPath(item)}>{item.title}</Link>{isReview && <span className="content-management__subtext">{(item as Review).wine_name ?? "—"}{(item as Review).vintage_year ? ` · ${(item as Review).vintage_year}` : ""}</span>}</td><td>{isReview ? (item as Review).reviewer_name ?? "—" : (item as Article).author_name ?? "—"}</td><td><span className={`content-management__status content-management__status--${item.status}`}>{item.status}</span></td><td><DeadlineBadge deadline={item.deadline} status={item.status} overdue={item.overdue} daysUntilDeadline={item.days_until_deadline} />{!item.deadline && "—"}</td><td>{formatDateTime(item.created_at) ?? "—"}</td><td>{formatDateTime(item.updated_at) ?? "—"}</td>{!isReview && <td>{formatDate((item as Article).published_at) ?? "—"}</td>}<td><div className="content-management__actions"><Link className="btn-action" to={detailPath(item)}>View</Link><Link className="btn-action" to={detailPath(item, true)}>Edit</Link>{item.status !== "published" && <button type="button" className="btn-action" disabled={busyId === item.id} onClick={() => void changeStatus(item, "published")}>Publish</button>}{item.status !== "draft" && <button type="button" className="btn-action" disabled={busyId === item.id} onClick={() => void changeStatus(item, "draft")}>Unpublish</button>}{item.status !== "archived" && <button type="button" className="btn-action" disabled={busyId === item.id} onClick={() => void changeStatus(item, "archived")}>Archive</button>}</div></td>
        </tr>)}</tbody></table></div>
        <Pagination page={list.page} totalPages={list.totalPages} totalCount={list.totalCount} onPageChange={list.setPage} />
      </>}
    </section>
  </main>
}

export function ReviewsManagement() { return <ContentManagementList kind="review" /> }
export function ArticlesManagement() { return <ContentManagementList kind="article" /> }