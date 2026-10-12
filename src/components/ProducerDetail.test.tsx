import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { producersApi, winesApi } from "../services/api";
import ProducerDetail from "./ProducerDetail";

vi.mock("../services/api", () => ({
  producersApi: { show: vi.fn() },
  winesApi: { list: vi.fn() },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("./WineTable", () => ({ default: () => <div>Wine results</div> }));
vi.mock("./RegionSearch", () => ({ default: () => null }));
vi.mock("./GrapeSearch", () => ({ default: () => null }));

function renderProducer(path = "/producers/unknown-producer") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/producers/:slug" element={<ProducerDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProducerDetail loading", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(producersApi.show).mockResolvedValue({
      id: 7, slug: "unknown-producer", name: "Unknown Producer",
    });
    vi.mocked(winesApi.list).mockResolvedValue([]);
  });

  it.each([
    "/producers/unknown-producer",
    "/producers/unknown-producer?returnTo=%2Fwines%2F00-vgw-chardonnay",
  ])("finishes loading without repeated requests at %s", async (path) => {
    const view = renderProducer(path);
    expect(await screen.findByRole("heading", { name: "Unknown Producer" })).toBeInTheDocument();
    expect(await screen.findByText("No wines are associated with this producer yet.")).toBeInTheDocument();
    view.rerender(
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/producers/:slug" element={<ProducerDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(producersApi.show).toHaveBeenCalledExactlyOnceWith("unknown-producer");
    expect(winesApi.list).toHaveBeenCalledExactlyOnceWith({ producer_id: 7, page: 1, per_page: 20 });
    if (path.includes("returnTo")) {
      expect(screen.getByRole("link", { name: /Back to Wine$/ })).toHaveAttribute("href", "/wines/00-vgw-chardonnay");
    }
  });

  it("shows a failed producer request instead of staying on the loading screen", async () => {
    vi.mocked(producersApi.show).mockRejectedValue(new Error("Producer not found"));
    renderProducer();
    expect(await screen.findByText("Producer not found")).toBeInTheDocument();
    expect(screen.queryByText("Loading producer details…")).not.toBeInTheDocument();
    expect(winesApi.list).not.toHaveBeenCalled();
  });

  it("waits for wines before showing the empty state", async () => {
    let resolveWines!: (value: []) => void;
    vi.mocked(winesApi.list).mockReturnValue(new Promise((resolve) => { resolveWines = resolve; }));
    renderProducer();
    expect(await screen.findByText("Loading wines...")).toBeInTheDocument();
    expect(screen.queryByText("No wines are associated with this producer yet.")).not.toBeInTheDocument();
    await act(async () => resolveWines([]));
    expect(await screen.findByText("No wines are associated with this producer yet.")).toBeInTheDocument();
  });
});
