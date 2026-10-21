import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { producersApi, countriesApi } from "../services/api";
import ProducerForm from "./ProducerForm";

vi.mock("../services/api", () => ({
  producersApi: { show: vi.fn(), update: vi.fn() },
  countriesApi: { list: vi.fn() },
}));
vi.mock("./RegionSearch", () => ({ default: () => null }));
vi.mock("./GrapeSearch", () => ({ default: () => null }));

function renderProducerForm(path = "/producers/alkina-wine-estate/edit") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/producers/:slug/edit" element={<ProducerForm />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProducerForm layout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(countriesApi.list).mockResolvedValue([
      {
        id: 1,
        name: "Australia",
        slug: "australia",
        code: "AU",
        flag_emoji: "🇦🇺",
        is_wine_country: true,
        producers_count: 0,
      },
    ]);
    vi.mocked(producersApi.show).mockResolvedValue({
      id: 12,
      slug: "alkina-wine-estate",
      name: "Alkina Wine Estate",
      email: "contact@alkina.test",
      producer_type: "winery",
      active: true,
      country: { id: 1, name: "Australia" },
      address: { id: 3, street_address: "1 Vine Rd", city: "Mildura", state: "VIC", postal_code: "3500", country: { id: 1 } },
      regions: [],
      grapes: [],
    } as never);
  });

  it("lays the fields out in two columns with wide fields spanning the row", async () => {
    const { container } = renderProducerForm();
    await waitFor(() => expect(producersApi.show).toHaveBeenCalled());

    const fields = container.querySelector(".producer-form__fields");
    expect(fields).toBeInTheDocument();
    expect(fields?.classList.contains("wine-form__fields")).toBe(true);

    // Wide blocks (description, logo, regions, grapes, images) take the full row.
    const wide = container.querySelectorAll(".producer-form__field--wide");
    expect(wide.length).toBeGreaterThanOrEqual(5);

    // Narrow fields stay in the two-column grid.
    const narrow = container.querySelectorAll(
      ".producer-form__fields > .auth-form__field:not(.producer-form__field--wide)",
    );
    expect(narrow.length).toBeGreaterThan(0);

    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Legal name/)).toBeInTheDocument();
  });

  it("renders the Active toggle inline without inline styles", async () => {
    const { container } = renderProducerForm();
    await waitFor(() => expect(producersApi.show).toHaveBeenCalled());

    const active = container.querySelector(".producer-form__active");
    expect(active).toBeInTheDocument();
    expect(active?.getAttribute("style")).toBeNull();
  });
});
