import { test, expect } from "../fixtures/test";

test("wine catalogue visual baseline", async ({ page }) => {
  await page.goto("/wines");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("wine-catalogue.png", { fullPage: true });
});

test("wine detail visual baseline", async ({ page }) => {
  await page.goto("/wines/playwright-shiraz");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("wine-detail.png", { fullPage: true });
});