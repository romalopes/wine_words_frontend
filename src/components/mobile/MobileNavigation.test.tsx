import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import MobileNavigation from "./MobileNavigation"

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}))

function renderNav(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MobileNavigation />
    </MemoryRouter>,
  )
}

describe("MobileNavigation", () => {
  it("renders the three primary destinations and the More trigger", () => {
    renderNav()

    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Reviews" })).toHaveAttribute(
      "href",
      "/reviews",
    )
    expect(screen.getByRole("link", { name: "Articles" })).toHaveAttribute(
      "href",
      "/articles",
    )
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument()
  })

  it("marks the active route with aria-current", () => {
    renderNav(["/reviews"])

    expect(screen.getByRole("link", { name: "Reviews" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    )
  })

  it("opens the More sheet and closes it with the close button", () => {
    renderNav()

    fireEvent.click(screen.getByRole("button", { name: "More" }))
    expect(
      screen.getByRole("dialog", { name: "More navigation" }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
