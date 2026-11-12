import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ArticleDetail from "./ArticleDetail";
import { formatDate } from "../utils/dates";

/**
 * The article page renders its linked reviews with the shared `ReviewCard`
 * (the same card the /reviews grid uses) instead of its own stub markup.
 */
const mockShow = vi.fn();

vi.mock("../services/api", () => ({
  articlesApi: {
    show: (...args: unknown[]) => mockShow(...args),
    update: vi.fn().mockResolvedValue({}),
    destroy: vi.fn().mockResolvedValue({}),
    // The "more articles" footer; empty keeps those assertions to their own file.
    related: vi.fn().mockResolvedValue([]),
  },
  likesApi: { toggle: vi.fn().mockResolvedValue({ liked: true, likes_count: 1 }) },
  followsApi: { status: vi.fn().mockResolvedValue({ following: false }) },
}));

// Authenticated as Editor: scores are visible for wine managers
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: "editor@example.com",
      display_name: "Editor User",
      first_name: "Editor",
      last_name: "User",
      roles: ["Editor"],
      analytics_opt_out: false,
      subscription: null,
      billing_provider: null,
      can_manage_billing: false,
      subscription_status: null,
      can_access_wine_packages: false,
      subscription_change: null,
      producer_memberships: [],
    },
    isAuthenticated: true,
    loading: false,
  }),
}));

// Only mounted behind interaction / at the bottom of the page.
vi.mock("./ArticleForm", () => ({ default: () => null }));
vi.mock("./comments/CommentSection", () => ({ default: () => null }));

interface ReviewStub {
  id: number;
  slug: string;
  title: string;
  score: number | null;
  status: string;
  comment: string | null;
  reviewer_name: string;
  link_status: string;
  wine_name?: string;
  wine_slug?: string;
  vintage_year?: number;
}

function makeReview(overrides: Partial<ReviewStub> = {}): ReviewStub {
  return {
    id: 1,
    slug: "a-lovely-wine",
    title: "A lovely wine",
    score: 92,
    status: "published",
    comment: "<p>Very nice.</p>",
    reviewer_name: "Reviewer",
    link_status: "published",
    ...overrides,
  };
}

function makeArticle(reviews: ReviewStub[]) {
  return {
    id: 7,
    title: "Barolo vertical",
    slug: "barolo-vertical",
    status: "published",
    author_name: "Editor",
    user_id: 2,
    body: "<p>Article body.</p>",
    reviews,
  };
}

function renderAt(path: string, reviews: ReviewStub[]) {
  mockShow.mockResolvedValue(makeArticle(reviews));

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/articles/:slug" element={<ArticleDetail />} />
        <Route path="/reviews/:slug" element={<p>review detail page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The cards the reviews section renders, in DOM order. */
function reviewCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".content-grid .wine-management__card"));
}

beforeEach(() => {
  mockShow.mockReset();
});

describe("ArticleDetail reviews", () => {
  it("renders each linked review as a card in the reviews grid", async () => {
    renderAt("/articles/barolo-vertical", [
      makeReview({ id: 1, title: "First review", score: 97 }),
      makeReview({ id: 2, slug: "second", title: "Second review", score: 80 }),
    ]);

    expect(await screen.findByRole("heading", { name: "Reviews" })).toBeInTheDocument();

    await waitFor(() => expect(reviewCards()).toHaveLength(2));
    expect(screen.getByText("First review")).toBeInTheDocument();
    expect(screen.getByText("Second review")).toBeInTheDocument();

    // Card contents match the /reviews card: score badge, byline, excerpt.
    expect(screen.getAllByText("97").length).toBe(1);
    expect(screen.getAllByText("by Reviewer")).toHaveLength(2);
    expect(screen.getAllByText("Very nice.").length).toBe(2);
    expect(reviewCards()[0]?.querySelector(".wine-management__card-header")).not.toBeNull();
  });

  it("hides reviews whose link or whose own status is not published", async () => {
    renderAt("/articles/barolo-vertical", [
      makeReview({ id: 1, title: "Visible" }),
      makeReview({ id: 2, title: "Unpublished link", link_status: "draft" }),
      makeReview({ id: 3, title: "Draft review", status: "draft" }),
    ]);

    await waitFor(() => expect(reviewCards()).toHaveLength(1));
    expect(screen.getByText("Visible")).toBeInTheDocument();
    expect(screen.queryByText("Unpublished link")).not.toBeInTheDocument();
    expect(screen.queryByText("Draft review")).not.toBeInTheDocument();
  });

  it("opens the review when its card is clicked", async () => {
    const user = userEvent.setup();
    renderAt("/articles/barolo-vertical", [makeReview({ id: 1, slug: "a-lovely-wine" })]);

    const card = await waitFor(() => {
      const [found] = reviewCards();
      if (!found) throw new Error("review card not rendered");
      return found;
    });

    await user.click(card);
    expect(await screen.findByText("review detail page")).toBeInTheDocument();
  });

  it("omits the section entirely when the article has no visible reviews", async () => {
    renderAt("/articles/barolo-vertical", []);
    await screen.findByRole("heading", { name: "Barolo vertical", level: 1 });

    expect(screen.queryByRole("heading", { name: "Reviews" })).not.toBeInTheDocument();
    expect(reviewCards()).toHaveLength(0);
  });

describe("ArticleDetail header", () => {
  function renderArticle() {
    return render(
      <MemoryRouter initialEntries={["/articles/barolo-vertical"]}>
        <Routes>
          <Route path="/articles/:slug" element={<ArticleDetail />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("shows the kicker, standfirst, chips and a created_at fallback date", async () => {
    mockShow.mockResolvedValue({
      ...makeArticle([]),
      abstract: "Article about 15 vintages",
      categories: [
        { id: 3, name: "Australian Icons 2", slug: "australian-icons" },
        { id: 2, name: "Tastings", slug: "tastings" },
      ],
      tags: ["Grenache"],
      published_at: null,
      created_at: "2026-09-07T05:56:00Z",
    });
    renderArticle();

    await screen.findByRole("heading", { name: "Barolo vertical", level: 1 });

    // First category becomes the section kicker, the rest become chips.
    expect(screen.getByRole("link", { name: "Australian Icons 2" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tastings" })).toBeInTheDocument();
    expect(screen.getByText("Grenache")).toBeInTheDocument();

    // Standfirst carries the abstract.
    expect(screen.getByText("Article about 15 vintages")).toBeInTheDocument();

    // published_at is null on this record, so the byline falls back to created_at.
    expect(
      screen.getByText(formatDate("2026-09-07T05:56:00Z") ?? "missing"),
    ).toBeInTheDocument();
  });

  it("flags drafts with a badge and stays quiet when published", async () => {
    mockShow.mockResolvedValue({ ...makeArticle([]), status: "draft" });
    renderArticle();
    expect(await screen.findByText("Draft")).toBeInTheDocument();
  });
});

});
