import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import LinkWineDialog from "./LinkWineDialog";
import { useReturnToLink } from "../hooks/useReturnToLink";
import { winesApi } from "../services/api";
import type { WineListItem } from "../types/wine";
import type { LinkEntityContext } from "../types/common";

interface WineTableProps {
  wines: WineListItem[];
  linkContext?: LinkEntityContext | undefined;
  onWineLinked?: (() => void) | undefined;
  onDeleted?: ((deleted: WineListItem) => void) | undefined;
}

// Shared table of wines (one wine per row): Name, Producer, Regions,
// Vintages count and Edit actions for wine managers.
// When `linkContext` is provided, shows a "Link a Wine" button that opens
// a dialog to search and link wines to the given entity.
function WineTable({
  wines,
  linkContext,
  onWineLinked,
  onDeleted,
}: WineTableProps) {
  const { user } = useAuth();
  const canManageWines = canManageWinesRole(user);
  const navigate = useNavigate();
  const returnToLink = useReturnToLink();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const excludeIds = Array.isArray(wines)
    ? wines.flatMap((w) => [w.id, w.slug].filter(Boolean))
    : [];

  const handleDelete = async (wine: WineListItem) => {
    if (!window.confirm(`Delete wine "${wine.name}"?`)) return;
    setDeletingSlug(wine.slug);
    try {
      await winesApi.destroy(wine.slug);
      onDeleted?.(wine);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete wine");
    } finally {
      setDeletingSlug(null);
    }
  };

  if (!Array.isArray(wines) || wines.length === 0) {
    return (
      <>
        {canManageWines && linkContext && (
          <div style={{ margin: "0 0 1rem" }}>
            <button
              type="button"
              className="btn-action"
              onClick={() => setDialogOpen(true)}
            >
              + Link a Wine
            </button>
          </div>
        )}
        <p className="wine-management__empty-state">No wines yet.</p>
        {dialogOpen && linkContext && (
          <LinkWineDialog
            entityType={linkContext.type}
            entityId={linkContext.id}
            entityName={linkContext.name}
            excludeIds={excludeIds}
            onClose={() => setDialogOpen(false)}
            onLinked={() => {
              setDialogOpen(false);
              onWineLinked?.();
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      {canManageWines && linkContext && (
        <div style={{ margin: "0 0 1rem" }}>
          <button
            type="button"
            className="btn-action"
            onClick={() => setDialogOpen(true)}
          >
            + Link a Wine
          </button>
        </div>
      )}
      <table className="grapes-table producers-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Producer</th>
            <th>Regions</th>
            <th>Grapes</th>
            <th>Vintages</th>
            {canManageWines && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {wines.map((wine, index) => (
            <tr
              key={wine.slug || wine.id}
              className={
                index % 2 === 0 ? "grapes-row--even" : "grapes-row--odd"
              }
              onClick={() => navigate(returnToLink(`/wines/${wine.slug}`))}
              style={{ cursor: "pointer" }}
            >
              <td>
                <Link
                  to={returnToLink(`/wines/${wine.slug}`)}
                  className="grapes-table__link"
                  onClick={(e) => e.stopPropagation()}
                >
                  {wine.name}
                </Link>
              </td>
              <td>
                {wine.producer ? (
                  <Link
                    to={returnToLink(`/producers/${wine.producer.slug}`)}
                    className="grapes-table__link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {wine.producer.name}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td>
                {Array.isArray(wine.regions) && wine.regions.length > 0
                  ? wine.regions.map((region, regionIndex) => (
                      <span key={region.id || regionIndex}>
                        {regionIndex > 0 && ", "}
                        <Link
                          to={returnToLink(`/regions/${region.slug}`)}
                          className="grapes-table__link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {region.name}
                        </Link>
                      </span>
                    ))
                  : "—"}
              </td>
              <td>
                {Array.isArray(wine.grapes) && wine.grapes.length > 0
                  ? wine.grapes.map((grape, grapeIndex) => (
                      <span key={grape.id || grapeIndex}>
                        {grapeIndex > 0 && ", "}
                        <Link
                          to={returnToLink(`/grapes/${grape.slug}`)}
                          className="grapes-table__link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {grape.name}
                        </Link>
                      </span>
                    ))
                  : "—"}
              </td>
              <td>
                {(wine.vintages_count ?? 0) > 0
                  ? `${wine.vintages_count} vintage${
                      wine.vintages_count !== 1 ? "s" : ""
                    }`
                  : "—"}
              </td>
              {canManageWines && (
                <td className="actions">
                  <Link
                    to={`/wines/${wine.slug}/edit`}
                    className="btn-action"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="btn-action btn-action--delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(wine);
                    }}
                    disabled={deletingSlug === wine.slug}
                  >
                    {deletingSlug === wine.slug ? "Deleting…" : "Delete"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {dialogOpen && linkContext && (
        <LinkWineDialog
          entityType={linkContext.type}
          entityId={linkContext.id}
          entityName={linkContext.name}
          excludeIds={excludeIds}
          onClose={() => setDialogOpen(false)}
          onLinked={() => {
            setDialogOpen(false);
            onWineLinked?.();
          }}
        />
      )}
    </>
  );
}

export default WineTable;
