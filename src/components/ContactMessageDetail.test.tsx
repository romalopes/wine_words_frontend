import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { contactApi } from "../services/api"
import ContactMessageDetail from "./ContactMessageDetail"
import type { ContactMessage } from "../types/contact"

const authState = vi.hoisted(() => ({
  user: { roles: ["Editor"] } as { roles: string[] } | null,
}))

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: authState.user, loading: false }),
}))

const baseMessage: ContactMessage = {
  id: 7,
  name: "Jane Smith",
  email: "jane@example.com",
  contact_type: "support",
  subject: "Cannot sign in",
  status: "unread",
  read: false,
  archived: false,
  read_at: null,
  archived_at: null,
  message: "<script>alert('xss')</script>\nSecond line",
  created_at: "2026-11-16T10:00:00Z",
  updated_at: "2026-11-16T10:00:00Z",
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/settings/contact-messages/7"]}>
      <Routes>
        <Route path="/settings/contact-messages/:id" element={<ContactMessageDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ContactMessageDetail", () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let updateSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    authState.user = { roles: ["Admin"] }
    getSpy = vi.spyOn(contactApi, "get").mockResolvedValue(baseMessage)
    updateSpy = vi
      .spyOn(contactApi, "updateStatus")
      .mockResolvedValue({ ...baseMessage, status: "read", read: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the sender, category and message as plain text", async () => {
    const { container } = renderDetail()

    await waitFor(() => expect(screen.getByText("Cannot sign in")).toBeInTheDocument())
    expect(screen.getByText(/jane@example\.com/)).toBeInTheDocument()
    expect(screen.getByText("Technical support")).toBeInTheDocument()
    // Whitespace is normalised by the matcher; check the node keeps the raw text.
    const body = screen.getByText(/alert\('xss'\)/)
    expect(body.textContent).toBe("<script>alert('xss')</script>\nSecond line")
    // The body is text, never an executable node.
    expect(container.querySelector("script")).toBeNull()
  })

  it("marks the message as read after the server confirms it", async () => {
    const user = userEvent.setup()
    renderDetail()

    await waitFor(() => expect(screen.getByRole("button", { name: /mark as read/i })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: /mark as read/i }))

    expect(updateSpy).toHaveBeenCalledWith(7, "read")
    await waitFor(() => expect(screen.getByText("read")).toBeInTheDocument())
  })

  it("archives the message", async () => {
    const user = userEvent.setup()
    updateSpy.mockResolvedValue({
      ...baseMessage,
      status: "archived",
      archived: true,
      archived_at: "2026-11-16T12:00:00Z",
    })
    renderDetail()

    await waitFor(() => expect(screen.getByRole("button", { name: /archive/i })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: /archive/i }))

    expect(updateSpy).toHaveBeenCalledWith(7, "archived")
    await waitFor(() => expect(screen.getByText("archived")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: /archive/i })).toBeDisabled()
  })

  it("surfaces an action failure without changing the status", async () => {
    const user = userEvent.setup()
    updateSpy.mockRejectedValue(new Error("Forbidden"))
    renderDetail()

    await waitFor(() => expect(screen.getByRole("button", { name: /mark as read/i })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: /mark as read/i }))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Forbidden"))
    expect(screen.getByText("unread")).toBeInTheDocument()
  })

  it("denies Readers", async () => {
    authState.user = { roles: ["Reviewer"] }
    renderDetail()

    expect(
      screen.getByText(/restricted to Editor and Admin accounts/i),
    ).toBeInTheDocument()
    expect(getSpy).not.toHaveBeenCalled()
  })
})
