import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { contactApi } from "../services/api"
import { ApiError } from "../services/ApiError"
import Contact from "./Contact"

// Signed-in state is controlled per test; the page must work for both anonymous
// visitors (editable email) and members (read-only account email).
const authState = vi.hoisted(() => ({
  user: null as { email?: string | null } | null,
}))

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: authState.user, loading: false }),
}))

function renderContact() {
  return render(
    <MemoryRouter>
      <Contact />
    </MemoryRouter>,
  )
}

async function fillValidForm(
  user: ReturnType<typeof userEvent.setup>,
  { withEmail = true }: { withEmail?: boolean } = {},
) {
  await user.type(screen.getByRole("textbox", { name: /name/i }), "Jane Smith")
  if (withEmail) {
    await user.type(screen.getByRole("textbox", { name: /email/i }), "jane@example.com")
  }
  await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "business")
  await user.type(screen.getByRole("textbox", { name: /subject/i }), "Partnership idea")
  await user.type(
    screen.getByRole("textbox", { name: /message/i }),
    "We would like to discuss a partnership.",
  )
}

describe("Contact", () => {
  let createSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    authState.user = null
    createSpy = vi.spyOn(contactApi, "create")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the public form with required fields and a privacy note", () => {
    renderContact()

    expect(screen.getByRole("heading", { level: 1, name: /contact wine words/i })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /name/i })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: /category/i })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /subject/i })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /message/i })).toBeInTheDocument()
    expect(screen.getByText(/only to respond to this enquiry/i)).toBeInTheDocument()
  })

  it("lists every server-supported category", () => {
    renderContact()

    const options = screen.getAllByRole("option").map((option) => option.getAttribute("value"))
    expect(options).toEqual([
      "",
      "general",
      "wine_submission",
      "content",
      "business",
      "support",
      "feedback",
      "other",
    ])
  })

  it("blocks submission and shows field errors when required data is missing", async () => {
    const user = userEvent.setup()
    renderContact()

    await user.click(screen.getByRole("button", { name: /send message/i }))

    expect(createSpy).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent(/correct the highlighted fields/i)
    expect(screen.getAllByText(/please enter your name/i).length).toBeGreaterThan(0)
  })

  it("rejects an invalid email before calling the API", async () => {
    const user = userEvent.setup()
    renderContact()

    await user.type(screen.getByRole("textbox", { name: /name/i }), "Jane")
    await user.type(screen.getByRole("textbox", { name: /email/i }), "not-an-email")
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "general")
    await user.type(screen.getByRole("textbox", { name: /subject/i }), "Hello")
    await user.type(screen.getByRole("textbox", { name: /message/i }), "Hello there")
    await user.click(screen.getByRole("button", { name: /send message/i }))

    expect(createSpy).not.toHaveBeenCalled()
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument()
  })

  it("shows success only after the API confirms the message", async () => {
    const user = userEvent.setup()
    createSpy.mockResolvedValue({ status: "received" })
    renderContact()

    await fillValidForm(user)
    await user.click(screen.getByRole("button", { name: /send message/i }))

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/message has been received/i),
    )
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jane Smith",
        email: "jane@example.com",
        contact_type: "business",
        subject: "Partnership idea",
        website: "",
      }),
    )
  })

  it("shows the signed-in user's account email instead of asking for it", async () => {
    authState.user = { email: "member@example.com" }
    const user = userEvent.setup()
    createSpy.mockResolvedValue({ status: "received" })
    renderContact()

    const emailField = screen.getByRole("textbox", { name: /email/i })
    expect(emailField).toHaveValue("member@example.com")
    expect(emailField).toHaveAttribute("readonly")
    expect(screen.getByText(/reply to your account email/i)).toBeInTheDocument()

    // No email entry needed: the form is submitted with the account address.
    await fillValidForm(user, { withEmail: false })
    await user.click(screen.getByRole("button", { name: /send message/i }))

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/message has been received/i),
    )
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ email: "member@example.com" }),
    )
  })

  it("keeps the email field editable for anonymous visitors", () => {
    renderContact()

    const emailField = screen.getByRole("textbox", { name: /email/i })
    expect(emailField).toHaveValue("")
    expect(emailField).not.toHaveAttribute("readonly")
  })

  it("maps server validation errors onto the offending fields", async () => {
    const user = userEvent.setup()
    createSpy.mockRejectedValue(
      new ApiError("Email is invalid", 422, {
        error: "Email is invalid",
        errors: ["Email is invalid"],
        details: { email: ["is invalid"] },
      }),
    )
    renderContact()

    await fillValidForm(user)
    await user.click(screen.getByRole("button", { name: /send message/i }))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/email is invalid/i))
    expect(screen.getByText("is invalid")).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("prevents duplicate submissions while a request is pending", async () => {
    const user = userEvent.setup()
    let resolveCreate: (value: { status: string }) => void = () => {}
    createSpy.mockImplementation(
      () => new Promise<{ status: string }>((resolve) => { resolveCreate = resolve }),
    )
    renderContact()

    await fillValidForm(user)
    const submit = screen.getByRole("button", { name: /send message/i })
    await user.click(submit)
    await user.click(submit)

    expect(createSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveCreate({ status: "received" })
    })
  })
})
