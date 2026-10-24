import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { producersApi, usersApi, winesApi } from "../services/api";
import ProducerDetail from "./ProducerDetail";

const authState: { user: { id: number; roles: string[] } | null } = { user: null };

vi.mock("../services/api", () => ({
  producersApi: { show: vi.fn(), getMemberships: vi.fn() },
  usersApi: {
    search: vi.fn(),
    producerMemberships: { create: vi.fn() },
  },
  winesApi: { list: vi.fn() },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: authState.user }),
}));
vi.mock("./WineTable", () => ({ default: () => <div>Wine results</div> }));
vi.mock("./RegionSearch", () => ({ default: () => null }));
vi.mock("./GrapeSearch", () => ({ default: () => null }));

function renderProducer(path = "/producers/unknown-producer") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/producers/:slug" element={<ProducerDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProducerDetail loading", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authState.user = null;
    vi.mocked(producersApi.show).mockResolvedValue({
      id: 7, slug: "unknown-producer", name: "Unknown Producer",
    });
    vi.mocked(producersApi.getMemberships).mockResolvedValue([]);
    vi.mocked(usersApi.search).mockResolvedValue({
      items: [], page: 1, per_page: 20, total_count: 0, total_pages: 1,
    });
    vi.mocked(winesApi.list).mockResolvedValue([]);
  });

  it.each([
    "/producers/unknown-producer",
    "/producers/unknown-producer?returnTo=%2Fwines%2F00-vgw-chardonnay",
  ])("finishes loading without repeated requests at %s", async (path) => {
    const view = renderProducer(path);
    expect(await screen.findByRole("heading", { name: "Unknown Producer" })).toBeInTheDocument();
    expect(await screen.findByText("No wines are associated with this producer yet.")).toBeInTheDocument();
    view.rerender(
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/producers/:slug" element={<ProducerDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(producersApi.show).toHaveBeenCalledExactlyOnceWith("unknown-producer");
    expect(winesApi.list).toHaveBeenCalledExactlyOnceWith({ producer_id: 7, page: 1, per_page: 20 });
    if (path.includes("returnTo")) {
      expect(screen.getByRole("link", { name: /Back to Wine$/ })).toHaveAttribute("href", "/wines/00-vgw-chardonnay");
    }
  });

  it("shows a failed producer request instead of staying on the loading screen", async () => {
    vi.mocked(producersApi.show).mockRejectedValue(new Error("Producer not found"));
    renderProducer();
    expect(await screen.findByText("Producer not found")).toBeInTheDocument();
    expect(screen.queryByText("Loading producer details…")).not.toBeInTheDocument();
    expect(winesApi.list).not.toHaveBeenCalled();
  });

  it("waits for wines before showing the empty state", async () => {
    let resolveWines!: (value: []) => void;
    vi.mocked(winesApi.list).mockReturnValue(new Promise((resolve) => { resolveWines = resolve; }));
    renderProducer();
    expect(await screen.findByText("Loading wines...")).toBeInTheDocument();
    expect(screen.queryByText("No wines are associated with this producer yet.")).not.toBeInTheDocument();
    await act(async () => resolveWines([]));
    expect(await screen.findByText("No wines are associated with this producer yet.")).toBeInTheDocument();
  });

  it("labels each linked user with their membership type (issue #191)", async () => {
    authState.user = { id: 1, roles: ["Admin"] };
    vi.mocked(producersApi.getMemberships).mockResolvedValue([
      {
        id: 31,
        membership_type: "owner",
        user: { id: 9, display_name: "Ada Lovelace", email: "ada@example.com" },
        producer: { id: 7, name: "Unknown Producer", slug: "unknown-producer", country: "Australia" },
        created_by: null,
        created_at: "2026-10-24T00:00:00Z",
      },
      {
        id: 32,
        membership_type: "contributor",
        user: { id: 10, display_name: "Grace Hopper", email: "grace@example.com" },
        producer: { id: 7, name: "Unknown Producer", slug: "unknown-producer", country: "Australia" },
        created_by: null,
        created_at: "2026-10-24T00:00:00Z",
      },
    ]);

    renderProducer();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Owner", { selector: ".membership-badge" })).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(
      screen.getByText("Contributor", { selector: ".membership-badge" }),
    ).toBeInTheDocument();
  });

  it("lets an admin search for and link a user with a membership type", async () => {
    authState.user = { id: 1, roles: ["Admin"] };
    vi.mocked(usersApi.search).mockResolvedValue({
      items: [
        {
          id: 9,
          display_name: "Ada Lovelace",
          email: "ada@example.com",
          role_ids: [],
          roles: [],
          subscription: null,
        },
      ],
      page: 1,
      per_page: 20,
      total_count: 1,
      total_pages: 1,
    });
    vi.mocked(usersApi.producerMemberships.create).mockResolvedValue({
      id: 31,
      membership_type: "owner",
      user: { id: 9, display_name: "Ada Lovelace", email: "ada@example.com" },
      producer: { id: 7, name: "Unknown Producer", slug: "unknown-producer", country: null },
      created_by: { id: 1, display_name: "Admin User" },
      created_at: "2026-10-24T00:00:00Z",
    });

    renderProducer();

    const search = await screen.findByRole("searchbox", { name: /Search users by name or email/i });
    expect(screen.getByRole("heading", { name: "Add a user" })).toBeInTheDocument();
    expect(screen.getByLabelText("0 linked users")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "ada" } });
    expect(await screen.findByRole("button", { name: /Ada Lovelace/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Membership type"), { target: { value: "owner" } });
    fireEvent.click(screen.getByRole("button", { name: /Ada Lovelace/ }));

    await waitFor(() => {
      expect(usersApi.producerMemberships.create).toHaveBeenCalledWith(9, 7, "owner");
    });
    expect(
      await screen.findByText("Owner", { selector: ".membership-badge" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("1 linked users")).toBeInTheDocument();
    expect(search).toHaveValue("");
  });

  it("shows an informative empty state when no users are linked", async () => {
    authState.user = { id: 1, roles: ["Admin"] };
    renderProducer();

    expect(await screen.findByRole("heading", { name: "No linked users yet" })).toBeInTheDocument();
    expect(
      screen.getByText("Search above to give someone access to this producer."),
    ).toBeInTheDocument();
  });

  it("does not offer membership linking to reviewers", async () => {
    authState.user = { id: 2, roles: ["Reviewer"] };
    renderProducer();

    expect(await screen.findByRole("heading", { name: "Linked Users" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: /Search users by name or email/i })).not.toBeInTheDocument();
    expect(usersApi.search).not.toHaveBeenCalled();
  });
});
