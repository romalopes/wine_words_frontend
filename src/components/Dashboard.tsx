import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { articlesApi, reviewsApi, statsApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import ArticleCard from "./ArticleCard";
import ReviewCard from "./ReviewCard";
import type { Article } from "../types/article";
import type { Review } from "../types/review";
import type { Stats } from "../types/stats";

/** One promo card on the dashboard. `statKey` indexes the API stats payload. */
interface DashboardCard {
  title: string;
  statKey: keyof Stats;
  tone: "neutral" | "gold" | "rose";
  to: string;
  cta: string;
}

const dashboardCards: DashboardCard[] = [
  { title: "Producers", statKey: "producers", tone: "neutral", to: "/producers", cta: "Browse wineries →" },
  { title: "Wines", statKey: "wines", tone: "gold", to: "/wines", cta: "Explore the catalogue →" },
  { title: "Reviews", statKey: "reviews", tone: "rose", to: "/reviews", cta: "Read reviews →" },
  { title: "Articles", statKey: "articles", tone: "gold", to: "/articles", cta: "Read articles →" },
];

const EMPTY_STATS: Stats = { producers: 0, wines: 0, reviews: 0, articles: 0 };

/** Rails returns either a bare array or a paginated envelope; keep the array. */
function asArray<T>(response: T[] | { items?: T[] }): T[] {
  return Array.isArray(response) ? response : response.items ?? [];
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);

  useEffect(() => {
    statsApi.get().then(setStats).catch(() => {});
    articlesApi.list().then((data) => setRecentArticles(asArray(data).slice(0, 10))).catch(() => setRecentArticles([]));
    reviewsApi.all().then((data) => setRecentReviews(asArray(data).slice(0, 10))).catch(() => setRecentReviews([]));
  }, []);

  return (
    <main className="wine-app">
      <p className="lede dashboard__lede">
        Welcome{user ? `, ${user.email.split("@")[0]}` : ""} to Wine Words. Your cellar command centre.
      </p>
      {!user && (
        <p className="dashboard__sign-in-prompt">
          <Link className="text-link" to="/login">Sign in or create an account</Link> to save tasting profiles and write reviews.
        </p>
      )}
      <div className="content-grid dashboard__stats-grid">
        {dashboardCards.map((card) => (
          <Link key={card.title} to={card.to} className="dashboard__stat-card">
            <div className={`dashboard__stat-card-band dashboard__stat-card-band--${card.tone}`} />
            <div className="dashboard__stat-card-body">
              <h2 className="dashboard__stat-card-title">{card.title}</h2>
              <p className="dashboard__stat-card-copy">
                {stats[card.statKey] || 0} {card.title.toLowerCase()} in the library.
              </p>
              <span className="dashboard__stat-card-cta">
                {card.cta}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {recentArticles.length > 0 && (
        <>
          <h2 className="dashboard__section-title">Latest Articles</h2>
          <div className="content-grid dashboard__content-grid">
            {recentArticles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onOpen={() => navigate(`/articles/${article.slug || article.id}`)}
              />
            ))}
          </div>
        </>
      )}

      {recentReviews.length > 0 && (
        <>
          <h2 className="dashboard__section-title">Latest Reviews</h2>
          <div className="content-grid">
            {recentReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onOpen={() => navigate(`/reviews/${review.slug || review.id}`)}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

export default Dashboard;
