import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AccountSettings from "./AccountSettings";
import { accountApi } from "../services/api";
import type { User } from "../types/authentication";

const refreshSession = vi.fn();
const authState: { user: User | null } = { user: null };

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: authState.user, refreshSession }),
}));
vi.mock("../services/api", () => ({
  accountApi: {
    show: vi.fn().mockResolvedValue({ first_name: "Élodie", last_name: "Smith", phone: null, date_of_birth: null, address: null }),
    update: vi.fn().mockResolvedValue({}),
    myProducers: vi.fn().mockResolvedValue([]),
  },
  countriesApi: { list: vi.fn().mockResolvedValue([]) },
  identitiesApi: { list: vi.fn().mockResolvedValue({ identities: [], password_authentication: true }) },
}));
vi.mock("../services/socialProviders", () => ({
  availableProviders: () => [], providerLabel: (value: string) => value,
  signInWith: vi.fn(), ProviderCancelledError: class extends Error {},
}));

function makeUser(subscriptionName: string | null): User {
  return {
    id: 1,
    email: "taster@example.com",
    display_name: "Taster",
    first_name: "Élodie",
    last_name: "Smith",
    roles: [],
    analytics_opt_out: false,
    subscription: subscriptionName ? { id: 2, name: subscriptionName } : null,
    billing_provider: null,
    can_manage_billing: true,
    subscription_status: "active",
    subscription_change: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountSettings />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.user = null;
});

it("loads the account names, saves changes without username, and refreshes the header", async () => {
  const user = userEvent.setup();
  renderPage();
  expect(await screen.findByLabelText("First name")).toHaveValue("Élodie");
  expect(screen.getByLabelText("Last name")).toHaveValue("Smith");
  expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
  await user.clear(screen.getByLabelText("Last name"));
  await user.type(screen.getByLabelText("Last name"), "O’Connor");
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() => expect(refreshSession).toHaveBeenCalled());
  expect(accountApi.update).toHaveBeenCalledWith(expect.objectContaining({ first_name: "Élodie", last_name: "O’Connor" }));
  expect(vi.mocked(accountApi.update).mock.calls[0]![0]).not.toHaveProperty("user_name");
  expect(vi.mocked(accountApi.update).mock.calls[0]![0]).not.toHaveProperty("display_name");
});

describe("Membership card", () => {
  it("shows the paid plan name with a manage link to /subscribe", async () => {
    authState.user = makeUser("Consumer");
    renderPage();

    expect(await screen.findByText("Membership")).toBeInTheDocument();
    expect(screen.getByText("Consumer")).toBeInTheDocument();
    const manageLink = screen.getByRole("link", { name: "Manage your plan" });
    expect(manageLink).toHaveAttribute("href", "/subscribe");
  });

  it("falls back to Free when the session carries no subscription stub", async () => {
    authState.user = makeUser(null);
    renderPage();

    expect(await screen.findByText("Membership")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage your plan" })).toHaveAttribute(
      "href",
      "/subscribe",
    );
  });
});
