import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
  // Rendered by the advanced search panel's region picker on mount.
  regionsApi: { list: () => Promise.resolve([]) },
  // Rendered by the advanced search panel's grape picker on type.
  grapesApi: { search: () => Promise.resolve([]) },
  // Loaded by the advanced search panel for taste parameter labels; an empty
  // catalogue falls back to the humanized slugs ("Acidity", "Body", ...).
  tasteParametersApi: { list: () => Promise.resolve([]) },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, email: "romalopes@example.com", roles: ["Editor"] },
    loading: false,
  }),
}));

vi.mock("../components/ArticleTable", () => ({
  default: ({
    articles,
    canManage = false,
    user,
    onStatusChange,
    statusBusy = false,
  }: {
    articles: unknown[];
    canManage?: boolean;
    user?: unknown;
    onStatusChange?: ((article: unknown, status: string) => void) | undefined;
    statusBusy?: boolean;
  }) => {
    const articleList = Array.isArray(articles) ? articles : [];
    return (
      <table className="grapes-table producers-table">
        <thead>
          <tr>
            <th className="producers-table__image-col">Image</th>
            <th>Title</th>
            <th>Author</th>
            <th>Follow</th>
            <th>Comment</th>
            {canManage && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {articleList.map((article, index) => (
            <tr
              key={index}
              className={index % 2 === 0 ? "grapes-row--even" : "grapes-row--odd"}
              onClick={() => {}}
              style={{ cursor: "pointer" }}
            >
              <td>
                <span
                  className="producers-table__thumb producers-table__thumb--empty"
                  aria-hidden="true"
                />
              </td>
              <td>
                <a href="/articles/barolo-vertical" className="grapes-table__link">
                  Latest article
                </a>
              </td>
              <td>Editor</td>
              <td>
                <span className="like-button__wrap">
                  <button
                    type="button"
                    className="like-button"
                    aria-pressed="false"
                    aria-label="Like (0 likes)"
                    title="Like"
                  >
                    <span aria-hidden="true">♡</span> 0
                  </button>
                </span>
              </td>
              <td>
                <a
                  className="comment-link"
                  aria-label="Go to comments"
                  title="Go to comments"
                  href="#comments"
                >
                  <span aria-hidden="true">💬</span>
                </a>
              </td>
              {canManage && (
                <td className="actions">
                  <button
                    type="button"
                    className="btn-status"
                    aria-pressed="false"
                    data-status="published"
                  >
                    Set status to Archive
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
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
  return async (params?: { q?: string; query?: string; page?: number; per_page?: number }) => {
    // The real API returns the paginated envelope whenever `page` and `per_page`
    // are provided, regardless of whether there's a query. The test mock previously
    // returned a bare array for filter-only searches, which hid a bug in `asList`.
    const hasQuery = params?.q || params?.query;
    if (params?.page && params?.per_page) {
      const items = hasQuery ? searchItems : latestItems;
      return envelope(items, searchTotal);
    }
    return hasQuery ? envelope(searchItems, searchTotal) : latestItems;
  };
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
    // The Cards / List choice is persisted, so a previous test's selection
    // must not decide how the next one renders.
    localStorage.clear();
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
        { q: "malbec", page: 1, per_page: 6 },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(mockArticlesList).toHaveBeenCalledWith(
        { q: "malbec", page: 1, per_page: 6 },
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

  it("opens the advanced panel before any term is typed", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(
      screen.getByRole("button", { name: /Advanced search/ }),
    );

    // The panel renders independently of the search term — this is the
    // regression case: it used to be nested inside the results block and
    // only appeared once a term existed.
    expect(
      await screen.findByText("Content types"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Search reviews" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Search articles" }),
    ).toBeChecked();

    // The simple search box hides while the panel is open (/wines behavior),
    // and the panel header carries the wine-style "Hide form" toggle.
    expect(
      screen.queryByRole("textbox", { name: "Search reviews and articles" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide form" })).toBeInTheDocument();
  });

  it("hides the advanced panel when toggled again", async () => {
    const user = userEvent.setup();
    renderDashboard();

    const toggle = screen.getByRole("button", { name: /Advanced search/ });
    await user.click(toggle);
    expect(await screen.findByText("Content types")).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText("Content types")).not.toBeInTheDocument();
  });

  it("re-runs the search when an advanced filter changes", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.type(
      screen.getByRole("textbox", { name: "Search reviews and articles" }),
      "malbec",
    );
    await screen.findByRole("heading", { name: /Reviews \(1\)/ });

    await user.click(
      screen.getByRole("button", { name: /Advanced search/ }),
    );
    await user.type(
      screen.getByPlaceholderText("e.g. Penfolds"),
      "Penfolds",
    );

    await waitFor(() => {
      const calls = mockReviewsAll.mock.calls.filter(
        (call) =>
          (call[0] as { producer_name?: string } | undefined)?.producer_name,
      );
      const last = calls[calls.length - 1]?.[0] as
        | { producer_name?: string }
        | undefined;
      expect(last?.producer_name).toBe("Penfolds");
    });
  });

  it("sends alcohol, closure and style parameters when set", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.type(
      screen.getByRole("textbox", { name: "Search reviews and articles" }),
      "malbec",
    );
    await screen.findByRole("heading", { name: /Reviews \(1\)/ });

    await user.click(
      screen.getByRole("button", { name: /Advanced search/ }),
    );
    await user.type(screen.getByLabelText("Alcohol minimum"), "13");
    await user.selectOptions(screen.getByLabelText("Type of closure"), "Cork");
    await user.selectOptions(screen.getByLabelText("Sparkling"), "true");

    await waitFor(() => {
      const calls = mockReviewsAll.mock.calls.filter(
        (call) => (call[0] as { alcohol_min?: string } | undefined)?.alcohol_min,
      );
      const last = calls[calls.length - 1]?.[0] as
        | { alcohol_min?: string; closure?: string; sparkling?: string }
        | undefined;
      expect(last?.alcohol_min).toBe("13");
      expect(last?.closure).toBe("Cork");
      expect(last?.sparkling).toBe("true");
    });
  });

  it("sends a taste parameter range when a slider moves", async () => {
    // jsdom has no layout, so nouislider needs a non-zero rect — the same stub
    // the wine advanced-search tests use.
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: function () {
        return {
          left: 0, right: 200, top: 0, bottom: 4,
          width: 200, height: 4, x: 0, y: 0, toJSON: () => ({}),
        } as DOMRect;
      },
    });

    const user = userEvent.setup();
    renderDashboard();

    await user.type(
      screen.getByRole("textbox", { name: "Search reviews and articles" }),
      "malbec",
    );
    await screen.findByRole("heading", { name: /Reviews \(1\)/ });

    await user.click(
      screen.getByRole("button", { name: /Advanced search/ }),
    );

    const lower = screen
      .getAllByRole("slider")
      .find((el) => el.getAttribute("aria-label") === "Acidity minimum");
    expect(lower).toBeDefined();

    act(() => {
      lower?.focus();
      fireEvent.keyDown(lower!, { key: "ArrowRight" });
    });

    await waitFor(() => {
      const calls = mockReviewsAll.mock.calls.filter(
        (call) => (call[0] as { acidity_min?: number } | undefined)?.acidity_min,
      );
      const last = calls[calls.length - 1]?.[0] as
        | { acidity_min?: number }
        | undefined;
      // One arrow step to the right on the 0-10 scale.
      expect(last?.acidity_min).toBe(1);
    });
  });

  it("clears the simple search when the advanced panel opens", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.type(
      screen.getByRole("textbox", { name: "Search reviews and articles" }),
      "malbec",
    );
    await screen.findByRole("heading", { name: /Reviews \(1\)/ });

    await user.click(
      screen.getByRole("button", { name: /Advanced search/ }),
    );

    // Entering advanced mode abandons the term: the results give way to the
    // latest rails, exactly as the /wines search does between its modes.
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /Reviews \(1\)/ }),
      ).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole("heading", { name: "Latest Reviews" }),
    ).toBeInTheDocument();
  });

  it("clears the advanced filters when the panel closes", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(
      screen.getByRole("button", { name: /Advanced search/ }),
    );
    await user.type(
      await screen.findByPlaceholderText("e.g. Penfolds"),
      "Penfolds",
    );

    await user.click(
      screen.getByRole("button", { name: /Hide advanced search/ }),
    );

    // Reopening starts from clean filters.
    await user.click(
      screen.getByRole("button", { name: /Advanced search/ }),
    );
    expect(
      await screen.findByPlaceholderText("e.g. Penfolds"),
    ).toHaveValue("");
  });

  it("submits advanced filters to both APIs without closing the panel", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(
      screen.getByRole("button", { name: /Advanced search/ }),
    );
    await user.type(
      await screen.findByPlaceholderText("e.g. Penfolds"),
      "Penfolds",
    );
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(
        mockReviewsAll.mock.calls.some(
          ([params]) =>
            (params as { producer_name?: string } | undefined)?.producer_name ===
            "Penfolds",
        ),
      ).toBe(true);
      expect(
        mockArticlesList.mock.calls.some(
          ([params]) =>
            (params as { producer_name?: string } | undefined)?.producer_name ===
            "Penfolds",
        ),
      ).toBe(true);
    });
    expect(screen.getByPlaceholderText("e.g. Penfolds")).toHaveValue("Penfolds");
  });

  it("renders search results after submitting advanced filters", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(
      screen.getByRole("button", { name: /Advanced search/ }),
    );
    await user.type(
      await screen.findByPlaceholderText("e.g. Penfolds"),
      "Penfolds",
    );
    await user.click(screen.getByRole("button", { name: "Search" }));

    // The search results section should appear with the filtered results
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Reviews \(1\)/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /Articles \(1\)/ }),
      ).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("e.g. Penfolds")).toHaveValue("Penfolds");
  });

  it("renders the latest rails as tables in list mode", async () => {
    const user = userEvent.setup();
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Latest Reviews" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "List" }));

    expect(await screen.findByRole("columnheader", { name: "Score" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Title / wine" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Latest article")).toBeInTheDocument();
    // The card grid is replaced, not merely supplemented.
    expect(document.querySelector(".wine-management__card")).not.toBeInTheDocument();
    // Every row keeps the same shape: the Actions column is present even when
    // the viewer cannot manage content — it just stays empty.
    expect(
      screen.getByRole("columnheader", { name: "Actions" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });
});
