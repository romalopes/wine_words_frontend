import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { ArticlesManagement, ReviewsManagement } from "./ContentManagementList"

const all = vi.fn()
const updateStatus = vi.fn()
const listArticles = vi.fn()
let currentUser: { roles: string[] } | null = { roles: ["Editor"] }

vi.mock("../services/api", () => ({
  reviewsApi: {
    all: (...args: unknown[]) => all(...args),
    updateStatus: (...args: unknown[]) => updateStatus(...args),
  },
  articlesApi: { list: (...args: unknown[]) => listArticles(...args), updateStatus: vi.fn() },
}))
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: currentUser }) }))

function renderPage(entry = "/settings/reviews?status=draft&deadline=overdue&scope=mine") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/settings/reviews" element={<ReviewsManagement />} /></Routes>
    </MemoryRouter>,
  )
}

function renderArticlesPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/articles"]}>
      <Routes><Route path="/settings/articles" element={<ArticlesManagement />} /></Routes>
    </MemoryRouter>,
  )
}

describe("ReviewsManagement", () => {
  beforeEach(() => {
    currentUser = { roles: ["Editor"] }
    all.mockReset().mockResolvedValue({
      items: [{ id: 1, slug: "estate-review", title: "Estate review", status: "draft", reviewer_name: "Editor", images: ["/review.jpg"], deadline: "2026-10-20", overdue: true, days_until_deadline: -1, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-02T12:00:00Z" }],
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

  it("shows the review image in the first column", async () => {
    renderPage()
    const image = await screen.findByRole("img", { name: "Estate review" })
    expect(image).toHaveAttribute("src", "/review.jpg")
    expect(image.closest("td")).toBe(screen.getAllByRole("cell")[0])
  })

  it("shows an authorization message when the viewer is not a content manager", () => {
    currentUser = { roles: ["Reader"] }
    renderPage()
    expect(screen.getByRole("alert")).toHaveTextContent("do not have permission")
    expect(all).not.toHaveBeenCalled()
  })
})

describe("ArticlesManagement", () => {
  beforeEach(() => {
    currentUser = { roles: ["Editor"] }
    listArticles.mockReset().mockResolvedValue({
      items: [{ id: 2, slug: "estate-article", title: "Estate article", status: "published", primary_image: "/article.jpg" }],
      page: 1, per_page: 20, total_count: 1, total_pages: 1,
    })
  })

  it("shows the article image in the first column", async () => {
    renderArticlesPage()
    const image = await screen.findByRole("img", { name: "Estate article" })
    expect(image).toHaveAttribute("src", "/article.jpg")
    expect(image.closest("td")).toBe(screen.getAllByRole("cell")[0])
  })
})
