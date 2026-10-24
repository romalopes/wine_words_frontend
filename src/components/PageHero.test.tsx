import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PageHero from "./PageHero";

function renderHero(node: React.ReactNode, path = "/wines") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/wines" element={<>{node}</>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PageHero", () => {
  it("renders the kicker, title and description", () => {
    renderHero(
      <PageHero
        kicker="Cellar"
        title="Wine List"
        description="Browse every wine in the cellar."
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Wine List" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cellar")).toBeInTheDocument();
    expect(
      screen.getByText("Browse every wine in the cellar."),
    ).toBeInTheDocument();
  });

  it("renders a primary action with `to` as a router link", () => {
    renderHero(
      <PageHero
        kicker="Cellar"
        title="Wine List"
        primaryAction={{ label: "+ Add Wine", to: "/wines/new" }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "+ Add Wine" }),
    ).toHaveAttribute("href", "/wines/new");
  });

  it("renders an onClick primary action as a button that does not navigate", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderHero(
      <PageHero
        kicker="Cellar"
        title="Wine List"
        primaryAction={{ label: "+ Add Wine", onClick }}
      />,
    );

    const action = screen.getByRole("button", { name: "+ Add Wine" });
    expect(action).toBeInTheDocument();

    await user.click(action);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire a disabled link action", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderHero(
      <PageHero
        kicker="Cellar"
        title="Wine List"
        primaryAction={{ label: "+ Add Wine", to: "/wines/new", onClick, disabled: true }}
      />,
    );

    const action = screen.getByRole("link", { name: "+ Add Wine" });
    expect(action).toHaveAttribute("aria-disabled", "true");

    await user.click(action);

    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a disabled primary button as disabled", () => {
    renderHero(
      <PageHero
        kicker="Cellar"
        title="Wine List"
        primaryAction={{ label: "+ Add Wine", onClick: vi.fn(), disabled: true }}
      />,
    );

    expect(screen.getByRole("button", { name: "+ Add Wine" })).toBeDisabled();
  });
});
