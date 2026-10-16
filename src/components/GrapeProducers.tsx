import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import usePagedList from "../hooks/usePagedList";
import { grapesApi, producersApi } from "../services/api";
import ProducerTable from "./ProducerTable";
import Pagination from "./Pagination";
import type { GrapeDetail } from "../types/catalog";
import type { Producer } from "../types/producer";
import type { QueryParams } from "../types/common";

// Paginated list of producers for a given grape — mirrors GrapeWines.
function GrapeProducers() {
  const { slug } = useParams<{ slug: string }>();
  const [grape, setGrape] = useState<GrapeDetail | null>(null);
  // Tracked separately so the page shows a loading state while the grape is
  // still resolving (the list stays disabled until grape?.id exists).
  const [grapeLoading, setGrapeLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setGrapeLoading(true);
    grapesApi
      .show(slug)
      .then(setGrape)
      .catch(() => setGrape(null))
      .finally(() => setGrapeLoading(false));
  }, [slug]);

  const producers = usePagedList<Producer>({
    fetcher: (params: QueryParams) =>
      producersApi.list({ grape_id: grape?.id, ...params }),
    enabled: Boolean(grape?.id),
    paramKey: "producer_page",
  });

  return (
    <div className="grapes-page">
      <div className="grapes-page__header">
        <h1>Producers</h1>
        <p className="grapes-page__subtitle">
          Producers using this grape ({producers.totalCount ?? "…"} total).
        </p>
      </div>

      {grapeLoading || producers.loading ? (
        <p className="grapes-page__loading">Loading producers…</p>
      ) : !grape ? (
        <p className="grapes-page__loading">Grape not found.</p>
      ) : (
        <>
          <ProducerTable
            producers={producers.items}
            linkContext={
              grape ? { type: "grape", id: grape.id } : undefined
            }
            onProducerLinked={() => producers.reload()}
          />
          <Pagination
            page={producers.page}
            totalPages={producers.totalPages}
            totalCount={producers.totalCount}
            onPageChange={producers.setPage}
          />
        </>
      )}
    </div>
  );
}

export default GrapeProducers;
