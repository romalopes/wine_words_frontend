import { test, expect } from "../fixtures/test";

test("reviewer can start a review while reader cannot", async ({ reviewerPage, readerPage }) => {
  await reviewerPage.goto("/reviews");
  await expect(reviewerPage.getByRole("button", { name: "+ Add Review" })).toBeVisible();
  await reviewerPage.getByRole("button", { name: "+ Add Review" }).click();
  await expect(reviewerPage.getByPlaceholder("Search for a wine…")).toBeVisible();

  await readerPage.goto("/reviews");
  await expect(readerPage.getByRole("button", { name: "+ Add Review" })).toHaveCount(0);
  await expect(readerPage.getByText("Playwright published review", { exact: true })).toBeVisible();
});