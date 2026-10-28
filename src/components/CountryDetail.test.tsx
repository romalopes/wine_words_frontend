import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { countriesApi, producersApi, winesApi } from "../services/api";
import CountryDetail from "./CountryDetail";

vi.mock("../services/api", () => ({
  countriesApi: { show: vi.fn() },
  producersApi: { list: vi.fn() },
  winesApi: { list: vi.fn() },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("./ProducerTable", () => ({ default: () => <div>Producer results</div> }));
vi.mock("./WineTable", () => ({ default: () => <div>Wine results</div> }));
vi.mock("./Pagination", () => ({ default: () => null }));

function renderCountry(path = "/countries/australia") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/countries/:slug" element={<CountryDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CountryDetail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(countriesApi.show).mockResolvedValue({
      id: 14,
      name: "Australia",
      slug: "australia",
      code: "AU",
      continent: "Oceania",
      flag_emoji: "🇦🇺",
      is_wine_country: true,
    });
    vi.mocked(producersApi.list).mockResolvedValue({
      items: [{ id: 1, name: "Example Estate", slug: "example-estate" }],
      page: 1,
      per_page: 20,
      total_count: 12,
      total_pages: 1,
    });
    vi.mocked(winesApi.list).mockResolvedValue({
      items: [{ id: 2, name: "Example Shiraz", slug: "example-shiraz" }],
      page: 1,
      per_page: 20,
      total_count: 34,
      total_pages: 2,
    });
  });

  it("renders the wine-profile-style reference layout and country metadata", async () => {
    const { container } = renderCountry();

    expect(await screen.findByRole("heading", { name: "🇦🇺 Australia" })).toBeInTheDocument();
    expect(screen.getByText("Country reference")).toBeInTheDocument();
    expect(screen.getByText("Oceania", { selector: ".wine-app__detail-hero__badge" })).toBeInTheDocument();
    expect(container.querySelector(".reference-detail__layout")).toBeInTheDocument();
    expect(container.querySelector(".reference-detail__sidebar")).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", { name: "Country information" });
    expect(within(sidebar).getByText("AU")).toBeInTheDocument();
    expect(within(sidebar).getByText("Yes")).toBeInTheDocument();
    expect(within(sidebar).getByText("12")).toBeInTheDocument();
    expect(within(sidebar).getByText("34")).toBeInTheDocument();
    expect(screen.getByText("Producer results")).toBeInTheDocument();
    expect(screen.getByText("Wine results")).toBeInTheDocument();
  });

  it("fetches producers and wines through the country filters", async () => {
    renderCountry();

    await screen.findByRole("heading", { name: "🇦🇺 Australia" });
    expect(countriesApi.show).toHaveBeenCalledExactlyOnceWith("australia");
    expect(producersApi.list).toHaveBeenCalledExactlyOnceWith({
      country_id: 14,
      page: 1,
      per_page: 20,
    });
    expect(winesApi.list).toHaveBeenCalledExactlyOnceWith({
      country_id: 14,
      page: 1,
      per_page: 20,
    });
  });

  it("shows the reference-card empty states after both lists load", async () => {
    vi.mocked(producersApi.list).mockResolvedValue([]);
    vi.mocked(winesApi.list).mockResolvedValue([]);
    renderCountry();

    expect(await screen.findByText("No producers for this country yet.")).toBeInTheDocument();
    expect(screen.getByText("No wines for this country yet.")).toBeInTheDocument();
  });
});