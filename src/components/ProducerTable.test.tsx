import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProducerTable from "./ProducerTable";

vi.mock("./LinkProducerDialog", () => ({ default: () => null }));

it("links to a producer's wines using the count without embedded wine records", () => {
  render(
    <MemoryRouter>
      <ProducerTable producers={[
        { id: 1, slug: "unknown-producer", name: "Unknown Producer", wines_count: 12000 },
        { id: 2, slug: "small-estate", name: "Small Estate", wines_count: 1 },
        { id: 3, slug: "empty-estate", name: "Empty Estate", wines_count: 0 },
      ]} />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: "12000 wines" })).toHaveAttribute("href", "/producers/unknown-producer/wines");
  expect(screen.getByRole("link", { name: "1 wine" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "0 wines" })).not.toBeInTheDocument();
});
