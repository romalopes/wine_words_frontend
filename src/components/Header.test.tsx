import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "./Header";
import type { User } from "../types/authentication";

const authState: { user: User | null } = { user: null };

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
    realUser: null,
    isImpersonating: false,
    session: authState.user ? { token: "t" } : null,
    signOut: vi.fn(),
    stopImpersonation: vi.fn(),
  }),
}));

vi.mock("../contexts/TestAccessContext", () => ({
  useTestAccess: () => ({ exit: vi.fn() }),
}));

vi.mock("../services/api", () => ({
  categoriesApi: {
    list: vi.fn().mockResolvedValue([]),
    counts: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("./NotificationBell", () => ({ default: () => null }));

function makeUser(subscriptionName: string | null): User {
  return {
    id: 1,
    email: "taster@example.com",
    display_name: "Taster",
    first_name: "Tas",
    last_name: "Ter",
    roles: [],
    analytics_opt_out: false,
    subscription: subscriptionName ? { id: 2, name: subscriptionName } : null,
    billing_provider: null,
    can_manage_billing: true,
    subscription_status: null,
    subscription_change: null,
  };
}

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

describe("Header Subscribe CTA", () => {
  it("shows Subscribe for logged-out visitors", () => {
    authState.user = null;
    renderHeader();
    expect(screen.getByRole("link", { name: "Subscribe" })).toBeInTheDocument();
  });

  it("shows Subscribe for FREE-tier users", () => {
    authState.user = makeUser("FREE");
    renderHeader();
    expect(screen.getByRole("link", { name: "Subscribe" })).toBeInTheDocument();
  });

  it("shows Subscribe when the session carries no subscription stub", () => {
    authState.user = makeUser(null);
    renderHeader();
    expect(screen.getByRole("link", { name: "Subscribe" })).toBeInTheDocument();
  });

  it("hides Subscribe for paid subscribers", () => {
    authState.user = makeUser("Consumer");
    renderHeader();
    expect(screen.queryByRole("link", { name: "Subscribe" })).not.toBeInTheDocument();
  });
});
