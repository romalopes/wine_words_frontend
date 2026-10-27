import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountLifecycleControls from "./AccountLifecycleControls";
import type { AccountLifecycleControlsProps } from "./AccountLifecycleControls";

const BASE: AccountLifecycleControlsProps = {
  account: { display_name: "Jane Doe", email: "jane@example.com" },
  loading: false,
  error: null as string | null,
  blockingReasons: [] as Array<{ code: string; message: string }>,
  onSoftDelete: vi.fn(),
  onHardDelete: vi.fn(),
  onReactivate: vi.fn(),
};

function renderControls(
  props: Partial<typeof BASE & Record<string, unknown>> = {},
) {
  return render(<AccountLifecycleControls {...BASE} {...props} />);
}

describe("AccountLifecycleControls", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("shows the active state with a delete CTA and no modal initially", () => {
    renderControls();
    expect(screen.getByText("Account is active.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete account" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the confirmation modal from the delete CTA", async () => {
    const user = userEvent.setup();
    renderControls();
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = screen.getByRole("dialog", { name: "Delete account" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(
      screen.getByText(/schedules permanent removal after 30 days/),
    ).toBeInTheDocument();
  });

  it("closes the modal on cancel and on backdrop click", async () => {
    const user = userEvent.setup();
    renderControls();
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("emits soft delete and closes the modal", async () => {
    const user = userEvent.setup();
    renderControls();
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Soft delete" }));
    expect(BASE.onSoftDelete).toHaveBeenCalledTimes(1);
    expect(BASE.onHardDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires confirmation before a hard delete", async () => {
    const user = userEvent.setup();
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValue(false);
    renderControls();
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    expect(BASE.onHardDelete).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    expect(BASE.onHardDelete).toHaveBeenCalledTimes(1);
    expect(BASE.onSoftDelete).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("Permanently delete this account now"),
    );
  });

  it("shows the reactivate flow for a soft-deleted account", async () => {
    const user = userEvent.setup();
    renderControls({
      account: {
        deleted_at: "2024-05-01T10:00:00Z",
        display_name: "Jane Doe",
        email: "jane@example.com",
      },
    });
    expect(screen.getByText(/Soft-deleted at:/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete account" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Reactivate user" }),
    );
    expect(BASE.onReactivate).toHaveBeenCalledTimes(1);
  });

  it("renders inline errors in the section and inside the modal", async () => {
    const user = userEvent.setup();
    renderControls({ error: "Blocked by published wines" });
    expect(
      screen.getByText("Blocked by published wines"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Blocked by published wines",
    );
  });

  it("lists structured blocking reasons in the modal", async () => {
    const user = userEvent.setup();
    renderControls({
      blockingReasons: [
        { code: "published_wines", message: "User still owns 3 wines" },
      ],
    });
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(
      screen.getByText("User still owns 3 wines"),
    ).toBeInTheDocument();
  });

  it("disables modal actions while a mutation is in flight", async () => {
    const user = userEvent.setup();
    renderControls({ loading: true });
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    // Both mutation CTAs relabel to "Working…" while loading.
    expect(screen.getAllByRole("button", { name: "Working…" })).toHaveLength(2);
  });

  it("falls back to the email when no display name is present", async () => {
    const user = userEvent.setup();
    renderControls({ account: { display_name: null, email: "jane@example.com" } });
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });
});