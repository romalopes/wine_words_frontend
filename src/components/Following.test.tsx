import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mock } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Following from "./Following";

const mockList: Mock = vi.fn();
const mockUnfollow: Mock = vi.fn();

vi.mock("../services/api", () => ({
  followsApi: {
    list: (params?: unknown) => mockList(params),
    follow: vi.fn(),
    unfollow: (id: number) => mockUnfollow(id),
    status: vi.fn(),
    statuses: vi.fn(),
    preferences: vi.fn().mockResolvedValue({
      follow_in_app: true,
      follow_email: false,
      digest_cadence: "none",
      digest_last_sent_at: null,
    }),
    updatePreferences: vi.fn(),
  },
}));

let authState: { isAuthenticated: boolean; user: unknown; loading: boolean };
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

const followRows = [
  {
    id: 1,
    followable_type: "Producer",
    followable_id: 10,
    target_label: "Penfolds",
    target_slug: "penfolds",
    target_path: "/producers/penfolds",
    following: true,
    created_at: "2026-10-20T00:00:00Z",
  },
  {
    id: 2,
    followable_type: "Wine",
    followable_id: 20,
    target_label: "Bin 389",
    target_slug: "bin-389",
    target_path: "/wines/bin-389",
    following: true,
    created_at: "2026-10-21T00:00:00Z",
  },
];

function renderFollowing() {
  return render(
    <MemoryRouter>
      <Following />
    </MemoryRouter>,
  );
}

describe("Following", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = {
      isAuthenticated: true,
      user: { id: 1, display_name: "Reader", roles: ["Reader"] },
      loading: false,
    };
    mockList.mockResolvedValue({
      items: followRows,
      page: 1,
      per_page: 20,
      total_count: 2,
      total_pages: 1,
    });
    mockUnfollow.mockResolvedValue({ following: false });
  });

  it("lists the user's follows with links to each target", async () => {
    renderFollowing();

    const producerLink = await screen.findByRole("link", { name: "Penfolds" });
    expect(producerLink).toHaveAttribute("href", "/producers/penfolds");
    expect(screen.getByRole("link", { name: "Bin 389" })).toHaveAttribute(
      "href",
      "/wines/bin-389",
    );
  });

  it("filters by type", async () => {
    const user = userEvent.setup();
    renderFollowing();

    await screen.findByRole("link", { name: "Penfolds" });
    await user.click(screen.getByRole("tab", { name: "Wines" }));

    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ type: "Wine" }),
      ),
    );
  });

  it("unfollows optimistically and reloads when the API refuses", async () => {
    const user = userEvent.setup();
    renderFollowing();

    await user.click(await screen.findByRole("button", { name: "Unfollow Penfolds" }));

    await waitFor(() => expect(mockUnfollow).toHaveBeenCalledWith(1));
    // Optimistic removal: the row disappears without a reload on success.
    expect(screen.queryByRole("link", { name: "Penfolds" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bin 389" })).toBeInTheDocument();
  });

  it("restores rows when unfollow fails", async () => {
    const user = userEvent.setup();
    mockUnfollow.mockRejectedValue(new Error("Forbidden"));
    renderFollowing();

    await user.click(await screen.findByRole("button", { name: "Unfollow Penfolds" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Penfolds" })).toBeInTheDocument(),
    );
  });

  it("shows an empty state", async () => {
    mockList.mockResolvedValue({
      items: [],
      page: 1,
      per_page: 20,
      total_count: 0,
      total_pages: 0,
    });
    renderFollowing();

    expect(await screen.findByText("No follows yet.")).toBeInTheDocument();
  });

  it("prompts signed-out users to sign in", async () => {
    authState = { isAuthenticated: false, user: null, loading: false };
    renderFollowing();

    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(mockList).not.toHaveBeenCalled();
  });

  it("paginates when there are more pages", async () => {
    const user = userEvent.setup();
    mockList.mockResolvedValue({
      items: followRows,
      page: 2,
      per_page: 20,
      total_count: 45,
      total_pages: 3,
    });
    renderFollowing();

    await screen.findByRole("link", { name: "Penfolds" });
    // The component's own page counter is at 1 after the first load, so the
    // first "Next" requests page 2.
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
  });
});