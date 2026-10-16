import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { producersApi, winesApi } from "../services/api";
import ProducerWines from "./ProducerWines";

vi.mock("../services/api", () => ({
  producersApi: { show: vi.fn() },
  winesApi: { list: vi.fn() },
}));
vi.mock("./WineTable", () => ({ default: () => <div>Wine results</div> }));
vi.mock("./Pagination", () => ({ default: () => null }));

function renderProducerWines(slug = "unknown-producer") {
  return render(
    <MemoryRouter initialEntries={[`/producers/${slug}/wines`]}>
      <Routes>
        <Route path="/producers/:slug/wines" element={<ProducerWines />} />
      </Routes>
    </MemoryRouter>,
  );
}

const producerPayload = {
  id: 7,
  slug: "unknown-producer",
  name: "Unknown Producer",
  wines_count: 0,
};

describe("ProducerWines", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(producersApi.show).mockResolvedValue(producerPayload);
    vi.mocked(winesApi.list).mockResolvedValue([]);
  });

  // Regression: while producersApi.show is in flight the wine list stays
  // disabled, loading is true, and the page must NOT flash "No wines found
  // for this producer."
  it("shows a loading state while the producer request is in flight", async () => {
    let resolveProducer!: (value: typeof producerPayload) => void;
    vi.mocked(producersApi.show).mockReturnValue(
      new Promise((resolve) => {
        resolveProducer = resolve;
      }),
    );
    // Keep the wines list pending so the loading state is observable after
    // the producer resolves.
    let resolveWines!: (value: []) => void;
    vi.mocked(winesApi.list).mockReturnValue(
      new Promise((resolve) => {
        resolveWines = resolve;
      }),
    );
    renderProducerWines();

    expect(screen.getByText("Loading wines…")).toBeInTheDocument();
    expect(screen.queryByText("No wines found for this producer.")).not.toBeInTheDocument();

    await act(async () => resolveProducer(producerPayload));
    // Producer loaded, list request fired and still pending: loading holds.
    expect(await screen.findByText("Loading wines…")).toBeInTheDocument();
    expect(screen.queryByText("No wines found for this producer.")).not.toBeInTheDocument();

    await act(async () => resolveWines([]));
    expect(await screen.findByText("No wines found for this producer.")).toBeInTheDocument();
    expect(screen.queryByText("Loading wines…")).not.toBeInTheDocument();
  });

  it("shows the empty state only after both producer and list have loaded", async () => {
    renderProducerWines();
    expect(
      await screen.findByText("No wines found for this producer."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading wines…")).not.toBeInTheDocument();
    expect(producersApi.show).toHaveBeenCalledExactlyOnceWith("unknown-producer");
    expect(winesApi.list).toHaveBeenCalledExactlyOnceWith({
      producer_id: 7,
      page: 1,
      per_page: 20,
    });
  });

  it("renders the table once the list resolves", async () => {
    vi.mocked(winesApi.list).mockResolvedValue([
      { id: 1, slug: "some-wine", name: "Some Wine" },
    ] as never);
    renderProducerWines();
    expect(await screen.findByText("Wine results")).toBeInTheDocument();
  });

  it("shows a not-found message when the producer request fails", async () => {
    vi.mocked(producersApi.show).mockRejectedValue(new Error("Producer not found"));
    renderProducerWines();
    expect(await screen.findByText("Producer not found")).toBeInTheDocument();
    expect(screen.queryByText("No wines found for this producer.")).not.toBeInTheDocument();
    expect(winesApi.list).not.toHaveBeenCalled();
  });

  it("passes page and per_page to winesApi.list for pagination", async () => {
    vi.mocked(winesApi.list).mockResolvedValue({
      items: [{ id: 1, slug: "some-wine", name: "Some Wine" }],
      page: 1,
      per_page: 20,
      total_count: 45,
      total_pages: 3,
    } as never);
    renderProducerWines();
    expect(await screen.findByText("Wine results")).toBeInTheDocument();
    expect(winesApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, per_page: 20 }),
    );
  });
});