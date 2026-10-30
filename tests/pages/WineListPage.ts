import type { Page } from "@playwright/test";

export class WineListPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/wines");
  }

  async search(term: string) {
    await this.page.getByPlaceholder(/Search wines by name/i).fill(term);
  }

  wine(name: string) {
    return this.page.getByRole("heading", { name, exact: true });
  }

  addWineLink() {
    return this.page.getByRole("link", { name: /Add Wine|Add Your First Wine/ });
  }
}