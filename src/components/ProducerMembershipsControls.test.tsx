import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { producersApi, usersApi } from "../services/api";
import type { ProducerMembership } from "../types/user";
import ProducerMembershipsControls from "./ProducerMembershipsControls";

vi.mock("../services/api", () => ({
  producersApi: { search: vi.fn(), getMemberships: vi.fn() },
  usersApi: {
    search: vi.fn(),
    producerMemberships: {
      create: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    },
  },
}));

const MEMBERSHIP: ProducerMembership = {
  id: 1,
  user: { id: 5, display_name: "Admin", email: "admin@example.com" },
  producer: {
    id: 100,
    name: "Château Margaux",
    slug: "chateau-margaux",
    country: "France",
  },
  membership_type: "manager",
  created_by: { id: 2, display_name: "Root" },
  created_at: "2024-01-01T00:00:00Z",
};

const { user: _embeddedUser, ...USER_DETAIL_MEMBERSHIP } = MEMBERSHIP;

function renderUserMode(memberships = [USER_DETAIL_MEMBERSHIP]) {
  return render(
    <MemoryRouter>
      <ProducerMembershipsControls
        userId={5}
        initialMemberships={memberships}
        canManage
      />
    </MemoryRouter>,
  );
}

function renderProducerMode(canManage = true) {
  return render(
    <MemoryRouter>
      <ProducerMembershipsControls producerId={100} canManage={canManage} />
    </MemoryRouter>,
  );
}

async function advanceDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

describe("ProducerMembershipsControls", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.resetAllMocks();
    vi.mocked(producersApi.search).mockResolvedValue([]);
    vi.mocked(producersApi.getMemberships).mockResolvedValue([]);
    vi.mocked(usersApi.search).mockResolvedValue([]);
    vi.mocked(usersApi.producerMemberships.destroy).mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders user-mode memberships and all membership types", () => {
    renderUserMode();

    expect(
      screen.getByRole("link", { name: "Château Margaux" }),
    ).toHaveAttribute("href", "/producers/chateau-margaux");
    expect(screen.getByText(/Linked by Root/)).toBeInTheDocument();
    const select = screen.getByLabelText("Membership type");
    expect(select).toHaveValue("manager");
    expect(within(select).getByRole("option", { name: "Owner" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Contributor" })).toBeInTheDocument();
  });

  it("debounces producer search, filters linked producers, and links a result", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(producersApi.search).mockResolvedValue([
      {
        id: 100,
        name: "Château Margaux",
        slug: "chateau-margaux",
        country: { id: 1, name: "France", slug: "france" },
      },
      {
        id: 200,
        name: "Domaine Romanée",
        slug: "domaine-romanee",
        country: { id: 1, name: "France", slug: "france" },
      },
    ]);
    vi.mocked(usersApi.producerMemberships.create).mockResolvedValue({
      ...MEMBERSHIP,
      id: 2,
      producer: {
        id: 200,
        name: "Domaine Romanée",
        slug: "domaine-romanee",
        country: "France",
      },
      membership_type: "owner",
    });
    renderUserMode();

    const search = screen.getByLabelText("Search producers by name");
    await user.type(search, "rom");
    expect(producersApi.search).not.toHaveBeenCalled();
    await advanceDebounce();

    expect(producersApi.search).toHaveBeenCalledWith("rom");
    expect(screen.queryByRole("button", { name: /Château Margaux/ })).not.toBeInTheDocument();
    const result = await screen.findByRole("button", { name: /Domaine Romanée/ });
    await user.selectOptions(screen.getByLabelText("Membership type"), "owner");
    await user.click(result);

    await waitFor(() =>
      expect(usersApi.producerMemberships.create).toHaveBeenCalledWith(
        5,
        200,
        "owner",
      ),
    );
    expect(search).toHaveValue("");
    expect(screen.getByRole("link", { name: "Domaine Romanée" })).toBeInTheDocument();
  });

  it("updates a membership type and uses the returned membership", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(usersApi.producerMemberships.update).mockResolvedValue({
      ...MEMBERSHIP,
      membership_type: "owner",
    });
    renderUserMode();

    await user.selectOptions(
      screen.getByLabelText("Membership type for Château Margaux"),
      "owner",
    );

    await waitFor(() =>
      expect(usersApi.producerMemberships.update).toHaveBeenCalledWith(
        5,
        1,
        "owner",
      ),
    );
    expect(
      screen.getByText("Owner", { selector: ".membership-badge" }),
    ).toBeInTheDocument();
  });

  it("requires confirmation before unlinking", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderUserMode();

    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(usersApi.producerMemberships.destroy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Unlink" }));
    await waitFor(() =>
      expect(usersApi.producerMemberships.destroy).toHaveBeenCalledWith(5, 1),
    );
    expect(screen.getByText("No linked producers yet")).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("shows API failures inline", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(usersApi.producerMemberships.update).mockRejectedValue(
      new Error("Update denied"),
    );
    renderUserMode();

    await user.selectOptions(
      screen.getByLabelText("Membership type for Château Margaux"),
      "owner",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Update denied");
  });

  it("loads linked users and hides management controls for read-only viewers", async () => {
    vi.mocked(producersApi.getMemberships).mockResolvedValue([MEMBERSHIP]);
    renderProducerMode(false);

    expect(await screen.findByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/users/5",
    );
    expect(screen.queryByLabelText("Search users by name or email")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlink" })).not.toBeInTheDocument();
  });

  it("searches users through a pagination envelope and links with producer argument order", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
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
      total_pages: 1,
    });
    vi.mocked(usersApi.producerMemberships.create).mockResolvedValue({
      ...MEMBERSHIP,
      id: 31,
      user: { id: 9, display_name: "Ada Lovelace", email: "ada@example.com" },
      membership_type: "contributor",
    });
    renderProducerMode();
    await screen.findByText("No linked users yet");

    const search = screen.getByLabelText("Search users by name or email");
    await user.type(search, "ada");
    await advanceDebounce();
    const result = await screen.findByRole("button", { name: /Ada Lovelace/ });
    await user.selectOptions(screen.getByLabelText("Membership type"), "contributor");
    await user.click(result);

    await waitFor(() =>
      expect(usersApi.producerMemberships.create).toHaveBeenCalledWith(
        9,
        100,
        "contributor",
      ),
    );
    expect(screen.getByLabelText("1 linked users")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ada Lovelace" })).toBeInTheDocument();
  });

  it("uses the linked user's id when updating and removing in producer mode", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(producersApi.getMemberships).mockResolvedValue([MEMBERSHIP]);
    vi.mocked(usersApi.producerMemberships.update).mockResolvedValue({
      ...MEMBERSHIP,
      membership_type: "owner",
    });
    renderProducerMode();

    await user.selectOptions(
      await screen.findByLabelText("Membership type for Admin"),
      "owner",
    );
    await waitFor(() =>
      expect(usersApi.producerMemberships.update).toHaveBeenCalledWith(
        5,
        1,
        "owner",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Unlink" }));
    await waitFor(() =>
      expect(usersApi.producerMemberships.destroy).toHaveBeenCalledWith(5, 1),
    );
  });
});