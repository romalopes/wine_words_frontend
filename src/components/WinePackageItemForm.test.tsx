import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WinePackageItemForm from "./WinePackageItemForm";

vi.mock("../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/api")>();
  return {
    ...actual,
    winesApi: { search: vi.fn(), create: vi.fn() },
    vintagesApi: { create: vi.fn() },
    producersApi: { search: vi.fn(), create: vi.fn() },
    winePackageItemsApi: { create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
  };
});

import { winesApi, vintagesApi, producersApi, winePackageItemsApi } from "../services/api";

const mockWineSearch = vi.mocked(winesApi.search);
const mockWineCreate = vi.mocked(winesApi.create);
const mockVintageCreate = vi.mocked(vintagesApi.create);
const mockProducersSearch = vi.mocked(producersApi.search);
const mockProducersCreate = vi.mocked(producersApi.create);
const mockItemCreate = vi.mocked(winePackageItemsApi.create);

function enclosingForm(element: Element): HTMLFormElement {
  const form = element.closest("form");
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("the element is not inside a <form>");
  }
  return form;
}

const PRODUCER_WINES = [
  {
    id: 1,
    name: "Grange",
    slug: "grange",
    color: "Red",
    vintages: [
      { id: 11, year: 2018, no_vintage: false },
      { id: 12, year: 2020, no_vintage: false },
    ],
    producer: { id: 3, name: "Penfolds", slug: "penfolds" },
  },
  {
    id: 2,
    name: "Bin 389",
    slug: "bin-389",
    color: "Red",
    vintages: [{ id: 21, year: null, no_vintage: true }],
    producer: { id: 3, name: "Penfolds", slug: "penfolds" },
  },
];

const OTHER_PRODUCER = { id: 5, name: "Other Winery", slug: "other-winery" };
const OTHER_WINES = [
  {
    id: 10,
    name: "Other Wine",
    slug: "other-wine",
    color: "White",
    vintages: [{ id: 101, year: 2021, no_vintage: false }],
    producer: OTHER_PRODUCER,
  },
];

const ALL_PRODUCERS = [
  { id: 3, name: "Penfolds", slug: "penfolds" },
  { id: 5, name: "Other Winery", slug: "other-winery" },
];

type FormOverrides = Partial<ComponentProps<typeof WinePackageItemForm>>;

