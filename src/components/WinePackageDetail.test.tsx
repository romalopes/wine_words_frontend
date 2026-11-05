import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import WinePackageDetail from "./WinePackageDetail";
import { winesApi } from "../services/api";

const mockShow = vi.fn();
const mockTimeline = vi.fn();
const mockMarkCompleted = vi.fn();
const mockMarkArrived = vi.fn();
const mockDestroy = vi.fn();
const mockItemDestroy = vi.fn();
const mockCreateReview = vi.fn();
const mockTrackingShow = vi.fn();
const mockCategoriesList = vi.fn().mockResolvedValue([]);
const mockImagesUpload = vi.fn().mockResolvedValue({});
const mockCachePackageDetail = vi.fn().mockResolvedValue(null);
const mockGetCachedPackageDetail = vi.fn();

vi.mock("../services/api", () => ({
  winePackagesApi: {
    show: (...args: unknown[]) => mockShow(...args),
    timeline: (...args: unknown[]) => mockTimeline(...args),
    markCompleted: (...args: unknown[]) => mockMarkCompleted(...args),
    markArrived: (...args: unknown[]) => mockMarkArrived(...args),
    destroy: (...args: unknown[]) => mockDestroy(...args),
  },
  winePackageItemsApi: {
    destroy: (...args: unknown[]) => mockItemDestroy(...args),
    createReview: (...args: unknown[]) => mockCreateReview(...args),
    create: vi.fn(),
    update: vi.fn(),
  },
  shipmentTrackingsApi: { show: (...args: unknown[]) => mockTrackingShow(...args) },
  notificationsApi: { list: vi.fn() },
  winesApi: { search: vi.fn() },
  producersApi: { list: vi.fn() },
  usersApi: { search: vi.fn() },
  categoriesApi: { list: (...args: unknown[]) => mockCategoriesList(...args) },
  imagesApi: { upload: (...args: unknown[]) => mockImagesUpload(...args) },
  reviewsApi: { update: vi.fn(), show: vi.fn() },
}));

let currentUser = { id: 1, display_name: "Reviewer", roles: ["Editor"] };

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
}));

