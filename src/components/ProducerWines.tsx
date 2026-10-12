import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { producersApi, winesApi } from "../services/api";
import { errorMessage } from "../utils/errors";
import WineTable from "./WineTable";
import type { Producer } from "../types/producer";
import type { WineListItem } from "../types/wine";

function ProducerWines() {
  const { slug } = useParams<{ slug: string }>();
  const [producer, setProducer] = useState<Producer | null>(null);
  const [wines, setWines] = useState<WineListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function loadWines() {
    if (!slug) return;
    try {
      setLoading(true);
      setError(null);
      const producerData = await producersApi.show(slug);
      setProducer(producerData);
      const winesData = await winesApi.list({ producer_id: producerData.id });
      setWines(Array.isArray(winesData) ? winesData : winesData.items);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load wines"));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="wine-app">
        <p className="wine-management__loading">Loading wines…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wine-app">
        <p className="wine-management__error">{error}</p>
        <button className="auth-form__submit" onClick={loadWines}>
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
      <div className="wine-management__header">
        <div>
          <p className="wine-kicker">Cellar</p>
          <h1>Wines of {producer ? producer.name : "Producer"}</h1>
        </div>
      </div>

      {wines.length === 0 ? (
        <div className="wine-management__empty">
          <p>No wines found for this producer.</p>
        </div>
      ) : (
        <WineTable
          wines={wines}
          onDeleted={(deleted) =>
            setWines((prev) => prev.filter((w) => w.slug !== deleted.slug))
          }
          linkContext={{
            type: "producer",
            id: producer.id,
            name: producer.name,
          }}
          onWineLinked={loadWines}
        />
      )}
    </div>
  );
}

export default ProducerWines;
