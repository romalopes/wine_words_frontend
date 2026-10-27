import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { usersApi } from "../services/api";
import UserDetail from "./UserDetail";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 99, roles: ["Admin"] },
    startImpersonation: vi.fn(),
  }),
}));

vi.mock("../services/api", () => ({
  usersApi: {
    show: vi.fn(),
    updateAccount: vi.fn(),
    assignRoles: vi.fn(),
    assignSubscription: vi.fn(),
    roles: vi.fn().mockResolvedValue([
      { id: 1, name: "Admin" },
      { id: 2, name: "Editor" },
      { id: 3, name: "Reviewer" },
      { id: 4, name: "Reader" },
      { id: 5, name: "Guest" },
    ]),
    producerMemberships: {
      create: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    },
  },
  producersApi: { search: vi.fn().mockResolvedValue([]) },
  subscriptionsApi: { list: vi.fn().mockResolvedValue([]) },
  countriesApi: {
    list: vi.fn().mockResolvedValue([
      { id: 1, name: "United States", slug: "united-states", producers_count: 0 },
    ]),
  },
}));

const userDetail = {
  id: 1,
  email: "person@example.com",
  display_name: "Jane Doe",
  first_name: "Jane",
  last_name: "Doe",
  role_ids: [1],
  roles: ["Reader"],
  account_status: "active",
  subscription: null,
  analytics_opt_out: false,
  producer_memberships: [],
  invitation_summary: { count: 0, latest: null },
  account: {
    first_name: "Jane",
    last_name: "Doe",
    phone: "+1 555 0100",
    date_of_birth: "1990-05-01",
    address: {
      street_address: "1 Main Street",
      city: "Portland",
      state: "OR",
      postal_code: "97201",
      country_id: 1,
    },
  },
} satisfies import("../types/user").UserDetail;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/users/1"]}>
      <Routes>
        <Route path="/users/:id" element={<UserDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("UserDetail personal information", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.show).mockResolvedValue(userDetail);
    vi.mocked(usersApi.updateAccount).mockResolvedValue(userDetail.account);
  });

  it("loads and saves another user's personal information", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByLabelText("First name")).toHaveValue("Jane");
    expect(screen.getByLabelText("City")).toHaveValue("Portland");

    await user.clear(screen.getByLabelText("Phone"));
    await user.type(screen.getByLabelText("Phone"), "+1 555 0199");
    await user.click(screen.getByRole("button", { name: "Save personal information" }));

    await waitFor(() => expect(usersApi.updateAccount).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        first_name: "Jane",
        last_name: "Doe",
        phone: "+1 555 0199",
        address: expect.objectContaining({ city: "Portland", country_id: "1" }),
      }),
    ));
    expect(screen.getByText("Personal information updated.")).toBeInTheDocument();
  });
});