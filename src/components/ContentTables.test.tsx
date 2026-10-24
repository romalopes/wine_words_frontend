import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ArticleTable from "./ArticleTable";
import ReviewTable from "./ReviewTable";
import WineTable from "./WineTable";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("./LinkWineDialog", () => ({ default: () => null }));
vi.mock("./LinkReviewDialog", () => ({ default: () => null }));
vi.mock("./LinkArticleDialog", () => ({ default: () => null }));

describe("content tables", () => {
  it("shows the wine's first image in the first column", () => {
    render(
      <MemoryRouter>
        <WineTable
          wines={[
            {
              id: 1,
              slug: "three-drops-riesling",
              name: "3 Drops Riesling",
              images: ["/wine-first.jpg", "/wine-second.jpg"],
            },
          ]}
        />
      </MemoryRouter>,
    );

    const row = screen.getByRole("row", { name: /3 Drops Riesling/ });
    expect(within(row).getAllByRole("cell")[0]).toContainElement(
      screen.getByRole("img", { name: "3 Drops Riesling" }),
    );
    expect(screen.getByRole("img", { name: "3 Drops Riesling" })).toHaveAttribute(
      "src",
      "/wine-first.jpg",
    );
  });

  it("shows a review image and falls back to the reviewed wine image", () => {
    render(
      <MemoryRouter>
        <ReviewTable
          reviews={[
            {
              id: 2,
              slug: "review-with-image",
              title: "Review with image",
              status: "published",
              images: ["/review-first.jpg"],
            },
            {
              id: 3,
              slug: "review-with-wine-image",
              title: "Review with wine image",
              status: "published",
              wine_image: "/reviewed-wine.jpg",
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("img", { name: "Review with image" })).toHaveAttribute(
      "src",
      "/review-first.jpg",
    );
    expect(screen.getByRole("img", { name: "Review with wine image" })).toHaveAttribute(
      "src",
      "/reviewed-wine.jpg",
    );
  });

  it("shows the article's primary image in the first column", () => {
    render(
      <MemoryRouter>
        <ArticleTable
          articles={[
            {
              id: 4,
              slug: "three-drops-profile",
              title: "3 Drops profile",
              status: "published",
              primary_image: "/article-primary.jpg",
              images: ["/article-first.jpg"],
            },
          ]}
        />
      </MemoryRouter>,
    );

    const row = screen.getByRole("row", { name: /3 Drops profile/ });
    expect(within(row).getAllByRole("cell")[0]).toContainElement(
      screen.getByRole("img", { name: "3 Drops profile" }),
    );
    expect(screen.getByRole("img", { name: "3 Drops profile" })).toHaveAttribute(
      "src",
      "/article-primary.jpg",
    );
  });
});