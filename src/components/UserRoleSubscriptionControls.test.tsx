import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserRoleSubscriptionControls from "./UserRoleSubscriptionControls";
import type { RoleOption } from "../types/user";
import type { Subscription } from "../types/subscription";

const ROLES: RoleOption[] = [
  { id: 1, name: "Admin" },
  { id: 2, name: "Editor" },
  { id: 3, name: "Reader" },
];

const SUBSCRIPTIONS: Subscription[] = [
  { id: 10, name: "Reader" },
  { id: 11, name: "Guest" },
] as unknown as Subscription[];

const BASE = {
  roles: ROLES,
  selectedRoleIds: new Set<number>([3]),
  onToggleRole: vi.fn(),
  onSaveRoles: vi.fn(),
  subscriptionId: 10,
  subscriptions: SUBSCRIPTIONS,
  onSubscriptionChange: vi.fn(),
};

function renderControls(props: Partial<typeof BASE & Record<string, unknown>> = {}) {
  return render(<UserRoleSubscriptionControls {...BASE} {...props} />);
}

describe("UserRoleSubscriptionControls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders one checkbox per role with current checked state", () => {
    renderControls({ isAdmin: true });
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByLabelText("Reader")).toBeChecked();
    expect(screen.getByLabelText("Editor")).not.toBeChecked();
  });

  it("emits toggle events for enabled checkboxes", async () => {
    const user = userEvent.setup();
    renderControls({ isAdmin: true });
    await user.click(screen.getByLabelText("Editor"));
    expect(BASE.onToggleRole).toHaveBeenCalledWith(2, true);
  });

  it("disables the Admin checkbox with a self-lockout title for the own admin", () => {
    renderControls({ isAdmin: true, isOwnAdminRole: true });
    const admin = screen.getByLabelText("Admin") as HTMLInputElement;
    expect(admin).toBeDisabled();
    expect(screen.getByTitle("You cannot revoke your own Admin role")).toBeInTheDocument();
  });

  it("disables everything for non-admins and hides the action buttons", () => {
    renderControls({ isAdmin: false });
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeDisabled();
    }
    expect(screen.getAllByTitle("Only admins can change roles")).toHaveLength(3);
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the Save button for admins, disabled while saving", async () => {
    const user = userEvent.setup();
    const { rerender } = renderControls({ isAdmin: true });
    const save = screen.getByRole("button", { name: "Save roles" });
    await user.click(save);
    expect(BASE.onSaveRoles).toHaveBeenCalledTimes(1);

    rerender(<UserRoleSubscriptionControls {...BASE} isAdmin savingRoles />);
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
  });

  it("assigns a subscription by id", async () => {
    const user = userEvent.setup();
    renderControls({ isAdmin: true });
    await user.selectOptions(screen.getByRole("combobox"), "11");
    expect(BASE.onSubscriptionChange).toHaveBeenCalledWith(11);
  });

  it("emits null when the None (unassign) option is chosen", async () => {
    const user = userEvent.setup();
    renderControls({ isAdmin: true });
    await user.selectOptions(screen.getByRole("combobox"), "");
    expect(BASE.onSubscriptionChange).toHaveBeenCalledWith(null);
  });

  it("renders the impersonation button only when a target is provided", async () => {
    const user = userEvent.setup();
    const onActAsUser = vi.fn();
    // The accessible name comes from the button's aria-label (as in the
    // original UserRoles markup): `Act as ${target name}`.
    const { rerender } = renderControls({
      isAdmin: true,
      impersonationTarget: { name: "Jane", onActAsUser },
    });

    const actAs = screen.getByRole("button", { name: "Act as Jane" });
    await user.click(actAs);
    expect(onActAsUser).toHaveBeenCalledTimes(1);

    rerender(<UserRoleSubscriptionControls {...BASE} isAdmin />);
    expect(screen.queryByRole("button", { name: "Act as Jane" })).not.toBeInTheDocument();
  });

  it("stops propagation on interactive elements when inside a Link row", async () => {
    const user = userEvent.setup();
    const rowClick = vi.fn();
    render(
      <div onClick={rowClick}>
        <UserRoleSubscriptionControls {...BASE} isAdmin insideLink />
      </div>,
    );
    // Checkbox input, label text, save button and opening the select must all
    // avoid triggering the wrapping row's navigation.
    await user.click(screen.getByLabelText("Editor"));
    await user.click(screen.getByText("Editor"));
    await user.click(screen.getByRole("button", { name: "Save roles" }));
    await user.click(screen.getByRole("combobox"));
    expect(rowClick).not.toHaveBeenCalled();
  });

  it("lets clicks bubble to the row when not inside a Link", async () => {
    const user = userEvent.setup();
    const rowClick = vi.fn();
    render(
      <div onClick={rowClick}>
        <UserRoleSubscriptionControls {...BASE} isAdmin />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "Save roles" }));
    expect(rowClick).toHaveBeenCalledTimes(1);
  });

  it("renders the inline error row", () => {
    renderControls({ isAdmin: true, error: "Failed to update subscription" });
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to update subscription");
  });

  it("sections layout renders the detail-page headings and current hint", () => {
    renderControls({
      isAdmin: true,
      layout: "sections",
      showCurrentSubscriptionHint: true,
      currentSubscriptionName: "Reader",
    });
    expect(screen.getByRole("heading", { name: "Roles" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Subscription" })).toBeInTheDocument();
    expect(screen.getByText("Current: Reader")).toBeInTheDocument();
  });
});