import type { Page } from "@playwright/test";

export class AdminUsersPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/users");
  }

  searchInput() {
    return this.page.getByRole("searchbox", { name: "Search users" });
  }
}