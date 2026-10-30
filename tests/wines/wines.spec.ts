import { test, expect } from "../fixtures/test";

test("searches the seeded catalogue and opens wine details", async ({ publicPage }) => {
  await publicPage.goto("/wines");
  await publicPage.getByPlaceholder(/Search wines by name/i).fill("Playwright Shiraz");
  const result = publicPage.getByRole("heading", { name: "Playwright Shiraz", exact: true });
  await expect(result).toBeVisible();
  await result.click();
  await expect(publicPage).toHaveURL(/\/wines\/playwright-shiraz/);
  await expect(publicPage.getByText("Playwright Estate", { exact: true }).first()).toBeVisible();
});

test("shows catalogue management only to privileged roles", async ({ reviewerPage, readerPage }) => {
  await reviewerPage.goto("/wines");
  await expect(reviewerPage.getByRole("link", { name: /Add Wine/ })).toBeVisible();
  await readerPage.goto("/wines");
  await expect(readerPage.getByRole("link", { name: /Add Wine/ })).toHaveCount(0);
});

test("enforces wine creation authorization at the API boundary", async ({ api }) => {
  const signIn = await api.post("auth/sign_in", {
    data: { user: { email: "reader.e2e@winewords.test", password: "Playwright123!" } },
  });
  const authorization = signIn.headers()["authorization"];
  expect(authorization).toBeTruthy();
  if (!authorization) throw new Error("Reader sign-in returned no Authorization header");
  const token = authorization.replace(/^Bearer\s+/i, "");
  const response = await api.post("wines", {
    headers: { Authorization: `Bearer ${token}` },
    data: { wine: { name: "Forbidden E2E Wine", producer_id: 1, color: "Red", closure: "Cork", alcohol_percentage: 13.5, volume_ml: 750 } },
  });
  expect(response.status()).toBe(403);
});