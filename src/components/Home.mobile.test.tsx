import { fireEvent, render, screen } from "@testing-library/react"
import Home from "./Home"

function setMobileViewport(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(max-width: 768px)" ? matches : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe("Home mobile Finder", () => {
  it("collapses taste controls on mobile and exposes an accessible toggle", () => {
    setMobileViewport(true)
    render(<Home />)

    const toggle = screen.getByRole("button", { name: "Adjust taste controls" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(document.getElementById("wine-finder-controls")).toHaveClass(
      "wine-controls--mobile-collapsed",
    )

    fireEvent.click(toggle)
    expect(screen.getByRole("button", { name: "Hide taste controls" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    expect(document.getElementById("wine-finder-controls")).not.toHaveClass(
      "wine-controls--mobile-collapsed",
    )
  })

  it("keeps Finder controls expanded on desktop", () => {
    setMobileViewport(false)
    render(<Home />)

    expect(document.getElementById("wine-finder-controls")).not.toHaveClass(
      "wine-controls--mobile-collapsed",
    )
  })
})