// Offline package cache: the component writes every successful load and reads
// the cache back only when the API fails and a fallback is allowed.
vi.mock("../offline", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../offline")>()),
  cachePackageDetail: (...args: unknown[]) => mockCachePackageDetail(...args),
  getCachedPackageDetail: (...args: unknown[]) => mockGetCachedPackageDetail(...args),
}));

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const packageDetail = {
  id: 7,
  producer_id: 3,
  producer_name: "Penfolds",
  producer_slug: "penfolds",
  reviewer_id: 1,
  reviewer_name: "Reviewer",
  created_by_id: 1,
  status: "arrived",
  source: "unexpected",
  arrived_at: "2026-09-01T09:00:00Z",
  review_deadline: isoDaysFromNow(5),
  reviewed_at: null,
  auto_completed: false,
  notes: "Left at reception",
  review_progress: { requested: 2, reviewed: 1, pending: 1, percent: 50 },
  pending_review_count: 1,
  reviews_complete: false,
  overdue: false,
  days_until_deadline: 5,
  can: {
    update: true,
    manage_items: true,
    manage_attachments: true,
    manage_tracking: true,
    refresh_tracking: true,
    create_review: true,
    destroy: true,
    mark_in_transit: false,
    mark_arrived: false,
    start_reviewing: false,
    mark_completed: true,
    reopen: false,
    cancel: true,
    accept: false,
    reject: false,
  },
  items: [
    {
      id: 11,
      label: "Bin 389 2020",
      wine_slug: "bin-389",
      quantity: 2,
      review_requested: true,
      reviewed: true,
      reviewable: true,
      review_id: 5,
      review_status: "published",
      review_slug: "bin-389-2020",
      pending_review: false,
      condition: "sealed",
      notes: null,
    },
    {
      id: 12,
      label: "Grange 2018",
      wine_slug: "grange",
      wine_name: "Grange",
      vintage_id: 22,
      vintage_year: 2018,
      vintage_no_vintage: false,
      quantity: 1,
      review_requested: true,
      reviewed: false,
      reviewable: true,
      review_id: null,
      review_status: null,
      review_slug: null,
      pending_review: true,
      condition: null,
      notes: "label torn",
    },
    {
      id: 13,
      label: "Unmatched wine",
      wine_slug: null,
      quantity: 1,
      review_requested: false,
      reviewed: false,
      reviewable: false,
      review_id: null,
      review_status: null,
      review_slug: null,
      pending_review: false,
      condition: null,
      notes: null,
    },
  ],
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/wine-packages/7"]}>
      <Routes>
        <Route element={<WinePackageDetail />} path="/wine-packages/:id" />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WinePackageDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: 1, display_name: "Reviewer", roles: ["Editor"] };
    mockShow.mockResolvedValue(packageDetail);
    mockTimeline.mockResolvedValue({ events: [] });
    mockTrackingShow.mockRejectedValue(
      Object.assign(new Error("No tracking recorded for this package"), {
        status: 404,
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("shows the producer, status, source and deadline countdown", async () => {
    renderDetail();

    expect(
      await screen.findByRole("heading", { name: "Penfolds" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Arrived")).toBeInTheDocument();
    expect(screen.getByText("Source: Unexpected delivery")).toBeInTheDocument();
    expect(screen.getByText("Reviewer: Reviewer")).toBeInTheDocument();
    expect(screen.getByText(/Due in 5 days/)).toBeInTheDocument();
    expect(screen.getByText("Left at reception")).toBeInTheDocument();
  });

  it("shows the image gallery when the package has images (view-only for non-managers)", async () => {
    mockShow.mockResolvedValue({
      ...packageDetail,
      images: ["http://img.test/a.png", "http://img.test/b.png"],
      image_ids: [5, 6],
      can: { ...packageDetail.can, update: false, manage_items: false, manage_attachments: false, create_review: false, destroy: false },
    });
    currentUser = { id: 99, display_name: "Viewer", roles: ["Guest"] };

    renderDetail();

    expect(
      await screen.findByRole("heading", { name: "Package images" }),
    ).toBeInTheDocument();
    const thumbs = await screen.findAllByRole("img", { name: "Package image" });
    expect(thumbs).toHaveLength(2);
    // No management UI for viewers.
    expect(screen.queryByText(/Add images/i)).not.toBeInTheDocument();
  });

  it("does not render the image section for a viewer when the package has no images", async () => {
    currentUser = { id: 99, display_name: "Viewer", roles: ["Guest"] };
    mockShow.mockResolvedValue({
      ...packageDetail,
      can: { ...packageDetail.can, update: false, manage_items: false, manage_attachments: false, create_review: false, destroy: false },
    });
    renderDetail();

    await screen.findByRole("heading", { name: "Penfolds" });
    expect(
      screen.queryByRole("heading", { name: "Package images" }),
    ).not.toBeInTheDocument();
  });

  it("offers the image manager to a manager even before any image exists", async () => {
    renderDetail();

    await screen.findByRole("heading", { name: "Penfolds" });
    expect(
      await screen.findByRole("heading", { name: "Package images" }),
    ).toBeInTheDocument();
  });

  it("reports review progress from the API payload", async () => {
    renderDetail();

    expect(await screen.findByText("1/2 reviewed (50%)")).toBeInTheDocument();
    expect(screen.getByText("1 pending")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
  });

  it("renders each wine line with its review state", async () => {
    renderDetail();

    await screen.findByText("Bin 389 2020");
    const table = screen.getByRole("table");

    expect(within(table).getByText("Reviewed")).toBeInTheDocument();
    expect(
      within(table).getByRole("link", { name: "View review" }),
    ).toHaveAttribute(
      "href",
      "/reviews/bin-389-2020?returnTo=%2Fwine-packages%2F7",
    );
    expect(within(table).getByText("Pending")).toBeInTheDocument();
    expect(within(table).getByText("Not requested")).toBeInTheDocument();
    expect(within(table).getByText("label torn")).toBeInTheDocument();
  });

  it("offers exactly the workflow actions the API allows", async () => {
    renderDetail();

    expect(
      await screen.findByRole("button", { name: "Mark completed" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel package" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark arrived" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reopen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Accept and Assign to Me" }),
    ).not.toBeInTheDocument();
  });

  it("completes the package, warning about outstanding reviews, then reloads", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(
      await screen.findByRole("button", { name: "Mark completed" }),
    );

    await waitFor(() => expect(mockMarkCompleted).toHaveBeenCalledWith(7));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("1 review(s) are still outstanding"),
    );
    expect(mockShow).toHaveBeenCalledTimes(2);
  });

  it("only offers Create review for a requested line with no review yet", async () => {
    renderDetail();

    await screen.findByText("Grange 2018");
    const table = screen.getByRole("table");
    expect(
      within(table).getAllByRole("button", { name: "Create review" }),
    ).toHaveLength(1);
  });

  it("scopes the add-wine line form to the package's producer", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(
      await screen.findByRole("button", { name: "+ Add a wine" }),
    );

    // The picker lists one producer's catalogue on mount, so the reviewer
    // chooses a bottle instead of typing a wine name.
    await waitFor(() =>
      expect(winesApi.search).toHaveBeenCalledWith({ producerId: 3 }),
    );
    expect(await screen.findByText(/Wines from/i)).toHaveTextContent(
      /Wines from Penfolds/,
    );
  });

  it("scopes the edit-line form to the package's producer too", async () => {
    const user = userEvent.setup();
    renderDetail();

    await screen.findByText("Grange 2018");
    const table = screen.getByRole("table");
    // The second row is the matched line (it carries a vintage_id), so the
    // picker — and therefore the producer scope — is visible.
    const editButtons = within(table).getAllByRole("button", { name: "Edit" });
    const matchedEdit = editButtons[1];
    if (!matchedEdit) throw new Error("the matched line has no Edit button");
    await user.click(matchedEdit);

    await waitFor(() =>
      expect(winesApi.search).toHaveBeenCalledWith({ producerId: 3 }),
    );
    expect(await screen.findByText(/Wines from/i)).toHaveTextContent(
      /Wines from Penfolds/,
    );
  });

  it("creates the review through the package endpoint with the full form", async () => {
    const user = userEvent.setup();
    mockCategoriesList.mockResolvedValue([]);
    mockCreateReview.mockResolvedValue({ id: 99, slug: "grange-2018" });
    renderDetail();

    await user.click(
      await screen.findByRole("button", { name: "Create review" }),
    );

    // The reused review form mounts in package mode with the line's vintage.
    // Score is a range slider here (label "Score", value shown alongside).
    const titleInput = await screen.findByLabelText<HTMLInputElement>("Title");
    expect(titleInput.value).toMatch(/grange/i);
    const scoreSlider = await screen.findByLabelText("Score");
    await user.click(scoreSlider);
    expect(scoreSlider).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Publish" }));
    await user.click(screen.getByRole("button", { name: "Submit Review" }));

    await waitFor(() =>
      expect(mockCreateReview).toHaveBeenCalledWith(
        7,
        12,
        expect.objectContaining({
          score: 80,
          status: "published",
          title: expect.stringContaining("Grange"),
        }),
      ),
    );
  });

  it("reports when no tracking has been recorded yet", async () => {
    const user = userEvent.setup();
    renderDetail();

    // The tracking panel is collapsed by default; open it first.
    await user.click(
      await screen.findByRole("button", { name: "Show shipment tracking" }),
    );

    expect(
      await screen.findByText("No tracking recorded for this package yet."),
    ).toBeInTheDocument();
  });

  it("hides every management control from a user who is not the reviewer", async () => {
    currentUser = { id: 42, display_name: "Someone else", roles: ["Reviewer"] };
    mockShow.mockResolvedValue({
      ...packageDetail,
      can: Object.fromEntries(Object.keys(packageDetail.can).map((key) => [key, false])),
    });
    renderDetail();

    await screen.findByRole("heading", { name: "Penfolds" });
    expect(
      screen.queryByRole("button", { name: "Mark completed" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Edit package" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ Add a wine" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete package" }),
    ).not.toBeInTheDocument();
  });

  it("shows producer draft actions from viewer-specific capabilities", async () => {
    currentUser = { id: 9, display_name: "Producer Manager", roles: ["Reader"] };
    mockShow.mockResolvedValue({
      ...packageDetail,
      status: "draft",
      source: "producer_request",
      reviewer_id: null,
      reviewer_name: null,
      can: {
        update: true,
        manage_items: true,
        manage_tracking: true,
        refresh_tracking: false,
        create_review: false,
        destroy: false,
        submit: true,
      },
    });
    renderDetail();

    expect(await screen.findByRole("button", { name: "Submit Request" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add a wine" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete package" })).not.toBeInTheDocument();
  });

  it("falls back to the cached copy offline and suppresses every workflow action", async () => {
    vi.stubEnv("VITE_OFFLINE_ENABLED", "true");
    mockShow.mockRejectedValue(new Error("Network unavailable"));
    mockGetCachedPackageDetail.mockResolvedValue({
      data: packageDetail,
      cachedAt: "2026-11-04T10:00:00Z",
    });
    renderDetail();

    expect(
      await screen.findByRole("heading", { name: "Penfolds" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Offline copy/)).toBeInTheDocument();

    // Cached details are read-only: even though the cached `can` map allows
    // every action, no workflow control may be offered offline.
    expect(
      screen.queryByRole("button", { name: "Mark completed" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ Add a wine" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Edit package" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete package" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel package" }),
    ).not.toBeInTheDocument();
  });
});
