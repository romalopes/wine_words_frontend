import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Reviews from "./Reviews";

/**
 * `reviewsApi.all` is the request the search hook makes on mount. Tests below
 * drive it through the shapes the real endpoint returns: either a bare array
 * or the Rails pagination envelope
 * (`{ items, page, per_page, total_count, total_pages }`).
 */
const mockAll = vi.fn();
const mockGrouped = vi.fn();
const mockMyReviews = vi.fn();
const mockCategoriesList = vi.fn().mockResolvedValue([]);

vi.mock("../services/api", () => ({
  reviewsApi: {
    all: (...args: unknown[]) => mockAll(...args),
    grouped: (...args: unknown[]) => mockGrouped(...args),
    myReviews: () => mockMyReviews(),
    update: vi.fn().mockResolvedValue({}),
    destroy: vi.fn().mockResolvedValue({}),
  },
  categoriesApi: { list: () => mockCategoriesList() },
}));

// Reviews reads `user` for manage/edit affordances and for gating the
// "my reviews" fetch. `mockAuthUser` lets tests simulate signed-out state.
let mockAuthUser: { id: number; display_name: string; roles: string[] } | null = {
  id: 1,
  display_name: "Reviewer",
  roles: ["Editor"],
};
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockAuthUser,
    loading: false,
  }),
}));

// The forms are only mounted behind interaction; stub them so this file tests
// the list/search rendering in isolation.
vi.mock("./ReviewForm", () => ({ default: () => null }));
vi.mock("./WineQuickCreate", () => ({ default: () => null }));

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: "a-lovely-wine",
    title: "A lovely wine",
    status: "published",
    reviewer_name: "Reviewer",
    wine_name: "Château Test",
    wine_slug: "chateau-test",
    score: 92,
    comment: "<p>Very nice.</p>",
    categories: [{ id: 3, name: "Tasting notes", slug: "tasting-notes" }],
    ...overrides,
  };
}

/** The grouped endpoint: one section per category. */
function groupedPayload(rows = [makeReview()]) {
  return [{ category: "Tasting notes", count: rows.length, reviews: rows }];
}

/** The Rails envelope, as the backend sends it when a `page` is requested. */
function envelope(
  rows = [makeReview()],
  overrides: Record<string, number> = {},
) {
  return {
    items: rows,
    page: 1,
    per_page: 20,
    total_count: rows.length,
    total_pages: 1,
    ...overrides,
  };
}

function renderReviews(initialEntry = "/reviews") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Reviews />
    </MemoryRouter>,
  );
}

