import { test, expect } from "../fixtures/test";

test("published articles are public and creation is role-aware", async ({ publicPage, reviewerPage, readerPage }) => {
  await publicPage.goto("/articles");
  await expect(publicPage.getByText("Playwright guide to Shiraz", { exact: true })).toBeVisible();

  await reviewerPage.goto("/articles");
  await expect(reviewerPage.getByRole("button", { name: /Add Article/ })).toBeVisible();

  await readerPage.goto("/articles");
  await expect(readerPage.getByRole("button", { name: /Add Article/ })).toHaveCount(0);
});