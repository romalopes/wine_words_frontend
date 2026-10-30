import type { Page } from "@playwright/test";

export class WineDetailPage {
  constructor(private readonly page: Page) {}

  async goto(slug: string) {
    await this.page.goto(`/wines/${slug}`);
  }

  addReviewButton() {
    return this.page.getByRole("button", { name: "+ Add Review" });
  }
}