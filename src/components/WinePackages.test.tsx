import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WinePackages from "./WinePackages";

// Canned API responses. Every named export the component tree asks for must
// exist here, or Vitest fails the import rather than the assertion.
const mockPackagesList = vi.fn();
const mockItemsCreate = vi.fn();
const mockTrackingShow = vi.fn();
const mockNotificationsList = vi.fn();
const mockWinesSearch = vi.fn();
const mockProducersList = vi.fn();
const mockUsersSearch = vi.fn();

vi.mock("../services/api", () => ({
  winePackagesApi: { list: (...args: unknown[]) => mockPackagesList(...args) },
  winePackageItemsApi: { create: (...args: unknown[]) => mockItemsCreate(...args) },
  shipmentTrackingsApi: { show: (...args: unknown[]) => mockTrackingShow(...args) },
  notificationsApi: { list: (...args: unknown[]) => mockNotificationsList(...args) },
  winesApi: { search: (...args: unknown[]) => mockWinesSearch(...args) },
  producersApi: { list: (...args: unknown[]) => mockProducersList(...args) },
  usersApi: { search: (...args: unknown[]) => mockUsersSearch(...args) },
}));

let currentUser: {
  id: number;
  display_name: string;
  roles: string[];
  can_access_wine_packages: boolean;
} = {
  id: 1,
  display_name: "Reviewer",
  roles: ["Editor"],
  can_access_wine_packages: true,
};

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
}));

// A local-midnight ISO date, matching how the API sends calendar dates.
function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function renderList() {
  return render(
    <MemoryRouter>
      <WinePackages />
    </MemoryRouter>,
  );
}

const packageRow = {
  id: 7,
  producer_id: 3,
  producer_name: "Penfolds",
  producer_slug: "penfolds",
  reviewer_id: 1,
  reviewer_name: "Reviewer",
  status: "arrived",
  source: "unexpected",
  expected_at: null,
  arrived_at: "2026-09-01T09:00:00Z",
  review_deadline: isoDaysFromNow(20),
  items_count: 3,
  pending_review_count: 2,
  review_progress: { requested: 3, reviewed: 1, pending: 2, percent: 33 },
  auto_completed: false,
  tracking_status: null,
  overdue: false,
  days_until_deadline: 20,
  created_at: "2026-09-01T09:00:00Z",
  updated_at: "2026-09-01T09:00:00Z",
};

describe("WinePackages list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = {
      id: 1,
      display_name: "Reviewer",
      roles: ["Editor"],
      can_access_wine_packages: true,
    };
    mockPackagesList.mockResolvedValue({
      items: [packageRow],
      page: 1,
      per_page: 20,
      total_count: 1,
      total_pages: 1,
    });
  });

  it("renders the package row with producer, status and review progress", async () => {
    renderList();

    expect(await screen.findByText("Penfolds")).toBeInTheDocument();
    // Scope the table assertions: the filter dropdowns contain the same labels.
    const table = screen.getByRole("table");
    expect(within(table).getByText("Arrived")).toBeInTheDocument();
    expect(within(table).getByText("Unexpected delivery")).toBeInTheDocument();
    expect(within(table).getByText(/33% \(1\/3\)/)).toBeInTheDocument();
    expect(within(table).getByText("2 pending")).toBeInTheDocument();
  });

  it("shows the review deadline countdown", async () => {
    renderList();

    expect(await screen.findByText("Due in 20 days")).toBeInTheDocument();
  });

  it("offers both ways of recording a package to a content manager", async () => {
    renderList();

    expect(
      await screen.findByRole("link", { name: "+ Record Received Package" }),
    ).toHaveAttribute("href", "/wine-packages/new?mode=arrived");
    expect(
      screen.getByRole("link", { name: "+ Add Expected Package" }),
    ).toHaveAttribute("href", "/wine-packages/new?mode=announced");
  });

  it("asks the API for the first page", async () => {
    renderList();

    await waitFor(() => expect(mockPackagesList).toHaveBeenCalled());
    expect(mockPackagesList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, per_page: 20 }),
    );
  });

  it("renders the status, source, overdue and search filters", async () => {
    renderList();

    expect(await screen.findByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Source")).toBeInTheDocument();
    expect(screen.getByLabelText("Overdue only")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("hides the create actions from a user without a package role", async () => {
    currentUser = {
      id: 9,
      display_name: "Reader",
      roles: ["Reader"],
      can_access_wine_packages: false,
    };
    renderList();

    await screen.findByText("Penfolds");
    expect(
      screen.queryByRole("link", { name: "+ Record Received Package" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "+ Add Expected Package" }),
    ).not.toBeInTheDocument();
  });

  it("offers a producer-specific request action while keeping editorial actions hidden", async () => {
    currentUser = {
      id: 9,
      display_name: "Producer Manager",
      roles: ["Reader"],
      can_access_wine_packages: true,
    };
    renderList();

    await screen.findByText("Penfolds");
    expect(
      screen.queryByRole("link", { name: "+ Record Received Package" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "+ Add Expected Package" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ New Package Request" })).toHaveAttribute(
      "href",
      "/wine-packages/new?mode=request",
    );
  });

  it("shows the empty state when there are no packages", async () => {
    mockPackagesList.mockResolvedValue({
      items: [],
      page: 1,
      per_page: 20,
      total_count: 0,
      total_pages: 0,
    });
    renderList();

    expect(await screen.findByText("No wine packages found.")).toBeInTheDocument();
  });

  it("surfaces a load failure with a retry", async () => {
    mockPackagesList.mockRejectedValue(new Error("Network down"));
    renderList();

    expect(await screen.findByText("Network down")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});