import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mock } from "vitest";
import { MemoryRouter } from "react-router-dom";
import FollowButton from "./FollowButton";

const mockStatus: Mock = vi.fn();
const mockFollow: Mock = vi.fn();
const mockUnfollow: Mock = vi.fn();

vi.mock("../services/api", () => ({
  followsApi: {
    status: (kind: string, id: string | number) => mockStatus(kind, id),
    follow: (payload: unknown) => mockFollow(payload),
    unfollow: (id: number) => mockUnfollow(id),
  },
}));

let authState: { isAuthenticated: boolean; user: unknown; loading: boolean };
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function renderButton(kind = "Wine", identifier = "penfolds-bin-389") {
  return render(
    <MemoryRouter>
      <FollowButton kind={kind as "Wine"} identifier={identifier} />
    </MemoryRouter>,
  );
}

describe("FollowButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { isAuthenticated: true, user: { id: 1 }, loading: false };
    mockStatus.mockResolvedValue({
      followable_type: "Wine",
      followable_id: 7,
      follow_id: null,
      following: false,
    });
  });

  it("asks the API for the current follow state on mount", async () => {
    renderButton();

    await waitFor(() => expect(mockStatus).toHaveBeenCalledWith("Wine", "penfolds-bin-389"));
    expect(await screen.findByRole("button", { name: "Follow" })).toBeInTheDocument();
  });

  it("shows the following state when the user already follows", async () => {
    mockStatus.mockResolvedValue({
      followable_type: "Wine",
      followable_id: 7,
      follow_id: 42,
      following: true,
    });
    renderButton();

    expect(await screen.findByRole("button", { name: "Following" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Following" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("follows and adopts the server-confirmed state", async () => {
    const user = userEvent.setup();
    mockFollow.mockResolvedValue({
      id: 42,
      followable_type: "Wine",
      followable_id: 7,
      target_label: null,
      target_slug: null,
      target_path: null,
      following: true,
      created_at: null,
    });
    renderButton();

    await user.click(await screen.findByRole("button", { name: "Follow" }));

    await waitFor(() =>
      expect(mockFollow).toHaveBeenCalledWith({
        followable_type: "Wine",
        followable_slug: "penfolds-bin-389",
      }),
    );
    expect(await screen.findByRole("button", { name: "Following" })).toBeInTheDocument();
  });

  it("unfollows by follow id", async () => {
    const user = userEvent.setup();
    mockStatus.mockResolvedValue({
      followable_type: "Wine",
      followable_id: 7,
      follow_id: 42,
      following: true,
    });
    mockUnfollow.mockResolvedValue({ following: false });
    renderButton();

    await user.click(await screen.findByRole("button", { name: "Following" }));

    await waitFor(() => expect(mockUnfollow).toHaveBeenCalledWith(42));
    expect(await screen.findByRole("button", { name: "Follow" })).toBeInTheDocument();
  });

  it("shows the API error and keeps the previous state", async () => {
    const user = userEvent.setup();
    mockFollow.mockRejectedValue(new Error("Forbidden"));
    renderButton();

    await user.click(await screen.findByRole("button", { name: "Follow" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
    expect(screen.getByRole("button", { name: "Follow" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("prompts anonymous users to sign in instead of toggling", async () => {
    authState = { isAuthenticated: false, user: null, loading: false };
    renderButton();

    const link = await screen.findByRole("link", { name: "Sign in to follow" });
    expect(link).toHaveAttribute("href", "/login");
    expect(mockStatus).not.toHaveBeenCalled();
  });
});