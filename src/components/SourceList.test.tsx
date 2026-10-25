import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SourceList from "./SourceList";

const list = vi.fn();

vi.mock("../services/api", () => ({
  sourcesApi: { list: () => list() },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { roles: ["Admin"] } }),
}));

describe("SourceList", () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue({
      sources: [
        { source: "manual", label: "Manual", reviews_count: 3, articles_count: 1 },
      ],
    });
  });

  it("renders HeroUI source cards with content totals", async () => {
    render(
      <MemoryRouter>
        <SourceList />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: /manual/i })).toBeInTheDocument();
    expect(screen.getByText("3 reviews")).toBeInTheDocument();
    expect(screen.getByText("1 article")).toBeInTheDocument();
  });

  it("opens the selected source", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/sources"]}>
        <Routes>
          <Route path="/sources" element={<SourceList />} />
          <Route path="/sources/:source" element={<p>Source detail</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: /manual/i }));
    expect(screen.getByText("Source detail")).toBeInTheDocument();
  });
});