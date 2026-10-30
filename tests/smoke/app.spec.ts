import { test, expect } from "../fixtures/test";

test("@smoke loads the seeded wine catalogue", async ({ wineListPage }) => {
  await wineListPage.goto();
  await expect(wineListPage.wine("Playwright Shiraz")).toBeVisible();
});

test("@smoke loads the published editorial content", async ({ page }) => {
  await page.goto("/articles");
  await expect(page.getByText("Playwright guide to Shiraz", { exact: true })).toBeVisible();
  await page.goto("/reviews");
  await expect(page.getByText("Playwright published review", { exact: true })).toBeVisible();
});

test("@smoke reports a healthy API", async ({ api }) => {
  const response = await api.get("health");
  expect(response.ok()).toBeTruthy();
});