import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ViewModeToggle from "./ViewModeToggle";

describe("ViewModeToggle", () => {
  it("marks only the active mode as pressed", () => {
    render(<ViewModeToggle value="cards" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Cards" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reflects a list selection", () => {
    render(<ViewModeToggle value="list" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Cards" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reports the requested mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewModeToggle value="cards" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "List" }));
    expect(onChange).toHaveBeenLastCalledWith("list");

    await user.click(screen.getByRole("button", { name: "Cards" }));
    expect(onChange).toHaveBeenLastCalledWith("cards");
  });

  it("names the toggle group so the control reads as one unit", () => {
    render(
      <ViewModeToggle
        value="cards"
        onChange={() => {}}
        ariaLabel="Wine list view"
      />,
    );

    expect(
      screen.getByRole("group", { name: "Wine list view" }),
    ).toBeInTheDocument();
    expect(screen.getByText("View")).toBeInTheDocument();
  });

  it("falls back to a generic label when none is supplied", () => {
    render(<ViewModeToggle value="cards" onChange={() => {}} />);

    expect(screen.getByRole("group", { name: "View mode" })).toBeInTheDocument();
  });
});