describe("Reviews", () => {
  beforeEach(() => {
    // `useSearch` persists the query back to window.location, so without this
    // a previous test's `?query=…` would leak into the next one.
    window.history.replaceState({}, "", "/");
    mockAuthUser = { id: 1, display_name: "Reviewer", roles: ["Editor"] };
    mockAll.mockReset().mockResolvedValue(envelope([]));
    mockGrouped.mockReset().mockResolvedValue([]);
    mockMyReviews.mockReset().mockResolvedValue([]);
    mockCategoriesList.mockReset().mockResolvedValue([]);
  });

  it("does not fetch my reviews when logged out", async () => {
    mockAuthUser = null;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderReviews();

    // Let effects settle: the public feeds still load, but my_reviews must not.
    expect(mockAll).not.toHaveBeenCalled();
    await waitFor(() => expect(mockGrouped).toHaveBeenCalled());
    expect(mockMyReviews).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("scopes the grouped feed to the author for My Reviews, never the unpaginated endpoint", async () => {
    mockGrouped.mockResolvedValue(
      groupedPayload([makeReview({ id: 5, title: "My own review" })]),
    );
    const user = userEvent.setup();

    renderReviews();

    await user.click(await screen.findByRole("button", { name: "My Reviews" }));

    // "My Reviews" renders through the same per-category-capped grouped endpoint
    // as "All Reviews", just scoped to the author — NOT the unbounded
    // /reviews/my_reviews call that shipped the author's whole library.
    await waitFor(() => {
      expect(
        mockGrouped.mock.calls.some(
          (call) =>
            typeof call[0] === "object" &&
            call[0] !== null &&
            (call[0] as { scope?: string }).scope === "mine",
        ),
      ).toBe(true);
    });
    expect(mockMyReviews).not.toHaveBeenCalled();
    expect(await screen.findByText("My own review")).toBeInTheDocument();
  });

  it("renders the category sections from the grouped endpoint", async () => {
    mockGrouped.mockResolvedValue(groupedPayload());

    renderReviews();

    expect(
      await screen.findByRole("heading", { name: /Tasting notes/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("A lovely wine")).toBeInTheDocument();
  });

  it("shows the review's wine, score and drink window on the card", async () => {
    mockGrouped.mockResolvedValue(
      groupedPayload([
        makeReview({ drink_from: 2020, drink_to: 2030, drink_plus: true }),
      ]),
    );

    renderReviews();

    expect(await screen.findByText("92")).toBeInTheDocument();
    expect(screen.getByText("Château Test")).toBeInTheDocument();
    expect(screen.getByText(/Drink 2020–2030\+/)).toBeInTheDocument();
  });

  it("renders the pending state instead of crashing while the first request is in flight", () => {
    // Neither loader settles, so there is no data yet.
    mockGrouped.mockReturnValue(new Promise(() => {}));
    mockAll.mockReturnValue(new Promise(() => {}));

    renderReviews();

    expect(screen.getByText("Loading reviews…")).toBeInTheDocument();
  });

  it("survives a failed first request", async () => {
    mockGrouped.mockRejectedValue(new Error("network down"));
    mockAll.mockRejectedValue(new Error("network down"));

    renderReviews();

    // The rejected request must not crash the component: the page chrome is
    // still there.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Reviews" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { name: "Reviews" }).closest("header"),
    ).toHaveClass("wine-app__detail-hero");
    expect(screen.getByRole("link", { name: /Back to Dashboard/ })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows the empty state when there are no reviews", async () => {
    mockGrouped.mockResolvedValue([]);

    renderReviews();

    expect(
      await screen.findByText(/No reviews yet\. Be the first!/i),
    ).toBeInTheDocument();
  });

  it("requests the next page instead of snapping back to page 1", async () => {
    mockCategoriesList.mockResolvedValue([
      { id: 3, name: "Tasting notes", slug: "tasting-notes" },
    ]);
    mockAll.mockResolvedValue(
      envelope([makeReview()], { total_count: 40, total_pages: 2 }),
    );
    const user = userEvent.setup();

    renderReviews("/reviews?category=Tasting%20notes");

    await screen.findByText("A lovely wine");
    await user.click(screen.getByRole("button", { name: "2" }));

    // `useSearch` used to hardcode `page: 1` on every request, so the numbered
    // pages were unusable.
    await waitFor(() => {
      expect(
        mockAll.mock.calls.some(
          (call) => (call[0] as { page?: number } | undefined)?.page === 2,
        ),
      ).toBe(true);
    });
  });

  it("debounces typing into the search box without looping", async () => {
    mockGrouped.mockResolvedValue(groupedPayload());
    mockAll.mockResolvedValue(envelope([makeReview()]));
    const user = userEvent.setup();

    renderReviews();

    const input = screen.getByPlaceholderText("Search reviews…");
    await user.type(input, "malbec");

    // The input stays controlled and the query reaches the API once —
    // previously a callback-identity loop made this throw
    // "Maximum update depth exceeded".
    expect(input).toHaveValue("malbec");
    await waitFor(() => {
      expect(
        mockGrouped.mock.calls.some(
          (call) =>
            typeof call[0] === "object" &&
            call[0] !== null &&
            (call[0] as { query?: string }).query === "malbec",
        ),
      ).toBe(true);
    });
  });

  it("re-requests the grouped view with the search term (no category)", async () => {
    mockGrouped.mockResolvedValue(groupedPayload());
    const user = userEvent.setup();

    renderReviews();

    const input = screen.getByPlaceholderText("Search reviews…");
    await user.type(input, "malbec");

    // With no category selected the list renders from `reviewsApi.grouped()`,
    // so the term has to reach that request or search would appear to do
    // nothing.
    await waitFor(() => {
      expect(
        mockGrouped.mock.calls.some(
          (call) =>
            typeof call[0] === "object" &&
            call[0] !== null &&
            (call[0] as { query?: string }).query === "malbec",
        ),
      ).toBe(true);
    });
  });

  it("does not search until the term reaches three characters", async () => {
    mockGrouped.mockResolvedValue(groupedPayload());
    const user = userEvent.setup();

    renderReviews();

    const input = screen.getByPlaceholderText("Search reviews…");
    await user.type(input, "ma");

    // Let the input's debounce elapse: two characters must not be searched.
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));

    const sentQuery = () =>
      [...mockAll.mock.calls, ...mockGrouped.mock.calls].some((call) =>
        Boolean((call[0] as { query?: string } | undefined)?.query),
      );
    expect(sentQuery()).toBe(false);

    // The third character triggers the search.
    await user.type(input, "l");

    await waitFor(() => {
      expect(
        mockGrouped.mock.calls.some(
          (call) =>
            (call[0] as { query?: string } | undefined)?.query === "mal",
        ),
      ).toBe(true);
    });
  });

  it("cancels the superseded request when the term changes", async () => {
    mockGrouped.mockResolvedValue(groupedPayload());
    const user = userEvent.setup();

    renderReviews();

    // Every grouped load takes a { signal }, so a keystroke can cancel the
    // request that is still in flight instead of leaving it to complete and be
    // discarded on arrival.
    const groupedSignals = () =>
      mockGrouped.mock.calls
        .map((call) => (call[1] as { signal?: AbortSignal } | undefined)?.signal)
        .filter((signal): signal is AbortSignal => Boolean(signal));

    const input = screen.getByPlaceholderText("Search reviews…");
    await user.type(input, "malbec");
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

  it("sends the status filter to the grouped feed and renders the returned drafts", async () => {
    // The grouped view is what backs the no-category listing. Selecting Draft
    // must reach that request as `status: "draft"`, and a draft it returns must
    // actually render (previously the filter was client-side only, so a draft
    // outside the per-category cap never arrived and the page read "No draft
    // reviews." even when drafts existed).
    mockGrouped.mockResolvedValue(
      groupedPayload([makeReview({ id: 7, title: "A draft wine", status: "draft" })]),
    );
    const user = userEvent.setup();

    renderReviews();

    await user.click(await screen.findByRole("button", { name: "Draft" }));

    await waitFor(() => {
      expect(
        mockGrouped.mock.calls.some(
          (call) =>
            typeof call[0] === "object" &&
            call[0] !== null &&
            (call[0] as { status?: string }).status === "draft",
        ),
      ).toBe(true);
    });

    expect(await screen.findByText("A draft wine")).toBeInTheDocument();
  });

  it("sends the archived status filter to the grouped feed and renders the returned archived reviews", async () => {
    // The grouped view is what backs the no-category listing, and its
    // per-category window caps each section at 12 rows. Selecting Archived must
    // reach that request as `status: "archived"`, otherwise archived reviews
    // get crowded out by the newest published ones and never reach the
    // client-side filter.
    mockGrouped.mockResolvedValue(
      groupedPayload([makeReview({ id: 8, title: "An archived wine", status: "archived" })]),
    );
    const user = userEvent.setup();

    renderReviews();

    await user.click(await screen.findByRole("button", { name: "Archived" }));

    await waitFor(() => {
      expect(
        mockGrouped.mock.calls.some(
          (call) =>
            typeof call[0] === "object" &&
            call[0] !== null &&
            (call[0] as { status?: string }).status === "archived",
        ),
      ).toBe(true);
    });

    expect(await screen.findByText("An archived wine")).toBeInTheDocument();
  });

  it("clears the status filter chip when its × is clicked", async () => {
    mockGrouped.mockResolvedValue(groupedPayload());
    const user = userEvent.setup();

    renderReviews();

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
