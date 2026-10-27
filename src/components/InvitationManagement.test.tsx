import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usersApi } from "../services/api";
import type { UserDetail } from "../types/user";
import InvitationManagement from "./InvitationManagement";

vi.mock("../services/api", () => ({
  usersApi: {
    updateInvitationEmail: vi.fn(),
    invitations: {
      list: vi.fn(),
      send: vi.fn(),
      resend: vi.fn(),
      revoke: vi.fn(),
    },
  },
}));

const managedUser = {
  id: 7,
  email: "invitee@example.com",
  display_name: "Invited Person",
  role_ids: [4],
  roles: ["Reader"],
  subscription: null,
  account_status: "unclaimed",
  analytics_opt_out: false,
  producer_memberships: [],
  invitation_summary: { count: 0, latest: null },
} satisfies UserDetail;

describe("InvitationManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.invitations.list).mockResolvedValue([]);
  });

  it("updates email and sends an invitation without handling raw tokens", async () => {
    const user = userEvent.setup();
    const onUserUpdated = vi.fn();
    vi.mocked(usersApi.updateInvitationEmail).mockResolvedValue(managedUser);
    vi.mocked(usersApi.invitations.send).mockResolvedValue({
      id: 1,
      email: managedUser.email!,
      status: "sent",
      usable: true,
      expires_at: "2026-11-03T10:00:00Z",
      sent_at: "2026-10-27T10:00:00Z",
      accepted_at: null,
      revoked_at: null,
      delivery_status: "accepted",
      delivery_error_code: null,
      created_at: "2026-10-27T10:00:00Z",
    });
    render(<InvitationManagement user={managedUser} onUserUpdated={onUserUpdated} />);

    await waitFor(() => expect(usersApi.invitations.list).toHaveBeenCalledWith(7));
    await user.clear(screen.getByLabelText("Invitation email"));
    await user.type(screen.getByLabelText("Invitation email"), "new@example.com");
    await user.click(screen.getByRole("button", { name: "Save email" }));
    expect(usersApi.updateInvitationEmail).toHaveBeenCalledWith(7, "new@example.com");

    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    await waitFor(() => expect(usersApi.invitations.send).toHaveBeenCalledWith(7));
    expect(screen.getByRole("status")).toHaveTextContent("submitted for delivery");
  });
});