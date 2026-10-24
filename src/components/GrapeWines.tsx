import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHero from "./PageHero";
import { grapesApi, winesApi } from "../services/api";
import WineTable from "./WineTable";
import Pagination from "./Pagination";
import usePagedList from "../hooks/usePagedList";
import type { GrapeDetail } from "../types/catalog";
import type { WineListItem } from "../types/wine";
import type { QueryParams } from "../types/common";

function GrapeWines() {
  const { slug } = useParams<{ slug: string }>();
  const [grape, setGrape] = useState<GrapeDetail | null>(null);
  // Tracked separately so the list can show a loading state while the grape
  // itself is still resolving (list stays disabled until grape?.id exists —
  // without this the page flashed "No wines found for this grape.").
  const [grapeLoading, setGrapeLoading] = useState(true);

  const list = usePagedList<WineListItem>({
    fetcher: (params: QueryParams) =>
      winesApi.list({ ...params, grape_id: grape?.id }),
    enabled: Boolean(grape?.id),
  });

  useEffect(() => {
    if (!slug) return;
    setGrapeLoading(true);
    grapesApi
      .show(slug)
      .then(setGrape)
      .catch(() => setGrape(null))
      .finally(() => setGrapeLoading(false));
  }, [slug]);

  return (
    <div className="wine-app">
      <Link to="/grapes" className="wine-detail__back">
        &larr; Back to Grapes
      </Link>
      <PageHero
        kicker="Cellar"
        title={`Wines of ${grape ? grape.name : "Grape"}`}
      />

      {list.error && (
        <p className="wine-management__error">{list.error}</p>
      )}
      {grapeLoading || list.loading ? (
        <p className="wine-management__loading">Loading wines…</p>
      ) : !grape ? (
        <div className="wine-management__empty">
          <p>Grape not found.</p>
        </div>
      ) : list.items.length === 0 ? (
        <div className="wine-management__empty">
          <p>No wines found for this grape.</p>
        </div>
      ) : (
        <>
          <WineTable
            wines={list.items}
            onDeleted={() => list.reload()}
            linkContext={
              grape
                ? { type: "grape", id: grape.id, name: grape.name }
                : undefined
            }
            onWineLinked={() => list.reload()}
          />
          <Pagination
            page={list.page}
            totalPages={list.totalPages}
            totalCount={list.totalCount}
            onPageChange={list.setPage}
          />
        </>
      )}
    </div>
  );
}

export default GrapeWines;
