import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import LinkArticleDialog from "./LinkArticleDialog";
import DeadlineBadge from "./DeadlineBadge";
import { useReturnToLink } from "../hooks/useReturnToLink";
import type { Article } from "../types/article";

/**
 * The entity an article is linked to. Like reviews, articles can only be
 * attached to a category — `linkArticle` exists on `categoriesApi` alone — so
 * `type` is pinned to "category" rather than widened to `LinkEntityType`.
 * Widening it would let a call site pass e.g. "grape" and have it silently
 * ignored, since the dialog always posts to `/categories/:id/link_article`.
 */
export interface ArticleLinkContext {
  type: "category"
  id: number
  name: string
}

interface ArticleTableProps {
  articles: Article[];
  /** When set, management users get a "+ Link an Article" action. */
  linkContext?: ArticleLinkContext;
  onArticleLinked?: () => void;
}

// Shared table of articles (one article per row): Title, Author, Status and
// Published date. Rows navigate to the article detail page.
// When `linkContext` is provided, shows a "+ Link an Article" button that
// opens a dialog to search and link articles to the given entity.
function ArticleTable({ articles, linkContext, onArticleLinked }: ArticleTableProps) {
  const { user } = useAuth();
  const canManage = canManageWinesRole(user);
  const navigate = useNavigate();
  const returnToLink = useReturnToLink();
  const [dialogOpen, setDialogOpen] = useState(false);
  const excludeIds = Array.isArray(articles)
    ? articles.flatMap((a) => [a.id, a.slug].filter(Boolean) as (number | string)[])
    : [];

  const linkButton = canManage && linkContext && (
    <div style={{ margin: "0 0 1rem" }}>
      <button
        type="button"
        className="btn-action"
        onClick={() => setDialogOpen(true)}
      >
        + Link an Article
      </button>
    </div>
  );

  if (!Array.isArray(articles) || articles.length === 0) {
    return (
      <>
        {linkButton}
        <p className="wine-management__empty-state">No articles yet.</p>
        {linkContext && dialogOpen && (
          <LinkArticleDialog
            entityId={linkContext.id}
            entityName={linkContext.name}
            excludeIds={excludeIds}
            onClose={() => setDialogOpen(false)}
            onLinked={() => {
              setDialogOpen(false);
              onArticleLinked?.();
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      {linkButton}
      <table className="grapes-table producers-table">
        <thead>
          <tr>
            <th className="producers-table__image-col">Image</th>
            <th>Title</th>
            <th>Author</th>
            <th>Status</th>
            <th>Deadline</th>
            <th>Published</th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article, index) => (
            <tr
              key={article.slug || article.id}
              className={index % 2 === 0 ? "grapes-row--even" : "grapes-row--odd"}
              onClick={() => navigate(returnToLink(`/articles/${article.slug}`))}
              style={{ cursor: "pointer" }}
            >
              <td>
                {article.primary_image || article.images?.[0] ? (
                  <img
                    src={article.primary_image || article.images?.[0]}
                    alt={article.title}
                    className="producers-table__thumb"
                  />
                ) : (
                  <span
                    className="producers-table__thumb producers-table__thumb--empty"
                    aria-hidden="true"
                  />
                )}
              </td>
              <td>
                <Link
                  to={returnToLink(`/articles/${article.slug}`)}
                  className="grapes-table__link"
                  onClick={(e) => e.stopPropagation()}
                >
                  {article.title}
                </Link>
              </td>
              <td>{article.author_name || "—"}</td>
              <td>{article.status || "—"}</td>
              <td>
                <DeadlineBadge
                  deadline={article.deadline}
                  status={article.status}
                  overdue={article.overdue}
                  daysUntilDeadline={article.days_until_deadline}
                />
              </td>
              <td>
                {article.published_at
                  ? new Date(article.published_at).toLocaleDateString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {linkContext && dialogOpen && (
        <LinkArticleDialog
          entityId={linkContext.id}
          entityName={linkContext.name}
          excludeIds={excludeIds}
          onClose={() => setDialogOpen(false)}
          onLinked={() => {
            setDialogOpen(false);
            onArticleLinked?.();
          }}
        />
      )}
    </>
  );
}

export default ArticleTable;