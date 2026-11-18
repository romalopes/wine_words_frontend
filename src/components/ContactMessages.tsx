import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { contactApi } from "../services/api"
import { useAuth } from "../contexts/AuthContext"
import { canManageContactMessages } from "../constants/roles"
import {
  CONTACT_MESSAGE_STATUS_FILTERS,
  CONTACT_TYPES,
  contactTypeLabel,
} from "../constants/contact"
import usePagedList from "../hooks/usePagedList"
import Pagination from "./Pagination"
import DetailHero from "./DetailHero"
import { formatDate } from "../utils/dates"
import styles from "./contact.module.css"
import type { ContactMessage } from "../types/contact"

/**
 * Contact Messages inbox (IDENTITY_209 Phase 4).
 *
 * Visible to Editors and Admins only. The API independently enforces the same
 * rule (ContactMessagePolicy), so hiding the menu is not the security boundary.
 * Newest first, searchable, filterable and paginated; the body is only loaded
 * on the detail page.
 */
export default function ContactMessages() {
  const { user } = useAuth()
  const allowed = canManageContactMessages(user)
  const [searchParams, setSearchParams] = useSearchParams()

  const status = searchParams.get("status") || ""
  const contactType = searchParams.get("contact_type") || ""
  const search = searchParams.get("search") || ""
  const [searchDraft, setSearchDraft] = useState(search)
  const [unreadCount, setUnreadCount] = useState(0)

  const list = usePagedList<ContactMessage>({
    enabled: allowed,
    fetcher: async (params) => {
      const response = await contactApi.list(params)
      setUnreadCount(response.unread_count ?? 0)
      return {
        items: response.items,
        page: response.page,
        per_page: response.per_page ?? 20,
        total_count: response.total_count ?? response.items.length,
        total_pages: response.total_pages,
      }
    },
    extraParams: { status, contact_type: contactType, search },
  })

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete("page")
    setSearchParams(params)
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilter("search", searchDraft.trim())
  }

  if (!allowed) {
    return (
      <div className="wine-app">
        <DetailHero
          title="Contact messages"
          intro="This page is restricted to Editor and Admin accounts."
        />
      </div>
    )
  }

  return (
    <div className="wine-app">
      <DetailHero
        title="Contact messages"
        intro="Messages sent through the public Contact form, newest first."
      />

      <div className={styles.inbox}>
        <div className={styles.filterBar}>
          <form className={styles.searchForm} onSubmit={submitSearch}>
            <label htmlFor="contact-search" className={styles.srOnly}>
              Search messages
            </label>
            <input
              id="contact-search"
              type="search"
              placeholder="Search sender, email or subject…"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
            <button type="submit" className="wine-btn wine-btn--primary">
              Search
            </button>
            {search && (
              <button
                type="button"
                className="wine-btn wine-btn--secondary"
                onClick={() => {
                  setSearchDraft("")
                  setFilter("search", "")
                }}
              >
                Clear search
              </button>
            )}
          </form>

          <label htmlFor="contact-type-filter" className={styles.srOnly}>
            Filter by category
          </label>
          <select
            id="contact-type-filter"
            value={contactType}
            onChange={(event) => setFilter("contact_type", event.target.value)}
          >
            <option value="">All categories</option>
            {CONTACT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Message status">
          {CONTACT_MESSAGE_STATUS_FILTERS.map((filter) => {
            const active =
              status === filter.value || (filter.value === "all" && status === "")
            return (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                onClick={() =>
                  setFilter("status", filter.value === "all" ? "" : filter.value)
                }
              >
                {filter.label}
                {filter.value === "unread" && unreadCount > 0 && (
                  <span className={styles.countBadge}>{unreadCount}</span>
                )}
              </button>
            )
          })}
        </div>

        {list.loading ? (
          <p className={styles.muted}>Loading messages…</p>
        ) : list.error ? (
          <div className={styles.card}>
            <p className={styles.error} role="alert">
              {list.error}
            </p>
            <button
              type="button"
              className="wine-btn wine-btn--primary"
              onClick={list.reload}
            >
              Retry
            </button>
          </div>
        ) : list.items.length === 0 ? (
          <div className={styles.card}>
            <p className={styles.muted}>No messages match these filters.</p>
          </div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Sender</th>
                    <th scope="col">Category</th>
                    <th scope="col">Subject</th>
                    <th scope="col">Received</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className={styles.srOnly}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((message) => (
                    <tr
                      key={message.id}
                      className={
                        message.status === "unread" ? styles.unreadRow : undefined
                      }
                    >
                      <td>
                        <strong>{message.name}</strong>
                        <div className={styles.muted}>{message.email}</div>
                      </td>
                      <td>{contactTypeLabel(message.contact_type)}</td>
                      <td>
                        <Link
                          to={`/settings/contact-messages/${message.id}`}
                          className={styles.subjectLink}
                        >
                          {message.subject}
                        </Link>
                      </td>
                      <td>{formatDate(message.created_at)}</td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${styles[`status-${message.status}`]}`}
                        >
                          {message.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/settings/contact-messages/${message.id}`}
                          className="wine-btn wine-btn--ghost wine-btn--sm"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={list.page}
              totalPages={list.totalPages}
              totalCount={list.totalCount}
              onPageChange={list.setPage}
            />
          </>
        )}
      </div>
    </div>
  )
}

