import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mock } from "vitest";
import NotificationPreferences from "./NotificationPreferences";

const mockPreferences: Mock = vi.fn();
const mockUpdate: Mock = vi.fn();

vi.mock("../services/api", () => ({
  followsApi: {
    preferences: () => mockPreferences(),
    updatePreferences: (patch: unknown) => mockUpdate(patch),
  },
}));

const defaults = {
  follow_in_app: true,
  follow_email: false,
  digest_cadence: "none",
  digest_last_sent_at: null,
};

describe("NotificationPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreferences.mockResolvedValue({ ...defaults });
    mockUpdate.mockImplementation((patch: Record<string, unknown>) =>
      Promise.resolve({ ...defaults, ...patch }),
    );
  });

  it("loads and renders the current preferences", async () => {
    render(<NotificationPreferences />);

    expect(await screen.findByLabelText(/notifications feed/i)).toBeChecked();
    expect(screen.getByLabelText(/email me/i)).not.toBeChecked();
    expect(screen.getByRole("combobox")).toHaveValue("none");
  });

  it("saves the digest cadence and confirms", async () => {
    const user = userEvent.setup();
    render(<NotificationPreferences />);

    await user.selectOptions(await screen.findByRole("combobox"), "weekly");

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({ digest_cadence: "weekly" }),
    );
    expect(await screen.findByText("Preferences saved.")).toBeInTheDocument();
  });

  it("surfaces save failures", async () => {
    const user = userEvent.setup();
    mockUpdate.mockRejectedValue(new Error("Forbidden"));
    render(<NotificationPreferences />);

    await user.click(await screen.findByLabelText(/email me/i));

    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
  });
});