import React from "react";
import { formatNumber, formatPercent, formatDate } from "../../utils/format";

interface ContentTableProps {
  rows: any[];
  total: number;
  page: number;
  perPage: number;
  sort: string;
  direction: string;
  loading: boolean;
  onSort: (field: string) => void;
  onPageChange: (page: number) => void;
  onRowClick: (row: any) => void;
}

const getTypeBadgeClass = (type: string) => {
  switch (type) {
    case "Article": return "badge-article";
    case "Review": return "badge-review";
    case "Wine": return "badge-wine";
    default: return "";
  }
};

export const ContentTable: React.FC<ContentTableProps> = ({
  rows,
  total,
  page,
  perPage,
  sort,
  direction,
  loading,
  onSort,
  onPageChange,
  onRowClick,
}) => {
  const SortIcon = ({ field }: { field: string }) => (
    <span className="sort-icon">
      {sort === field ? (direction === "asc" ? " ▲" : " ▼") : " ⇅"}
    </span>
  );

  const sortableHeader = (label: string, field: string) => (
    <th onClick={() => onSort(field)} className="sortable" style={{ cursor: "pointer" }}>
      {label} <SortIcon field={field} />
    </th>
  );

  if (loading) return <div className="table-loading">Loading…</div>;
  if (rows.length === 0) return <div className="table-empty">No content found for this period.</div>;

  return (
    <div className="content-table-wrapper">
      <table className="content-table" role="grid">
        <thead>
          <tr>
            {sortableHeader("Title", "title")}
            {sortableHeader("Type", "content_type")}
            {sortableHeader("Published", "published_at")}
            {sortableHeader("Author", "author_name")}
            {sortableHeader("Views", "views")}
            {sortableHeader("Unique Viewers", "unique_viewers")}
            {sortableHeader("Likes", "likes")}
            {sortableHeader("Comments", "comments")}
            {sortableHeader("Replies", "replies")}
            {sortableHeader("Engagement", "engagement_rate")}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.content_type}-${row.content_id}`}
              onClick={() => onRowClick(row)}
              className="clickable-row"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onRowClick(row); }}
            >
              <td className="content-title">{row.title}</td>
              <td><span className={`content-type-badge ${getTypeBadgeClass(row.content_type)}`}>{row.content_type}</span></td>
              <td>{row.published_at ? formatDate(row.published_at) : "—"}</td>
              <td>{row.author_name || "—"}</td>
              <td className="numeric">{formatNumber(row.views)}</td>
              <td className="numeric">{formatNumber(row.unique_viewers)}</td>
              <td className="numeric">{formatNumber(row.likes)}</td>
              <td className="numeric">{formatNumber(row.comments)}</td>
              <td className="numeric">{formatNumber(row.replies)}</td>
              <td className="numeric">{row.engagement_denominator_zero ? "—" : formatPercent(row.engagement_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination" role="navigation" aria-label="Pagination">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          Previous
        </button>
        <span aria-live="polite">Page {page} of {Math.ceil(total / perPage)} ({total} total)</span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page * perPage >= total}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
};