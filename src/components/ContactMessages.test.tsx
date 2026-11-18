import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { contactApi } from "../services/api"
import ContactMessages from "./ContactMessages"
import type { ContactMessage } from "../types/contact"

const authState = vi.hoisted(() => ({
  user: { roles: ["Editor"] } as { roles: string[] } | null,
}))

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: authState.user, loading: false }),
}))

const unreadMessage: ContactMessage = {
  id: 1,
  name: "Jane Smith",
  email: "jane@example.com",
  contact_type: "general",
  subject: "Question about tastings",
  status: "unread",
  read: false,
  archived: false,
  read_at: null,
  archived_at: null,
  created_at: "2026-11-16T10:00:00Z",
  updated_at: "2026-11-16T10:00:00Z",
}

const readMessage: ContactMessage = {
  ...unreadMessage,
  id: 2,
  name: "Bob Jones",
  email: "bob@example.com",
  contact_type: "business",
  subject: "Partnership",
  status: "read",
  read: true,
  read_at: "2026-11-16T11:00:00Z",
}

function envelope(items: ContactMessage[]) {
  return {
    items,
    page: 1,
    per_page: 20,
    total_count: items.length,
    total_pages: 1,
    unread_count: items.filter((item) => item.status === "unread").length,
  }
}

function renderInbox() {
  return render(
    <MemoryRouter initialEntries={["/settings/contact-messages"]}>
      <ContactMessages />
    </MemoryRouter>,
  )
}

describe("ContactMessages", () => {
  let listSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    authState.user = { roles: ["Editor"] }
    listSpy = vi.spyOn(contactApi, "list").mockResolvedValue(envelope([unreadMessage, readMessage]))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("lists messages with sender, category, subject and the unread count", async () => {
    renderInbox()

    await waitFor(() => expect(screen.getByText("Jane Smith")).toBeInTheDocument())
    expect(screen.getByText("jane@example.com")).toBeInTheDocument()
    expect(screen.getByText("Question about tastings")).toBeInTheDocument()
    // The label also appears as a <option> in the category filter.
    expect(screen.getAllByText("Business / Partnership").length).toBeGreaterThan(0)
    expect(screen.getByRole("tab", { name: /unread/i })).toHaveTextContent("1")
  })

  it("filters by status through the API", async () => {
    const user = userEvent.setup()
    renderInbox()

    await waitFor(() => expect(listSpy).toHaveBeenCalled())
    await user.click(screen.getByRole("tab", { name: /archived/i }))

    await waitFor(() =>
      expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({ status: "archived" })),
    )
  })

  it("searches by sender, email or subject", async () => {
    const user = userEvent.setup()
    renderInbox()

    await waitFor(() => expect(listSpy).toHaveBeenCalled())
    await user.type(screen.getByRole("searchbox", { name: /search messages/i }), "bob")
    await user.click(screen.getByRole("button", { name: /^search$/i }))

    await waitFor(() =>
      expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({ search: "bob" })),
    )
  })

  it("shows the empty state", async () => {
    listSpy.mockResolvedValue(envelope([]))
    renderInbox()

    await waitFor(() =>
      expect(screen.getByText(/no messages match these filters/i)).toBeInTheDocument(),
    )
  })

  it("shows an error with retry", async () => {
    const user = userEvent.setup()
    listSpy.mockRejectedValueOnce(new Error("Network down"))
    renderInbox()

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Network down"))
    await user.click(screen.getByRole("button", { name: /retry/i }))

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2))
  })

  it("denies Readers and never calls the API", async () => {
    authState.user = { roles: ["Reader"] }
    renderInbox()

    expect(
      screen.getByText(/restricted to Editor and Admin accounts/i),
    ).toBeInTheDocument()
    expect(listSpy).not.toHaveBeenCalled()
  })

  it("denies anonymous visitors", () => {
    authState.user = null
    renderInbox()

    expect(
      screen.getByText(/restricted to Editor and Admin accounts/i),
    ).toBeInTheDocument()
  })
})
