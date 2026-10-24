import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import PageHero from "./PageHero";
import { producersApi, winesApi } from "../services/api";
import { errorMessage } from "../utils/errors";
import WineTable from "./WineTable";
import Pagination from "./Pagination";
import usePagedList from "../hooks/usePagedList";
import type { Producer } from "../types/producer";
import type { WineListItem } from "../types/wine";
import type { QueryParams } from "../types/common";

function ProducerWines() {
  const { slug } = useParams<{ slug: string }>();
  const [producer, setProducer] = useState<Producer | null>(null);
  // Tracked separately so the wine list can show a loading state while the
  // producer itself is still resolving (list stays disabled until producer?.id
  // exists — without this the page flashed "No wines found for this producer.").
  const [producerLoading, setProducerLoading] = useState(true);
  const [producerError, setProducerError] = useState<string | null>(null);

  const list = usePagedList<WineListItem>({
    fetcher: (params: QueryParams) =>
      winesApi.list({ ...params, producer_id: producer?.id }),
    enabled: Boolean(producer?.id),
  });

  useEffect(() => {
    if (!slug) return;
    setProducerLoading(true);
    setProducerError(null);
    producersApi
      .show(slug)
      .then((data) => {
        setProducer(data);
      })
      .catch((err: unknown) => {
        setProducer(null);
        setProducerError(errorMessage(err, "Failed to load producer"));
      })
      .finally(() => setProducerLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (producerLoading || list.loading) {
    return (
      <div className="wine-app">
        <p className="wine-management__loading">Loading wines…</p>
      </div>
    );
  }

  if (producerError || list.error) {
    return (
      <div className="wine-app">
        <p className="wine-management__error">
          {producerError ?? list.error}
        </p>
        <button className="auth-form__submit" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (!producer) return null;

  return (
    <div className="wine-app">
      <Link to="/producers" className="wine-detail__back">
        &larr; Back to Producers
      </Link>
      <PageHero
        kicker="Cellar"
        title={`Wines of ${producer.name}`}
      />

      {list.items.length === 0 ? (
        <div className="wine-management__empty">
          <p>No wines found for this producer.</p>
        </div>
      ) : (
        <>
          <WineTable
            wines={list.items}
            onDeleted={() => list.reload()}
            linkContext={{
              type: "producer",
              id: producer.id,
              name: producer.name,
            }}
            onWineLinked={() => list.reload()}
          />
          <Pagination
            page={list.page}
            totalPages={list.totalPages}
            totalCount={list.totalCount}
            onPageChange={list.setPage}
            alwaysShow={list.totalPages > 1}
          />
        </>
      )}
    </div>
  );
}

export default ProducerWines;
