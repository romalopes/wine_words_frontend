import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";

/**
 * The dashboard hits three endpoints: the stats cards, the "latest" rails, and
 * the search box (reviews + articles, one request each). The search is told
 * apart by the `query` param, so one mock can serve both call sites.
 */
const mockStats = vi.fn();
const mockArticlesList = vi.fn();
const mockReviewsAll = vi.fn();

vi.mock("../services/api", () => ({
  statsApi: { get: () => mockStats() },
  articlesApi: { list: (...args: unknown[]) => mockArticlesList(...args) },
  reviewsApi: { all: (...args: unknown[]) => mockReviewsAll(...args) },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, email: "romalopes@example.com", roles: ["Editor"] },
    loading: false,
  }),
}));

const STATS = { producers: 3, wines: 12, reviews: 40, articles: 7 };

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: "malbec-from-mendoza",
    title: "Malbec from Mendoza",
    status: "published",
    score: 92,
    reviewer_name: "Anderson",
    ...overrides,
  };
}

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: 2,
    slug: "malbec-country-guide",
    title: "Malbec country guide",
    abstract: "Everything about Malbec.",
    status: "published",
    author_name: "Kasia",
    ...overrides,
  };
}

/** The paginated envelope the Rails endpoints return when `per_page` is sent. */
function envelope<T>(items: T[], totalCount = items.length) {
  return {
    items,
    page: 1,
    per_page: 6,
    total_count: totalCount,
    total_pages: 1,
  };
}

/** Routes a call to the "latest" feed or to a search, depending on the params. */
function searchAware<T>(
  searchItems: T[],
  latestItems: T[],
  searchTotal = searchItems.length,
) {
  return async (params?: { query?: string }) =>
    params?.query ? envelope(searchItems, searchTotal) : latestItems;
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe("Dashboard search", () => {
  beforeEach(() => {
    mockStats.mockReset().mockResolvedValue(STATS);
    mockReviewsAll
      .mockReset()
      .mockImplementation(
        searchAware(
          [makeReview()],
          [makeReview({ id: 9, title: "Latest review" })],
        ),
      );
    mockArticlesList
      .mockReset()
      .mockImplementation(
        searchAware(
          [makeArticle()],
          [makeArticle({ id: 10, title: "Latest article" })],
        ),
      );
  });

  it("shows a search box under the welcome line", async () => {
    renderDashboard();

    expect(
      await screen.findByText(/Welcome, romalopes to Wine Words\./),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Search reviews and articles" }),
    ).toBeInTheDocument();
  });

  it("finds reviews and articles for the typed term", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.type(
      screen.getByRole("textbox", { name: "Search reviews and articles" }),
      "malbec",
    );

    expect(
      await screen.findByRole("heading", { name: /Reviews \(1\)/ }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /Articles \(1\)/ }),
    ).toBeInTheDocument();
    // The matches render as cards (SearchHighlight splits the title, so the
    // heading's accessible name is the reliable assertion).
    expect(
      await screen.findByRole("heading", { name: "Malbec from Mendoza" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Malbec country guide" }),
    ).toBeInTheDocument();

    // The term reaches both endpoints, as a paginated preview.
    await waitFor(() => {
      expect(mockReviewsAll).toHaveBeenCalledWith(
        { query: "malbec", page: 1, per_page: 6 },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(mockArticlesList).toHaveBeenCalledWith(
        { query: "malbec", page: 1, per_page: 6 },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it("does not search until the term is long enough", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.type(
      screen.getByRole("textbox", { name: "Search reviews and articles" }),
      "ma",
    );
    // Give the input's debounce time to fire (inside act, because the debounced
    // notification updates Dashboard's state).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(
      mockReviewsAll.mock.calls.some(
        (call) => (call[0] as { query?: string } | undefined)?.query,
      ),
    ).toBe(false);
    expect(
      mockArticlesList.mock.calls.some(
        (call) => (call[0] as { query?: string } | undefined)?.query,
      ),
    ).toBe(false);
  });

  it("reports when nothing matches", async () => {
    mockReviewsAll.mockImplementation(searchAware([], []));
    mockArticlesList.mockImplementation(searchAware([], []));
    const user = userEvent.setup();
    renderDashboard();

    await user.type(
      screen.getByRole("textbox", { name: "Search reviews and articles" }),
      "zweigelt",
    );

    expect(
      await screen.findByText("No reviews or articles match “zweigelt”."),
    ).toBeInTheDocument();
  });

  it("lets the results replace the latest rails while searching", async () => {
    const user = userEvent.setup();
    renderDashboard();

    // Both rails are there before searching.
    expect(
      await screen.findByRole("heading", { name: "Latest Reviews" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Latest Articles" }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: "Search reviews and articles" }),
      "malbec",
    );
    await screen.findByRole("heading", { name: /Reviews \(1\)/ });

    expect(
      screen.queryByRole("heading", { name: "Latest Reviews" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Latest Articles" }),
    ).not.toBeInTheDocument();
  });

  it("links to the full listings when there is more than the preview", async () => {
    mockReviewsAll.mockImplementation(searchAware([makeReview()], [], 40));
    mockArticlesList.mockImplementation(searchAware([makeArticle()], [], 7));
    const user = userEvent.setup();
    renderDashboard();

    await user.type(
      screen.getByRole("textbox", { name: "Search reviews and articles" }),
      "malbec",
    );

    const reviewsHeading = await screen.findByRole("heading", {
      name: /Reviews \(40\)/,
    });
    expect(
      within(reviewsHeading).getByRole("link", { name: /See all reviews/ }),
    ).toHaveAttribute("href", "/reviews?query=malbec");
    expect(
      screen.getByRole("link", { name: /See all articles/ }),
    ).toHaveAttribute("href", "/articles?query=malbec");
  });

  it("clears the results when the term is cleared", async () => {
    const user = userEvent.setup();
    renderDashboard();

    const input = screen.getByRole("textbox", {
      name: "Search reviews and articles",
    });
    await user.type(input, "malbec");
    await screen.findByRole("heading", { name: /Reviews \(1\)/ });

    await user.clear(input);

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /Reviews \(1\)/ }),
      ).not.toBeInTheDocument();
    });
    // The latest rails come back.
    expect(
      await screen.findByRole("heading", { name: "Latest Reviews" }),
    ).toBeInTheDocument();
  });
});
