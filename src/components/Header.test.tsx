import { render, screen, fireEvent } from "@testing-library/react";
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

function makeUserWithRoles(roles: string[]): User {
  return { ...makeUser(null), roles };
}

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

describe("Header Analytics link", () => {
  function openExtrasMenu() {
    fireEvent.click(screen.getByRole("button", { name: "Extras" }));
  }

  it.each([["Reviewer"], ["Editor"], ["Admin"]])(
    "shows Analytics in Extras for %s role",
    (role) => {
      authState.user = makeUserWithRoles([role]);
      renderHeader();
      openExtrasMenu();
      expect(screen.getByRole("link", { name: "Analytics" })).toBeInTheDocument();
    },
  );

  it.each([[[]], [["Reader"]], [["Guest"]]])(
    "hides Analytics in Extras for non-privileged roles %s",
    (roles) => {
      authState.user = makeUserWithRoles(roles);
      renderHeader();
      openExtrasMenu();
      expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();
    },
  );

  it("hides Analytics in Extras for logged-out visitors", () => {
    authState.user = null;
    renderHeader();
    openExtrasMenu();
    expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();
  });
});

describe("Header Extras links", () => {
  function openExtrasMenu() {
    fireEvent.click(screen.getByRole("button", { name: "Extras" }));
  }

  it("hidden for logged-out visitors (content stays gated)", () => {
    authState.user = null;
    renderHeader();
    openExtrasMenu();
    expect(screen.queryByRole("link", { name: "Wine Packages" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Article Projects" })).not.toBeInTheDocument();
  });

  it("shows gated links but keeps role exemptions when user is Reviewer", () => {
    authState.user = makeUserWithRoles(["Reviewer"]);
    renderHeader();
    openExtrasMenu();
    expect(screen.getByRole("link", { name: "Wine Packages" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Article Projects" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analytics" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
  });
});

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

describe("Header mobile menu", () => {
  it("starts collapsed with aria-expanded=false", () => {
    renderHeader();
    const menuBtn = screen.getByRole("button", { name: "Open menu" });
    expect(menuBtn).toBeInTheDocument();
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(nav).not.toHaveClass("site-header__nav--open");
  });

  it("expands the menu when the button is clicked", () => {
    renderHeader();
    const menuBtn = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(menuBtn);
    expect(menuBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Close menu" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(nav).toHaveClass("site-header__nav--open");
  });

  it("collapses the menu when the button is clicked again", () => {
    renderHeader();
    const menuBtn = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(menuBtn);
    fireEvent.click(menuBtn);
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(nav).not.toHaveClass("site-header__nav--open");
  });

  it("closes the menu when a navigation link is clicked", () => {
    renderHeader();
    const menuBtn = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(menuBtn);
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(nav).toHaveClass("site-header__nav--open");
    fireEvent.click(screen.getByRole("link", { name: "About" }));
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    expect(nav).not.toHaveClass("site-header__nav--open");
  });
});
