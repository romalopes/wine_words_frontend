import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usersApi } from "../services/api";
import CreateManagedUserForm from "./CreateManagedUserForm";

vi.mock("../services/api", () => ({
  usersApi: { create: vi.fn() },
}));

const roles = [
  { id: 1, name: "Admin" },
  { id: 2, name: "Editor" },
  { id: 3, name: "Reviewer" },
  { id: 4, name: "Reader" },
  { id: 5, name: "Guest" },
];

describe("CreateManagedUserForm", () => {
  it("restricts an editor to Reader/Reviewer and creates without an email", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const created = { id: 42 } as Awaited<ReturnType<typeof usersApi.create>>;
    vi.mocked(usersApi.create).mockResolvedValue(created);
    render(<CreateManagedUserForm roles={roles} isAdmin={false} onCreated={onCreated} />);

    expect(screen.queryByLabelText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Editor")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("First name"), " Ada ");
    await user.type(screen.getByLabelText("Last name"), " Lovelace ");
    await user.click(screen.getByLabelText("Reader"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(usersApi.create).toHaveBeenCalledWith({
      first_name: "Ada",
      last_name: "Lovelace",
      email: null,
      role_ids: [4],
    }));
    expect(onCreated).toHaveBeenCalledWith(created);
  });
});