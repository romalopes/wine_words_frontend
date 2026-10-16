import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import CommentSection from "./CommentSection"
import { commentsApi } from "../../services/api"
import type { CommentDTO } from "../../types/comment"

/**
 * CommentSection reads the location (for the #comments deep link), so every
 * render needs a Router. `initialEntries` carries the hash under test.
 */
function renderSection(
  props: { kind: "wine" | "review" | "article"; identifier: string },
  initialEntries = ["/wines/some-wine"],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {/* Focus target OUTSIDE the comments section, so a test can move focus
          clear of the thread and check the focus ring is released. */}
      <button type="button">elsewhere</button>
      <Routes>
        <Route path="/wines/:slug" element={<CommentSection {...props} />} />
      </Routes>
    </MemoryRouter>,
  )
}

vi.mock("../../services/api", () => ({
  commentsApi: {
    list: vi.fn(),
    create: vi.fn(),
    reply: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

const mockUseAuth = vi.fn()
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}))

function comment(overrides: Partial<CommentDTO> = {}): CommentDTO {
  return {
    id: 1,
    body: "Interesting difference from the 2023 vintage.",
    deleted: false,
    parent_id: null,
    commentable_type: "Wine",
    commentable_id: 10,
    author: { id: 7, name: "Anderson" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    edited: false,
    editable: true,
    deletable: true,
    replies: [],
    ...overrides,
  }
}

function signedInAs(roles: string[] = ["Reader"]) {
  mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { id: 7, roles } })
}

function signedOut() {
  mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null })
}

