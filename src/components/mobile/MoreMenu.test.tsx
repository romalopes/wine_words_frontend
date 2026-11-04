import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import MoreMenu from "./MoreMenu"
import type { User } from "../../types/authentication"

const authState: { user: User | null } = { user: null }

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: authState.user }),
}))

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: "taster@example.com",
    display_name: "Taster",
    first_name: "Tas",
    last_name: "Ter",
    roles: [],
    analytics_opt_out: false,
    subscription: null,
    billing_provider: null,
    can_manage_billing: true,
    subscription_status: null,
    can_access_wine_packages: false,
    subscription_change: null,
    ...overrides,
  }
}

function renderMenu(onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <MoreMenu onClose={onClose} />
    </MemoryRouter>,
  )
  return onClose
}

beforeEach(() => {
  authState.user = null
})

describe("MoreMenu", () => {
  it("renders the Discover group with secondary destinations", () => {
    renderMenu()

    expect(screen.getByRole("dialog", { name: "More navigation" })).toBeInTheDocument()
    for (const label of ["Finder", "Quiz", "Wines", "Producers", "Search"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole("link", { name: "Finder" })).toHaveAttribute("href", "/finder")
    expect(screen.getByRole("link", { name: "Quiz" })).toHaveAttribute("href", "/quiz")
    expect(screen.getByRole("link", { name: "Wines" })).toHaveAttribute("href", "/wines")
    expect(screen.getByRole("link", { name: "Producers" })).toHaveAttribute(
      "href",
      "/producers",
    )
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search")
  })

  it("hides signed-in links and the Staff group for anonymous visitors", () => {
    renderMenu()

    expect(screen.queryByRole("link", { name: "Notifications" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Following" })).not.toBeInTheDocument()
    expect(screen.queryByText("Staff")).not.toBeInTheDocument()
    // Anonymous visitors are pointed at the sign-in page.
    expect(screen.getByRole("link", { name: "Profile & settings" })).toHaveAttribute(
      "href",
      "/login",
    )
  })

  it("shows signed-in links for an authenticated Reader", () => {
    authState.user = makeUser({ roles: ["Reader"] })
    renderMenu()

    expect(screen.getByRole("link", { name: "Notifications" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Following" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Profile & settings" })).toHaveAttribute(
      "href",
      "/account",
    )
    // A plain Reader sees no staff destinations.
    expect(screen.queryByText("Staff")).not.toBeInTheDocument()
  })

  it("shows only Wine Packages for a user with package access", () => {
    authState.user = makeUser({ roles: ["Reader"], can_access_wine_packages: true })
    renderMenu()

    expect(screen.getByRole("link", { name: "Wine Packages" })).toHaveAttribute(
      "href",
      "/wine-packages",
    )
    expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument()
  })

  it("shows all staff destinations for an Admin", () => {
    authState.user = makeUser({ roles: ["Admin"] })
    renderMenu()

    for (const label of ["Wine Packages", "Article Projects", "Analytics", "Settings", "Admin"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument()
    }
  })

  it("calls onClose when Escape is pressed", () => {
    const onClose = renderMenu()

    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("calls onClose when a link is followed", () => {
    const onClose = renderMenu()

    fireEvent.click(screen.getByRole("link", { name: "Finder" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
