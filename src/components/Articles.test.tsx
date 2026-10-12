import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Articles from "./Articles";

/**
 * The default (no category selected) listing is driven by
 * `articlesApi.grouped()`; selecting a category switches to the paginated
 * `articlesApi.list()` feed. Both are exercised here in the response shapes
 * the backend actually returns.
 */
const mockList = vi.fn();
const mockGrouped = vi.fn();
const mockMyArticles = vi.fn();
const mockCategoriesList = vi.fn().mockResolvedValue([]);

vi.mock("../services/api", () => ({
  articlesApi: {
    list: (...args: unknown[]) => mockList(...args),
    grouped: (...args: unknown[]) => mockGrouped(...args),
    myArticles: () => mockMyArticles(),
    update: vi.fn().mockResolvedValue({}),
    destroy: vi.fn().mockResolvedValue({}),
  },
  categoriesApi: { list: () => mockCategoriesList() },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, display_name: "Editor", roles: ["Editor"] },
    loading: false,
  }),
}));

vi.mock("./ArticleForm", () => ({ default: () => null }));

interface ArticleRow {
  id: number;
  title: string;
  slug: string;
  status: string;
  body: string;
  author_name: string;
  user_id: number;
  categories: Array<{ id: number; name: string; slug: string }>;
}

function makeArticle(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    id: 1,
    title: "Barolo vertical",
    slug: "barolo-vertical",
    status: "published",
    body: "<p>Deep and tannic.</p>",
    author_name: "Editor",
    user_id: 1,
    categories: [{ id: 3, name: "Tasting notes", slug: "tasting-notes" }],
    ...overrides,
  };
}

function renderArticles(initialEntry = "/articles") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Articles />
    </MemoryRouter>,
  );
}

