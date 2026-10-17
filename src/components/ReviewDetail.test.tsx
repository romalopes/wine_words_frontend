import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ReviewDetail from "./ReviewDetail";
import { formatDate } from "../utils/dates";
import { GENERAL_BOTTLE_IMAGE } from "../utils/wineImages";

/** Editorial header, normalised tasting note, and kept extras (likes,
 * comments, "More reviews" footer). */
const mockShow = vi.fn();

vi.mock("../services/api", () => ({
  reviewsApi: {
    show: (...args: unknown[]) => mockShow(...args),
    update: vi.fn().mockResolvedValue({}),
    destroy: vi.fn().mockResolvedValue({}),
    // One related row keeps the footer assertions real.
    related: vi.fn().mockResolvedValue([
      {
        id: 9,
        slug: "sibling-review",
        title: "A sibling review",
        comment: "<p>Preview of the sibling.</p>",
        status: "published",
        published_at: "2026-01-05T00:00:00Z",
        reviewer_name: "Test User",
        likes_count: 0,
        liked_by_current_user: false,
      },
    ]),
  },
  likesApi: { toggle: vi.fn().mockResolvedValue({ liked: true, likes_count: 1 }) },
}));

// Anonymous: the like control renders read-only, so nothing hits the API.
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, loading: false }),
}));

// Only mounted behind interaction / at the bottom of the page.
vi.mock("./ReviewForm", () => ({ default: () => null }));
vi.mock("./comments/CommentSection", () => ({
  default: () => <div data-testid="comments" />,
}));

const PUBLISHED_AT = "2026-09-11T10:11:19Z";

interface ReviewStub {
  id: number;
  slug: string;
  title: string;
  comment: string | null;
  score: number | null;
  status: string;
  drink_from: number | null;
  drink_to: number | null;
  drink_plus: boolean;
  reviewer_name: string;
  vintage_year: number | null;
  vintage_no_vintage: boolean;
  wine_name: string | null;
  wine_slug: string | null;
  categories: Array<{ id: number; name: string; slug: string }>;
  published_at: string | null;
  likes_count: number;
  liked_by_current_user: boolean;
}

function makeReview(overrides: Partial<ReviewStub> = {}): ReviewStub {
  return {
    id: 103,
    slug: "lowe-organic-zinfandel-2021-review-seed",
    title: "Lowe Organic Zinfandel 2021 Review",
    // Legacy shape: one <div> with <br><br> between paragraphs.
    comment: "<div>First note.<br><br>Second note.</div>",
    score: 61,
    status: "published",
    drink_from: 2021,
    drink_to: 2026,
    drink_plus: false,
    reviewer_name: "Test User",
    vintage_year: 2021,
    vintage_no_vintage: false,
    wine_name: "Lowe Organic Zinfandel",
    wine_slug: "lowe-organic-zinfandel",
    categories: [
      { id: 9, name: "Top Value", slug: "top-value" },
      { id: 15, name: "Test Category 5", slug: "test-category-5" },
    ],
    published_at: PUBLISHED_AT,
    likes_count: 1,
    liked_by_current_user: false,
    ...overrides,
  };
}

function renderReview(review: ReviewStub) {
  mockShow.mockResolvedValue(review);

  return render(
    <MemoryRouter initialEntries={[`/reviews/${review.slug}`]}>
      <Routes>
        <Route path="/reviews/:slug" element={<ReviewDetail />} />
        <Route path="/wines/:slug" element={<p>wine detail page</p>} />
        <Route path="/categories/:slug" element={<p>category page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockShow.mockReset();
});

describe("ReviewDetail", () => {
  it("renders the editorial header: kicker, headline, wine deck, score and facts", async () => {
    renderReview(makeReview());

    expect(
      await screen.findByRole("heading", { name: "Lowe Organic Zinfandel 2021 Review", level: 1 }),
    ).toBeInTheDocument();

    // First category drives the kicker; the second becomes a chip.
    expect(screen.getByRole("link", { name: "Top Value" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Test Category 5" })).toBeInTheDocument();

    // Wine deck links through to the wine page, with the vintage appended.
    expect(
      screen.getByRole("link", { name: "Lowe Organic Zinfandel 2021" }),
    ).toBeInTheDocument();

    expect(screen.getByText("61")).toBeInTheDocument();
    // Label and value sit in separate nodes (<b>Label</b> value), so match
    // on the fact pill's full textContent.
    const factWith = (text: string) =>
      screen.getByText(
        (_content, el) =>
          Boolean(el && el.classList.contains("review-page__fact") && el.textContent === text),
      );
    expect(factWith("Vintage 2021")).toBeInTheDocument();
    expect(factWith("Drink 2021–2026")).toBeInTheDocument();
  });

  it("renders the byline with author, date and no draft flag when published", async () => {
    renderReview(makeReview());

    expect(await screen.findByText("by Test User")).toBeInTheDocument();
    expect(screen.getByText(formatDate(PUBLISHED_AT) ?? "missing")).toBeInTheDocument();
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
  });

  it("shows a Draft badge instead of the status word for drafts", async () => {
    renderReview(makeReview({ status: "draft", published_at: null }));

    expect(await screen.findByText("Draft")).toBeInTheDocument();
  });

  it("uses the general bottle image when neither the review nor its wine has an image", async () => {
    renderReview(makeReview());

    const hero = await screen.findByRole("img", {
      name: "Lowe Organic Zinfandel 2021 Review",
    });
    expect(hero).toHaveAttribute("src", GENERAL_BOTTLE_IMAGE);
  });

  it("normalises the tasting note into real paragraphs", async () => {
    renderReview(makeReview());

    await screen.findByRole("heading", { level: 1 });
    const body = document.querySelector(".article-page__body");
    expect(body).not.toBeNull();

    const paragraphs = Array.from(body!.querySelectorAll("p"));
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toHaveTextContent("First note.");
    expect(paragraphs[1]).toHaveTextContent("Second note.");
  });

  it("keeps the likes, comments and the related-reviews footer", async () => {
    renderReview(makeReview());

    // Anonymous like control renders read-only with the server count.
    expect(await screen.findByLabelText("1 likes")).toBeInTheDocument();
    expect(screen.getByTestId("comments")).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: "More reviews" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A sibling review" })).toBeInTheDocument();
  });
});
