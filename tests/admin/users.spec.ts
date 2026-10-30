import { test, expect } from "../fixtures/test";

test("Admin can search users", async ({ adminPage }) => {
  await adminPage.goto("/users");
  await expect(adminPage.getByRole("heading", { name: "Users" })).toBeVisible();
  await adminPage.getByRole("searchbox", { name: "Search users" }).fill("reader.e2e");
  await expect(adminPage.getByText("reader.e2e@winewords.test", { exact: true })).toBeVisible();
});

test("Reader sees the user-management authorization boundary", async ({ readerPage }) => {
  await readerPage.goto("/users");
  await expect(readerPage.getByRole("heading", { name: "User Management" })).toBeVisible();
  await expect(readerPage.getByText("Access denied. Admin role required.", { exact: true })).toBeVisible();
});