describe("Articles", () => {
  beforeEach(() => {
    // `useSearch` persists the query back to window.location, so without this
    // a previous test's `?query=…` would leak into the next one.
    window.history.replaceState({}, "", "/");
    mockList.mockReset().mockResolvedValue([]);
    mockGrouped.mockReset().mockResolvedValue([]);
    mockMyArticles.mockReset().mockResolvedValue([]);
    mockCategoriesList.mockReset().mockResolvedValue([]);
  });

  it("renders the grouped view when no category is selected", async () => {
    mockGrouped.mockResolvedValue([
      { category: "Tasting notes", count: 1, articles: [makeArticle()] },
    ]);

    renderArticles();

    expect(
      await screen.findByRole("heading", { name: /Tasting notes/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Barolo vertical")).toBeInTheDocument();
  });

  it("renders the paginated feed when a category is selected", async () => {
    mockCategoriesList.mockResolvedValue([
      { id: 3, name: "Tasting notes", slug: "tasting-notes" },
    ]);
    mockList.mockResolvedValue({
      items: [makeArticle({ title: "From the paginated feed" })],
      page: 1,
      per_page: 20,
      total_count: 1,
      total_pages: 1,
    });

    renderArticles("/articles?category=Tasting%20notes");

    expect(
      await screen.findByText("From the paginated feed"),
    ).toBeInTheDocument();
  });

  it("renders the empty state when the grouped view has no articles", async () => {
    mockGrouped.mockResolvedValue([]);

    renderArticles();

    expect(
      await screen.findByText(/No articles yet/i),
    ).toBeInTheDocument();
  });

  it("does not crash while the first grouped request is in flight", () => {
    mockGrouped.mockReturnValue(new Promise(() => {}));

    renderArticles();

    expect(screen.getByText(/Loading articles/i)).toBeInTheDocument();
  });

  it("debounces typing into the search box without looping", async () => {
    mockGrouped.mockResolvedValue([
      { category: "Tasting notes", count: 1, articles: [makeArticle()] },
    ]);
    const user = userEvent.setup();

    renderArticles();

    const input = screen.getByPlaceholderText("Search articles…");
    await user.type(input, "barolo");

    expect(input).toHaveValue("barolo");
    await waitFor(() => {
      expect(
        mockGrouped.mock.calls.some(
          (call) =>
            typeof call[0] === "object" &&
            call[0] !== null &&
            (call[0] as { query?: string }).query === "barolo",
        ),
      ).toBe(true);
    });
  });

  it("re-requests the grouped view with the search term (no category)", async () => {
    mockGrouped.mockResolvedValue([
      { category: "Tasting notes", count: 1, articles: [makeArticle()] },
    ]);
    const user = userEvent.setup();

    renderArticles();

    const input = screen.getByPlaceholderText("Search articles…");
    await user.type(input, "barolo");

    // With no category selected the list renders from `articlesApi.grouped()`,
    // so the term has to reach that request or search would appear to do
    // nothing.
    await waitFor(() => {
      expect(
        mockGrouped.mock.calls.some(
          (call) =>
            typeof call[0] === "object" &&
            call[0] !== null &&
            (call[0] as { query?: string }).query === "barolo",
        ),
      ).toBe(true);
    });
  });

  it("does not search until the term reaches three characters", async () => {
    mockGrouped.mockResolvedValue([
      { category: "Tasting notes", count: 1, articles: [makeArticle()] },
    ]);
    const user = userEvent.setup();

    renderArticles();

    const input = screen.getByPlaceholderText("Search articles…");
    await user.type(input, "ba");

    // Let the input's debounce elapse: two characters must not be searched.
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));

    const sentQuery = () =>
      [...mockList.mock.calls, ...mockGrouped.mock.calls].some((call) =>
        Boolean((call[0] as { query?: string } | undefined)?.query),
      );
    expect(sentQuery()).toBe(false);

    // The third character triggers the search.
    await user.type(input, "r");

    await waitFor(() => {
      expect(
        mockGrouped.mock.calls.some(
          (call) =>
            (call[0] as { query?: string } | undefined)?.query === "bar",
        ),
      ).toBe(true);
    });
  });

  it("cancels the superseded request when the term changes", async () => {
    mockGrouped.mockResolvedValue([
      { category: "Tasting notes", count: 1, articles: [makeArticle()] },
    ]);
    const user = userEvent.setup();

    renderArticles();

    // Every grouped load takes a { signal }, so a keystroke can cancel the
    // request that is still in flight instead of leaving it to complete and be
    // discarded on arrival.
    const groupedSignals = () =>
      mockGrouped.mock.calls
        .map((call) => (call[1] as { signal?: AbortSignal } | undefined)?.signal)
        .filter((signal): signal is AbortSignal => Boolean(signal));

    const input = screen.getByPlaceholderText("Search articles…");
    await user.type(input, "barolo");
    await waitFor(() => expect(groupedSignals().length).toBeGreaterThan(0));

    await user.type(input, "x");

    await waitFor(() => {
      expect(groupedSignals().length).toBeGreaterThan(1);
      // Every superseded load is aborted...
      expect(groupedSignals().slice(0, -1).every((signal) => signal.aborted)).toBe(true);
    });
    // ...while the newest one is left to finish.
    expect(groupedSignals().at(-1)?.aborted).toBe(false);
    // No load went out without a signal, or cancellation would be impossible.
    expect(groupedSignals().length).toBe(mockGrouped.mock.calls.length);
  });

  it("survives a failed grouped request", async () => {
    mockGrouped.mockRejectedValue(new Error("network down"));

    renderArticles();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Articles" }),
      ).toBeInTheDocument();
    });
  });

  it("clears the status filter chip when its × is clicked", async () => {
    mockGrouped.mockResolvedValue([
      { category: "Tasting notes", count: 1, articles: [makeArticle()] },
    ]);
    const user = userEvent.setup();

    renderArticles();

    // Selecting the Draft status filter adds a chip to the search bar.
    await user.click(await screen.findByRole("button", { name: "Draft" }));
    const remove = await screen.findByRole("button", {
      name: "Remove status filter",
    });

    await user.click(remove);

    // The chip is gone, so the filter really was cleared — this used to throw
    // "onRemoveFilter is not a function" and do nothing at all.
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Remove status filter" }),
      ).not.toBeInTheDocument();
    });
  });
});