describe("CommentSection", () => {
  beforeEach(() => {
    vi.mocked(commentsApi.list).mockReset()
    vi.mocked(commentsApi.create).mockReset()
    vi.mocked(commentsApi.reply).mockReset()
    vi.mocked(commentsApi.update).mockReset()
    vi.mocked(commentsApi.remove).mockReset()
    signedInAs()
  })

  it("loads the thread for the wine endpoint", async () => {
    vi.mocked(commentsApi.list).mockResolvedValue({
      comments: [comment()],
      comments_count: 1,
    })
    renderSection({ kind: "wine", identifier: "some-wine" })

    await waitFor(() => {
      expect(screen.getByText(/Interesting difference/)).toBeInTheDocument()
    })
    expect(commentsApi.list).toHaveBeenCalledWith("wine", "some-wine")
    expect(screen.getByRole("heading", { name: /Comments \(1\)/ })).toBeInTheDocument()
  })

  it("uses the matching endpoint for reviews and articles", async () => {
    vi.mocked(commentsApi.list).mockResolvedValue({ comments: [], comments_count: 0 })

    const { unmount } = renderSection({ kind: "review", identifier: "a-review" })
    await waitFor(() => expect(commentsApi.list).toHaveBeenCalledWith("review", "a-review"))
    unmount()

    renderSection({ kind: "article", identifier: "an-article" })
    await waitFor(() => expect(commentsApi.list).toHaveBeenCalledWith("article", "an-article"))
  })

  it("shows an empty state", async () => {
    vi.mocked(commentsApi.list).mockResolvedValue({ comments: [], comments_count: 0 })
    renderSection({ kind: "wine", identifier: "some-wine" })
    await waitFor(() => {
      expect(screen.getByText(/No comments yet/)).toBeInTheDocument()
    })
  })

  it("asks a logged-out visitor to log in and hides the form", async () => {
    signedOut()
    vi.mocked(commentsApi.list).mockResolvedValue({ comments: [], comments_count: 0 })
    renderSection({ kind: "wine", identifier: "some-wine" })

    expect(screen.getByText(/Please log in to join the discussion/)).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("blocks a Guest account but still shows the thread", async () => {
    signedInAs(["Guest"])
    vi.mocked(commentsApi.list).mockResolvedValue({ comments: [comment()], comments_count: 1 })
    renderSection({ kind: "wine", identifier: "some-wine" })

    await waitFor(() => expect(screen.getByText(/Interesting difference/)).toBeInTheDocument())
    expect(screen.getByText(/does not include commenting/)).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it.each([["Reviewer"], ["Editor"], ["Admin"]])("lets a %s comment", async (role) => {
    signedInAs([role])
    vi.mocked(commentsApi.list).mockResolvedValue({ comments: [], comments_count: 0 })
    vi.mocked(commentsApi.create).mockResolvedValue(comment({ body: "Hello" }))
    const user = userEvent.setup()
    renderSection({ kind: "wine", identifier: "some-wine" })

    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument())
    await user.type(screen.getByRole("textbox"), "Hello")
    await user.click(screen.getByRole("button", { name: "Comment" }))

    await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument())
    expect(commentsApi.create).toHaveBeenCalledWith("wine", "some-wine", "Hello")
  })

  it("keeps the typed text when the request fails", async () => {
    vi.mocked(commentsApi.list).mockResolvedValue({ comments: [], comments_count: 0 })
    vi.mocked(commentsApi.create).mockRejectedValue(new Error("network down"))
    const user = userEvent.setup()
    renderSection({ kind: "wine", identifier: "some-wine" })

    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument())
    await user.type(screen.getByRole("textbox"), "Worth keeping")
    await user.click(screen.getByRole("button", { name: "Comment" }))

    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0))
    expect(screen.getByRole("textbox")).toHaveValue("Worth keeping")
  })
  it("nests a reply under its parent", async () => {
    vi.mocked(commentsApi.list).mockResolvedValue({
      comments: [comment({ id: 1, replies: [] })],
      comments_count: 1,
    })
    vi.mocked(commentsApi.reply).mockResolvedValue(
      comment({ id: 2, body: "I agree.", parent_id: 1 }),
    )
    const user = userEvent.setup()
    renderSection({ kind: "wine", identifier: "some-wine" })

    await waitFor(() => expect(screen.getByText(/Interesting difference/)).toBeInTheDocument())
    // The first "Reply" button opens the form; the second one submits it.
    await user.click(screen.getAllByRole("button", { name: "Reply" })[0]!)
    // Scoped by its label: the top-level form is also a textarea on this page.
    const replyBox = screen.getByLabelText("Reply to Anderson")
    await user.type(replyBox, "I agree.")
    await user.click(screen.getAllByRole("button", { name: "Reply" })[1]!)

    await waitFor(() => expect(screen.getByText("I agree.")).toBeInTheDocument())
    // Only the comment id is sent: the API derives the commentable from it.
    expect(commentsApi.reply).toHaveBeenCalledWith(1, "I agree.")
  })

  it("puts a reply to a reply in the same thread, as the API's parent says", async () => {
    // The user clicks Reply on comment 2 (a reply to comment 1). The API
    // attaches the new reply to comment 1, so the client's clicked id and the
    // new reply's parent_id disagree and only the server's answer is correct.
    vi.mocked(commentsApi.list).mockResolvedValue({
      comments: [
        comment({ id: 1, replies: [comment({ id: 2, parent_id: 1, body: "First reply." })] }),
      ],
      comments_count: 2,
    })
    vi.mocked(commentsApi.reply).mockResolvedValue(
      comment({ id: 3, body: "Same thread.", parent_id: 1 }),
    )
    const user = userEvent.setup()
    renderSection({ kind: "wine", identifier: "some-wine" })

    await waitFor(() => expect(screen.getByText("First reply.")).toBeInTheDocument())
    // The nested comment's own Reply button, found by scoping to its row rather
    // than by counting buttons on the page.
    const nested = screen.getByText("First reply.").closest("li") as HTMLElement
    await user.click(within(nested).getByRole("button", { name: "Reply" }))

    const replyBox = screen.getByLabelText("Reply to Anderson (in this thread)")
    await user.type(replyBox, "Same thread.")
    const replyForm = replyBox.closest("form") as HTMLElement
    await user.click(within(replyForm).getByRole("button", { name: "Reply" }))

    await waitFor(() => expect(screen.getByText("Same thread.")).toBeInTheDocument())
    expect(commentsApi.reply).toHaveBeenCalledWith(2, "Same thread.")

    // It sits beside "First reply." inside comment 1's reply list, not under it.
    const replyLists = document.querySelectorAll(".comment__replies")
    expect(replyLists).toHaveLength(1)
    expect(replyLists[0]?.querySelectorAll(".comment")).toHaveLength(2)
  })

  it("shows actions the server allows and hides the rest", async () => {
    vi.mocked(commentsApi.list).mockResolvedValue({
      comments: [comment({ editable: false, deletable: false })],
      comments_count: 1,
    })
    renderSection({ kind: "wine", identifier: "some-wine" })

    await waitFor(() => expect(screen.getByText(/Interesting difference/)).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()
  })

  it("edits a comment and replaces it with the API response", async () => {
    vi.mocked(commentsApi.list).mockResolvedValue({
      comments: [comment({ body: "Original." })],
      comments_count: 1,
    })
    vi.mocked(commentsApi.update).mockResolvedValue(comment({ body: "Edited." }))
    const user = userEvent.setup()
    renderSection({ kind: "wine", identifier: "some-wine" })

    await waitFor(() => expect(screen.getByText("Original.")).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Edit" }))

    const textarea = screen.getByLabelText("Edit your comment")
    await user.clear(textarea)
    await user.type(textarea, "Edited.")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(screen.getByText("Edited.")).toBeInTheDocument())
    expect(commentsApi.update).toHaveBeenCalledWith(1, "Edited.")
  })

  it("deletes a comment and shows the tombstone the API returns", async () => {
    vi.mocked(commentsApi.list).mockResolvedValue({
      comments: [comment({ body: "Spam." })],
      comments_count: 1,
    })
    vi.mocked(commentsApi.remove).mockResolvedValue(
      comment({ body: "[Comment deleted]", deleted: true, editable: false, deletable: false }),
    )
    const user = userEvent.setup()
    renderSection({ kind: "wine", identifier: "some-wine" })

    await waitFor(() => expect(screen.getByText("Spam.")).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(screen.getByText("[Comment deleted]")).toBeInTheDocument())
    expect(screen.queryByText("Spam.")).not.toBeInTheDocument()
    // A tombstone offers no actions at all.
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()
  })

  it("reports a failed inline reply once, not in both the form and the list", async () => {
    vi.mocked(commentsApi.list).mockResolvedValue({
      comments: [comment({ id: 1, replies: [] })],
      comments_count: 1,
    })
    vi.mocked(commentsApi.reply).mockRejectedValue(new Error("network down"))
    const user = userEvent.setup()
    renderSection({ kind: "wine", identifier: "some-wine" })

    await waitFor(() => expect(screen.getByText(/Interesting difference/)).toBeInTheDocument())
    await user.click(screen.getAllByRole("button", { name: "Reply" })[0]!)
    await user.type(screen.getByLabelText("Reply to Anderson"), "I agree.")
    await user.click(screen.getAllByRole("button", { name: "Reply" })[1]!)

    await waitFor(() => expect(screen.getByText(/network down/)).toBeInTheDocument())
    // Exactly one alert: the open form owns the message.
    expect(screen.getAllByRole("alert")).toHaveLength(1)
    // ...and the user's text survived the failure.
    expect(screen.getByLabelText("Reply to Anderson")).toHaveValue("I agree.")
  })

  it("focuses the section and marks it when arriving with #comments", async () => {
    vi.mocked(commentsApi.list).mockResolvedValue({ comments: [], comments_count: 0 })
    renderSection({ kind: "wine", identifier: "some-wine" }, ["/wines/some-wine#comments"])

    const section = await screen.findByRole("region", { name: /Comments/ })
    await waitFor(() => expect(section).toHaveFocus())
    expect(section).toHaveClass("comments--focused")
    expect(section).toHaveAttribute("id", "comments")
  })

  it("does not steal focus when there is no #comments hash", async () => {
    vi.mocked(commentsApi.list).mockResolvedValue({ comments: [], comments_count: 0 })
    renderSection({ kind: "wine", identifier: "some-wine" })

    const section = await screen.findByRole("region", { name: /Comments/ })
    expect(section).not.toHaveFocus()
    expect(section).not.toHaveClass("comments--focused")
  })

  it("releases the focus ring once focus leaves the thread entirely", async () => {
    vi.mocked(commentsApi.list).mockResolvedValue({ comments: [], comments_count: 0 })
    renderSection({ kind: "wine", identifier: "some-wine" }, ["/wines/some-wine#comments"])

    const section = await screen.findByRole("region", { name: /Comments/ })
    await waitFor(() => expect(section).toHaveFocus())

    // Tabbing from the section lands on the form INSIDE it, so the ring stays:
    // focus is still within the thread. Move focus clear of the section to
    // check the ring is actually released.
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "elsewhere" }))

    expect(section).not.toHaveFocus()
    expect(section).not.toHaveClass("comments--focused")
  })

  it("surfaces a load failure", async () => {
    vi.mocked(commentsApi.list).mockRejectedValue(new Error("boom"))
    renderSection({ kind: "wine", identifier: "some-wine" })
    await waitFor(() => expect(screen.getByText(/boom/)).toBeInTheDocument())
  })
})