function renderForm(overrides: FormOverrides = {}) {
  return render(
    <WinePackageItemForm
      packageId={7}
      packageProducerId={3}
      packageProducerName="Penfolds"
      onSaved={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWineSearch.mockResolvedValue(PRODUCER_WINES);
  mockProducersSearch.mockResolvedValue(ALL_PRODUCERS);
});

describe("WinePackageItemForm", () => {
  it("loads wines from all producers (global search) for editorial mode", async () => {
    mockWineSearch.mockResolvedValue([...PRODUCER_WINES, ...OTHER_WINES]);
    renderForm();

    await screen.findByRole("option", { name: /Grange/i });
    await screen.findByRole("option", { name: /Other Wine/i });

    expect(mockWineSearch).toHaveBeenCalledWith({});
  });

  it("renders wines with their producers and vintages", async () => {
    renderForm();

    await screen.findByRole("option", { name: /Grange/i });
    expect(screen.getByRole("option", { name: /Grange -- Penfolds/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Bin 389 -- Penfolds/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Wine"), { target: { value: "1" } });
    await screen.findByRole("option", { name: /2018/i });
    expect(screen.getByRole("option", { name: /2020/i })).toBeInTheDocument();
  });

  it("refuses to submit a line without selecting a wine/vintage", async () => {
    renderForm();
    await screen.findByRole("option", { name: /Grange/i });

    fireEvent.submit(await screen.findByRole("button", { name: /add line/i }));

    await waitFor(() => expect(screen.getByText(/Select a wine and vintage from the catalogue/)).toBeInTheDocument());
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it("submits the selected vintage with the line", async () => {
    renderForm();
    await screen.findByRole("option", { name: /Grange/i });

    fireEvent.change(screen.getByLabelText("Wine"), { target: { value: "1" } });
    await screen.findByRole("option", { name: /2020/i });
    fireEvent.change(screen.getByLabelText("Vintage"), { target: { value: "12" } });
    fireEvent.submit(await screen.findByRole("button", { name: /add line/i }));

    await waitFor(() => expect(mockItemCreate).toHaveBeenCalled());
    expect(mockItemCreate.mock.calls[0]?.[1]).toMatchObject({
      vintage_id: 12,
      review_requested: false,
    });
  });

  it("allows adding a vintage to a wine already in the catalogue", async () => {
    mockVintageCreate.mockResolvedValue({ id: 99, year: 2021, no_vintage: false });
    renderForm();
    await screen.findByRole("option", { name: /Grange/i });

    fireEvent.change(screen.getByLabelText("Wine"), { target: { value: "1" } });
    await screen.findByRole("option", { name: /2018/i });
    fireEvent.click(await screen.findByRole("button", { name: /add a vintage/i }));

    fireEvent.change(await screen.findByLabelText(/^year$/i), { target: { value: "2021" } });
    fireEvent.submit(enclosingForm(screen.getByRole("button", { name: /^add vintage$/i })));

    await waitFor(() => expect(mockVintageCreate).toHaveBeenCalled());
    expect(mockVintageCreate).toHaveBeenCalledWith("grange", {
      year: 2021,
      no_vintage: false,
    });
  });

  it("allows creating a wine with a different producer via the producer search", async () => {
    mockWineCreate.mockResolvedValue({
      id: 20,
      name: "New Wine",
      slug: "new-wine",
      vintages: [{ id: 201, year: 2022, no_vintage: false }],
      producer: OTHER_PRODUCER,
    });
    renderForm();

    await screen.findByRole("option", { name: /Grange/i });

    fireEvent.click(await screen.findByRole("button", { name: /add a new wine/i }));

    // The producer picker is the same searchable one used on /wines/new.
    const search = await screen.findByRole("textbox", { name: "Producer" });
    fireEvent.change(search, { target: { value: "Other" } });
    fireEvent.click(await screen.findByRole("button", { name: /Other Winery/ }));

    const name = await screen.findByLabelText(/wine name/i);
    fireEvent.change(name, { target: { value: "New Wine" } });
    fireEvent.submit(enclosingForm(name));

    await waitFor(() => expect(mockWineCreate).toHaveBeenCalled());
    const payload = mockWineCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({ name: "New Wine", producer_id: 5 });
    expect(payload.vintages_attributes).toHaveLength(1);
  });

  it("lets the editor create a brand-new producer inline", async () => {
    mockProducersSearch.mockResolvedValue([]);
    mockProducersCreate.mockResolvedValue({
      id: 9,
      name: "Park Wines",
      slug: "park-wines",
    });
    mockWineCreate.mockResolvedValue({
      id: 21,
      name: "Park Shiraz",
      slug: "park-shiraz",
      vintages: [{ id: 211, year: 2022, no_vintage: false }],
      producer: { id: 9, name: "Park Wines", slug: "park-wines" },
    });
    renderForm();

    await screen.findByRole("option", { name: /Grange/i });

    fireEvent.click(await screen.findByRole("button", { name: /add a new wine/i }));

    const search = await screen.findByRole("textbox", { name: "Producer" });
    fireEvent.change(search, { target: { value: "Park Wines" } });

    // Nothing matches, so the inline "create producer" action appears.
    fireEvent.click(
      await screen.findByRole("button", { name: /Create "Park Wines"/i }),
    );

    // The fresh producer is selected for the new wine.
    expect(await screen.findByText(/Park Wines/)).toBeInTheDocument();

    const name = await screen.findByLabelText(/wine name/i);
    fireEvent.change(name, { target: { value: "Park Shiraz" } });
    fireEvent.submit(enclosingForm(name));

    await waitFor(() => expect(mockProducersCreate).toHaveBeenCalled());
    expect(mockProducersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Park Wines" }),
    );
    await waitFor(() => expect(mockWineCreate).toHaveBeenCalled());
    const payload = mockWineCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({ name: "Park Shiraz", producer_id: 9 });
  });

  it("auto-generates the wine name from producer and designation", async () => {
    renderForm();

    await screen.findByRole("option", { name: /Grange/i });
    fireEvent.click(await screen.findByRole("button", { name: /add a new wine/i }));

    const search = await screen.findByRole("textbox", { name: "Producer" });
    fireEvent.change(search, { target: { value: "Other" } });
    fireEvent.click(await screen.findByRole("button", { name: /Other Winery/ }));

    // With no submitted name to preserve, the flag starts on and fills the
    // field from the producer (read-only until unticked).
    const name = (await screen.findByLabelText(/wine name/i)) as HTMLInputElement;
    expect(name).toHaveValue("Other Winery");
    expect(name).toHaveAttribute("readonly");

    fireEvent.change(screen.getByLabelText(/designation/i), {
      target: { value: "Estate" },
    });
    expect(await screen.findByLabelText(/wine name/i)).toHaveValue(
      "Other Winery Estate",
    );

    // Unticking frees the field for manual edits.
    fireEvent.click(screen.getByLabelText(/auto-generate name/i));
    expect(screen.getByLabelText(/wine name/i)).not.toHaveAttribute("readonly");
  });

  it("saves a proposed wine in producer mode", async () => {
    renderForm({ producerMode: true });
    await screen.findByRole("option", { name: /Grange/i });

    fireEvent.change(screen.getByLabelText(/Wine name \*/i), { target: { value: "Estate Shiraz" } });
    fireEvent.change(screen.getByLabelText(/Vintage year/i), { target: { value: "2022" } });
    fireEvent.submit(await screen.findByRole("button", { name: /add line/i }));

    await waitFor(() => expect(mockItemCreate).toHaveBeenCalled());
    const call = mockItemCreate.mock.calls[0];
    const payload = (call?.[1] ?? {}) as Record<string, unknown>;
    expect(payload).toMatchObject({
      proposed_wine_name: "Estate Shiraz",
      proposed_vintage_year: 2022,
    });
    expect(payload.vintage_id).toBeUndefined();
  });

  it("producer mode: selects existing vintage from catalogue (no inline create)", async () => {
    renderForm({ producerMode: true });

    await screen.findByRole("option", { name: /Grange/i });
    fireEvent.change(screen.getByLabelText("Wine (package producer)"), { target: { value: "1" } });
    await screen.findByRole("option", { name: /2018/i });
    fireEvent.change(screen.getByLabelText("Vintage"), { target: { value: "11" } });
    fireEvent.submit(await screen.findByRole("button", { name: /add line/i }));

    await waitFor(() => expect(mockItemCreate).toHaveBeenCalled());
    expect(mockItemCreate.mock.calls[0]?.[1]).toMatchObject({
      vintage_id: 11,
      review_requested: false,
    });
  });

  it("displays submitted wine name as reference when a catalogue wine is selected", async () => {
    renderForm({
      item: {
        id: 5,
        vintage_id: 11,
        quantity: 1,
        review_requested: false,
        proposed_wine_name: "Original Submission",
        proposed_vintage_year: 2020,
      },
    });

    await screen.findByRole("option", { name: /Grange/i });
    fireEvent.change(screen.getByLabelText("Wine"), { target: { value: "1" } });
    await screen.findByRole("option", { name: /2018/i });
    fireEvent.change(screen.getByLabelText("Vintage"), { target: { value: "11" } });

    const wineInfo = await screen.findByText("Selected:");
    const container = wineInfo.closest("._wineInfo_e6fa18");
    expect(container).toBeInTheDocument();
    expect(container).toHaveTextContent(/Submitted wine:.*Original Submission/);
    expect(container).toHaveTextContent(/Selected:.*Grange/);
  });

  it("keeps the wine search input enabled so typing does not lose focus", async () => {
    renderForm();

    const input = await screen.findByLabelText("Search wines (all producers)");
    expect(input).not.toBeDisabled();

    fireEvent.change(input, { target: { value: "Nepen" } });
    expect(input).not.toBeDisabled();
    expect(input).toHaveValue("Nepen");
  });

  it("shows a newly created vintage immediately and selects it", async () => {
    mockVintageCreate.mockResolvedValue({ id: 77, year: 2021, no_vintage: false });
    renderForm();

    await screen.findByRole("option", { name: /Grange/i });
    fireEvent.change(screen.getByLabelText("Wine"), { target: { value: "1" } });
    await screen.findByRole("option", { name: /2018/i });

    fireEvent.click(screen.getByRole("button", { name: /add a vintage/i }));
    fireEvent.change(await screen.findByLabelText(/^year$/i), { target: { value: "2021" } });
    fireEvent.click(screen.getByRole("button", { name: /^add vintage$/i }));

    await waitFor(() => expect(mockVintageCreate).toHaveBeenCalled());
    expect(await screen.findByRole("option", { name: "2021" })).toBeInTheDocument();
    expect(screen.getByLabelText("Vintage")).toHaveValue("77");
  });
});
