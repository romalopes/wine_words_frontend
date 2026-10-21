import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { ReviewsManagement } from "./ContentManagementList"

const all = vi.fn()
const updateStatus = vi.fn()
let currentUser: { roles: string[] } | null = { roles: ["Editor"] }

vi.mock("../services/api", () => ({
  reviewsApi: {
    all: (...args: unknown[]) => all(...args),
    updateStatus: (...args: unknown[]) => updateStatus(...args),
  },
  articlesApi: { list: vi.fn(), updateStatus: vi.fn() },
}))
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: currentUser }) }))

function renderPage(entry = "/settings/reviews?status=draft&deadline=overdue&scope=mine") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/settings/reviews" element={<ReviewsManagement />} /></Routes>
    </MemoryRouter>,
  )
}

describe("ReviewsManagement", () => {
  beforeEach(() => {
    currentUser = { roles: ["Editor"] }
    all.mockReset().mockResolvedValue({
      items: [{ id: 1, slug: "estate-review", title: "Estate review", status: "draft", reviewer_name: "Editor", deadline: "2026-10-20", overdue: true, days_until_deadline: -1, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-02T12:00:00Z" }],
      page: 1, per_page: 20, total_count: 1, total_pages: 1,
    })
    updateStatus.mockReset().mockResolvedValue(undefined)
  })

  it("sends URL filters to the paginated endpoint and preserves them in detail links", async () => {
    renderPage()
    await waitFor(() => expect(all).toHaveBeenCalled())
    expect(all.mock.calls[0]?.[0]).toMatchObject({ page: 1, per_page: 20, scope: "mine", status: "draft", deadline: "overdue", sort: "created_desc" })
    expect(await screen.findByRole("link", { name: "Estate review" })).toHaveAttribute("href", expect.stringContaining("returnTo=%2Fsettings%2Freviews%3Fstatus%3Ddraft"))
  })

  it("uses the existing lifecycle endpoint for a list action", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("Estate review")
    await user.click(screen.getByRole("button", { name: "Publish" }))
    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith(1, expect.objectContaining({ status: "published" })))
  })

  it("shows an authorization message when the viewer is not a content manager", () => {
    currentUser = { roles: ["Reader"] }
    renderPage()
    expect(screen.getByRole("alert")).toHaveTextContent("do not have permission")
    expect(all).not.toHaveBeenCalled()
  })
})