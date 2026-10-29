import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LinkProducerDialog from "./LinkProducerDialog";
import { useReturnToLink } from "../hooks/useReturnToLink";
import type { Producer } from "../types/producer";
import type { LinkEntityContext } from "../types/common";
import type { Image } from "../types/image";

// The API returns producer images as a list of URL strings; older payloads
// may contain full image objects, so normalise both shapes to a URL.
function imageSrc(image: string | Image | undefined): string {
  if (typeof image === "string") return image;
  return image?.url ?? "";
}

interface ProducerTableProps {
  producers: Producer[];
  canManage?: boolean | undefined;
  /** When present, renders the "Link a Producer" action for the given entity. */
  linkContext?: LinkEntityContext | undefined;
  onProducerLinked?: (() => void) | undefined;
}

// Reusable producers table (image · name · country · type · status ·
// address · email · wines · actions). Used by ProducerList and any other
// page that needs to render a list of producers.
// When `linkContext` is provided, shows a "Link a Producer" button that
// opens a dialog to search and link producers to the given entity.
function ProducerTable({
  producers,
  canManage = false,
  linkContext,
  onProducerLinked,
}: ProducerTableProps) {
  const navigate = useNavigate();
  const returnToLink = useReturnToLink();
  const [dialogOpen, setDialogOpen] = useState(false);
  const excludeIds = Array.isArray(producers)
    ? producers.flatMap((p) => [p.id, p.slug].filter(Boolean))
    : [];

  if (!Array.isArray(producers) || producers.length === 0) {
    return (
      <>
        {canManage && linkContext && (
          <div style={{ margin: "0 0 1rem" }}>
            <button
              type="button"
              className="btn-action"
              onClick={() => setDialogOpen(true)}
            >
              + Link a Producer
            </button>
          </div>
        )}
        <p className="wine-management__empty-state">No producers yet.</p>
        {dialogOpen && linkContext && (
          <LinkProducerDialog
            entityType={linkContext.type}
            entityId={linkContext.id}
            entityName={linkContext.name}
            excludeIds={excludeIds}
            onClose={() => setDialogOpen(false)}
            onLinked={() => {
              setDialogOpen(false);
              onProducerLinked?.();
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      {canManage && linkContext && (
        <div style={{ margin: "0 0 1rem" }}>
          <button
            type="button"
            className="btn-action"
            onClick={() => setDialogOpen(true)}
          >
            + Link a Producer
          </button>
        </div>
      )}
      <table className="grapes-table producers-table">
        <thead>
          <tr>
            <th className="producers-table__image-col">Image</th>
            <th>Name</th>
            <th>Country</th>
            <th>Type</th>
            <th>Wines</th>
            {canManage && (
              <>
                <th>Address</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {producers.map((producer, index) => (
            <tr
              key={producer.slug}
              className={
                index % 2 === 0 ? "grapes-row--even" : "grapes-row--odd"
              }
              onClick={() =>
                navigate(returnToLink(`/producers/${producer.slug}`))
              }
              style={{ cursor: "pointer" }}
            >
              <td>
                {producer.logo_url ? (
                  <img
                    src={producer.logo_url}
                    alt={producer.name}
                    className="producers-table__thumb"
                  />
                ) : Array.isArray(producer.images) &&
                  producer.images.length > 0 ? (
                  <img
                    src={imageSrc(producer.images[0])}
                    alt={producer.name}
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
                  to={returnToLink(`/producers/${producer.slug}`)}
                  className="grapes-table__link"
                  onClick={(e) => e.stopPropagation()}
                >
                  {producer.name}
                </Link>
              </td>
              <td>
                {producer.country
                  ? `${producer.country.flag_emoji || ""} ${producer.country.name}`.trim()
                  : "—"}
              </td>
              <td>
                {producer.producer_type
                  ? producer.producer_type
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                  : "—"}
              </td>
              <td>
                {(producer.wines_count ?? producer.wines?.length ?? 0) > 0 ? (
                  <Link
                    to={`/producers/${producer.slug}/wines`}
                    className="grapes-table__link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {`${producer.wines_count ?? producer.wines?.length ?? 0} wine${
                      (producer.wines_count ?? producer.wines?.length ?? 0) !==
                      1
                        ? "s"
                        : ""
                    }`}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              {canManage && (
                <>
                  <td>{producer.address?.street_address || "—"}</td>
                  <td>{producer.email || "—"}</td>

                  <td>{producer.active === false ? "Inactive" : "Active"}</td>
                  <td className="actions">
                    <Link
                      to={`/producers/${producer.slug}/edit`}
                      className="btn-action"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Edit
                    </Link>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {dialogOpen && linkContext && (
        <LinkProducerDialog
          entityType={linkContext.type}
          entityId={linkContext.id}
          entityName={linkContext.name}
          excludeIds={excludeIds}
          onClose={() => setDialogOpen(false)}
          onLinked={() => {
            setDialogOpen(false);
            onProducerLinked?.();
          }}
        />
      )}
    </>
  );
}

export default ProducerTable;
