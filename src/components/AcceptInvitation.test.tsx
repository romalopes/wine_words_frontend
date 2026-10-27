import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { invitationsApi } from "../services/api";
import AcceptInvitation from "./AcceptInvitation";

vi.mock("../services/api", () => ({
  invitationsApi: {
    validate: vi.fn(),
    accept: vi.fn(),
  },
}));

function renderPage(path = "/accept-invitation#token=raw-token") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/accept-invitation" element={<AcceptInvitation />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AcceptInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invitationsApi.validate).mockResolvedValue({
      valid: true,
      invitation: {
        email: "p*****@example.com",
        display_name: "Pat Invitee",
        expires_at: "2026-11-03T10:00:00Z",
      },
    });
  });

  it("validates and activates an invited account", async () => {
    const user = userEvent.setup();
    vi.mocked(invitationsApi.accept).mockResolvedValue({
      message: "Your account is active. Sign in with your email and password.",
      email: "pat@example.com",
    });
    renderPage();

    expect(await screen.findByText(/Pat Invitee/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Password$/), "new-password");
    await user.type(screen.getByLabelText("Confirm password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Activate account" }));

    await waitFor(() => expect(invitationsApi.accept).toHaveBeenCalledWith({
      token: "raw-token",
      password: "new-password",
      password_confirmation: "new-password",
    }));
    expect(await screen.findByText("Account activated")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("shows an invalid state when validation fails", async () => {
    vi.mocked(invitationsApi.validate).mockRejectedValue(new Error("This invitation is invalid or has expired"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or has expired");
    expect(invitationsApi.accept).not.toHaveBeenCalled();
  });
});