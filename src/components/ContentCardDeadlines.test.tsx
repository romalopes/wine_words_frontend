import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ArticleCard from "./ArticleCard";
import ReviewCard from "./ReviewCard";
import type { Article } from "../types/article";
import type { Review } from "../types/review";

// Issue #185: the content cards show the publication deadline, but only for
// drafts. Published and archived content keeps its date server-side and
// renders no badge at all.
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, loading: false }),
}));

vi.mock("../services/api", () => ({
  likesApi: { toggle: vi.fn().mockResolvedValue({ liked: true, likes_count: 1 }) },
}));

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 1,
    title: "A draft article",
    status: "draft",
    author_name: "Wine Words",
    deadline: "2026-10-18",
    overdue: true,
    days_until_deadline: -3,
    ...overrides,
  } as Article;
}

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 1,
    slug: "a-draft-review",
    title: "A draft review",
    status: "draft",
    reviewer_name: "Wine Words",
    deadline: "2026-10-18",
    overdue: true,
    days_until_deadline: -3,
    ...overrides,
  } as Review;
}

function renderArticleCard(article: Article) {
  return render(
    <MemoryRouter>
      <ArticleCard article={article} onOpen={() => {}} />
    </MemoryRouter>,
  );
}

function renderReviewCard(review: Review) {
  return render(
    <MemoryRouter>
      <ReviewCard review={review} onOpen={() => {}} />
    </MemoryRouter>,
  );
}

describe("ArticleCard deadline badge", () => {
  it("shows the overdue deadline on a draft", () => {
    renderArticleCard(makeArticle());

    expect(screen.getByText(/Overdue by 3 days/)).toBeInTheDocument();
  });

  it("shows the due date on an upcoming draft", () => {
    renderArticleCard(
      makeArticle({ deadline: "2026-10-25", overdue: false, days_until_deadline: 4 }),
    );

    expect(screen.getByText(/Due /)).toBeInTheDocument();
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  });

  it("shows no badge for published or archived articles", () => {
    const published = renderArticleCard(
      makeArticle({ status: "published" }),
    );
    expect(published.container.querySelector(".deadline-badge")).toBeNull();

    const archived = renderArticleCard(makeArticle({ status: "archived" }));
    expect(archived.container.querySelector(".deadline-badge")).toBeNull();
  });

  it("shows no badge for a legacy article without a deadline", () => {
    const { container } = renderArticleCard(
      makeArticle({ deadline: undefined, overdue: undefined, days_until_deadline: undefined }),
    );

    expect(container.querySelector(".deadline-badge")).toBeNull();
  });
});

describe("ReviewCard deadline badge", () => {
  it("shows the overdue deadline on a draft", () => {
    renderReviewCard(makeReview());

    expect(screen.getByText(/Overdue by 3 days/)).toBeInTheDocument();
  });

  it("shows 'Due today' when the API reports zero days", () => {
    renderReviewCard(
      makeReview({ deadline: "2026-10-21", overdue: false, days_until_deadline: 0 }),
    );

    expect(screen.getByText(/Due today/)).toBeInTheDocument();
  });

  it("shows no badge for published or archived reviews", () => {
    const published = renderReviewCard(makeReview({ status: "published" }));
    expect(published.container.querySelector(".deadline-badge")).toBeNull();

    const archived = renderReviewCard(makeReview({ status: "archived" }));
    expect(archived.container.querySelector(".deadline-badge")).toBeNull();
  });

  it("shows no badge for a legacy review without a deadline", () => {
    const { container } = renderReviewCard(
      makeReview({ deadline: undefined, overdue: undefined, days_until_deadline: undefined }),
    );

    expect(container.querySelector(".deadline-badge")).toBeNull();
  });
});
