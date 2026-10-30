import { test, expect } from "../fixtures/test";
import { accounts, userPassword } from "../support/environment";
import { createProducer, signInApi, uniqueName } from "../factories/apiFactories";

test("creates a producer through an authenticated API factory and renders it", async ({ api, adminPage }) => {
  const token = await signInApi(api, accounts.admin, userPassword);
  const producer = await createProducer(api, token, uniqueName("Playwright Factory Estate"));
  await adminPage.goto(`/producers/${producer.slug}`);
  await expect(adminPage.getByRole("heading", { name: producer.name })).toBeVisible();
});

test("reader sees producer creation as disabled", async ({ readerPage }) => {
  await readerPage.goto("/producers");
  const addProducer = readerPage.getByRole("link", { name: /Add Producer/ });
  await expect(addProducer).toHaveAttribute("aria-disabled", "true");
  await expect(addProducer).toHaveAttribute("href", "/producers/new");
});