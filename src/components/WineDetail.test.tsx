import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import WineDetail from "./WineDetail";

const mockWineShow = vi.fn();
const mockReviewsList = vi.fn();
const mockTasteParametersList = vi.fn().mockResolvedValue([]);

vi.mock("../services/api", () => ({
  winesApi: {
    show: (...args: unknown[]) => mockWineShow(...args),
    destroy: vi.fn(),
  },
  reviewsApi: {
    list: (...args: unknown[]) => mockReviewsList(...args),
    update: vi.fn(),
    destroy: vi.fn(),
  },
  vintagesApi: { create: vi.fn() },
  tasteParametersApi: { list: () => mockTasteParametersList() },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

// The view beacon, the follow/like/comment widgets and the review form all talk
// to their own endpoints. This file covers the vintage list only.
vi.mock("../hooks/useAnalyticsBeacon", () => ({
  useAnalyticsBeacon: () => ({ trackView: vi.fn() }),
}));
vi.mock("./FollowButton", () => ({ default: () => null }));
vi.mock("./LikeButton", () => ({ default: () => null }));
vi.mock("./comments/CommentSection", () => ({ default: () => null }));
vi.mock("./ReviewForm", () => ({ default: () => null }));

const WINE_SLUG = "shaw-smith-m3-chardonnay";

function makeWine() {
  return {
    id: 11,
    slug: WINE_SLUG,
    name: "Shaw + Smith M3 Chardonnay",
    color: "White",
    vintages: [{ id: 5, year: 2019, reviews_count: 2 }],
  };
}

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    slug: "shaw-smith-m3-chardonnay-1919-review",
    title: "Benchmark Adelaide Hills chardonnay",
    status: "published",
    score: 94,
    comment: "<p>Lovely.</p>",
    reviewer_name: "Kasia",
    ...overrides,
  };
}

function renderWine(path = `/wines/${WINE_SLUG}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/wines/:slug" element={<WineDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Loads the wine and opens the vintage's review list. */
async function openVintageReviews() {
  const user = userEvent.setup();
  renderWine();

  await screen.findByText("Shaw + Smith M3 Chardonnay");
  await user.click(screen.getByRole("button", { name: "Reviews (2)" }));
  await screen.findByText("Kasia");
}

describe("WineDetail vintage reviews", () => {
  beforeEach(() => {
    mockWineShow.mockReset().mockResolvedValue(makeWine());
    mockReviewsList.mockReset().mockResolvedValue([makeReview()]);
    mockTasteParametersList.mockReset().mockResolvedValue([]);
  });

  it("links each review to its own page, remembering this wine as the origin", async () => {
    await openVintageReviews();

    expect(screen.getByRole("link", { name: "View review" })).toHaveAttribute(
      "href",
      `/reviews/shaw-smith-m3-chardonnay-1919-review?returnTo=%2Fwines%2F${WINE_SLUG}`,
    );
  });

  it("links every review in the list, not just the first", async () => {
    mockReviewsList.mockResolvedValue([
      makeReview(),
      makeReview({ id: 43, slug: "second-review", reviewer_name: "Roma" }),
    ]);

    await openVintageReviews();

    const hrefs = screen
      .getAllByRole("link", { name: "View review" })
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      `/reviews/shaw-smith-m3-chardonnay-1919-review?returnTo=%2Fwines%2F${WINE_SLUG}`,
      `/reviews/second-review?returnTo=%2Fwines%2F${WINE_SLUG}`,
    ]);
  });

  it("renders no link for a review without a slug", async () => {
    mockReviewsList.mockResolvedValue([makeReview({ slug: "" })]);

    await openVintageReviews();

    expect(
      screen.queryByRole("link", { name: "View review" }),
    ).not.toBeInTheDocument();
    // The review itself still renders.
    expect(screen.getByText("Kasia")).toBeInTheDocument();
  });

  it("requests the reviews of the vintage that was opened", async () => {
    await openVintageReviews();

    expect(mockReviewsList).toHaveBeenCalledWith(WINE_SLUG, 5);
  });
});
