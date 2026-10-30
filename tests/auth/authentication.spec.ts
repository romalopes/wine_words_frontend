import { test, expect } from "../fixtures/test";

test("shows a useful error for invalid credentials", async ({ publicPage }) => {
  await publicPage.goto("/login");
  await publicPage.getByLabel("Email").fill("nobody@example.test");
  await publicPage.getByLabel("Password").fill("not-the-password");
  await publicPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(publicPage.getByRole("alert")).toContainText(/Invalid email or password/i);
});

test("restores an authenticated Admin session across reloads", async ({ adminPage }) => {
  await adminPage.goto("/wines");
  await expect(adminPage.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(adminPage.getByRole("link", { name: /Add Wine/ })).toBeVisible();
  await adminPage.reload();
  await expect(adminPage.getByRole("link", { name: /Add Wine/ })).toBeVisible();
});

test("signs out a freshly authenticated session", async ({ publicPage }) => {
  await publicPage.goto("/login");
  await publicPage.getByLabel("Email").fill("admin.e2e@winewords.test");
  await publicPage.getByLabel("Password").fill("Playwright123!");
  await publicPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(publicPage.getByRole("button", { name: "Sign out" })).toBeVisible();
  await publicPage.getByRole("button", { name: "Sign out" }).click();
  await expect(publicPage.getByRole("link", { name: "Login / Sign up" })).toBeVisible();
});

test("private test access rejects an invalid password", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Private Test Access" })).toBeVisible();
  await page.getByLabel("Test password").fill("wrong-password");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByText("Invalid password", { exact: true })).toBeVisible();
  await context.close();
});