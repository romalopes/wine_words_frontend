import { test, expect } from "../fixtures/test";

test("privileged users see package workflow data", async ({ reviewerPage }) => {
  await reviewerPage.goto("/wine-packages");
  await expect(reviewerPage.getByRole("heading", { name: "Wine Packages" })).toBeVisible();
  await expect(reviewerPage.getByText("Playwright Estate", { exact: true })).toBeVisible();
  await expect(reviewerPage.getByRole("link", { name: "+ Record Received Package" })).toBeVisible();
});

test("reader can list visible packages but cannot create them", async ({ api }) => {
  const signIn = await api.post("auth/sign_in", {
    data: { user: { email: "reader.e2e@winewords.test", password: "Playwright123!" } },
  });
  const authorization = signIn.headers()["authorization"];
  expect(authorization).toBeTruthy();
  if (!authorization) throw new Error("Reader sign-in returned no Authorization header");
  const token = authorization.replace(/^Bearer\s+/i, "");
  const listResponse = await api.get("wine_packages", { headers: { Authorization: `Bearer ${token}` } });
  expect(listResponse.ok()).toBeTruthy();
  const createResponse = await api.post("wine_packages", {
    headers: { Authorization: `Bearer ${token}` },
    data: { wine_package: { producer_id: 1, reviewer_id: 3, status: "draft" } },
  });
  expect(createResponse.status()).toBe(403);
});