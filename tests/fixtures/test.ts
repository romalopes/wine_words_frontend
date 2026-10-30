import { test as base, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { apiUrl } from "../support/environment";
import { LoginPage } from "../pages/LoginPage";
import { WineListPage } from "../pages/WineListPage";
import { WineDetailPage } from "../pages/WineDetailPage";
import { AdminUsersPage } from "../pages/AdminUsersPage";

type Fixtures = {
  api: APIRequestContext;
  adminPage: Page;
  reviewerPage: Page;
  readerPage: Page;
  guestPage: Page;
  publicPage: Page;
  loginPage: LoginPage;
  wineListPage: WineListPage;
  wineDetailPage: WineDetailPage;
  adminUsersPage: AdminUsersPage;
};

async function rolePage(browser: Browser, role: string, accessToken: string): Promise<Page> {
  const context = await browser.newContext({ storageState: path.resolve(`.auth/${role}.json`) });
  await context.addInitScript((token: string) => {
    window.sessionStorage.setItem("wine_words_test_access_token", token);
  }, accessToken);
  return context.newPage();
}

export const test = base.extend<Fixtures>({
  context: async ({ context }, use) => {
    const access = JSON.parse(await fs.readFile(path.resolve(".auth/test-access.json"), "utf8")) as { token: string };
    await context.addInitScript((token: string) => {
      window.sessionStorage.setItem("wine_words_test_access_token", token);
    }, access.token);
    await use(context);
  },
  api: async ({ playwright }, use) => {
    const access = JSON.parse(await fs.readFile(path.resolve(".auth/test-access.json"), "utf8")) as { token: string };
    const api = await playwright.request.newContext({
      baseURL: `${apiUrl}/`,
      extraHTTPHeaders: { "X-Test-Access-Token": access.token },
    });
    await use(api);
    await api.dispose();
  },
  adminPage: async ({ browser }, use) => {
    const access = JSON.parse(await fs.readFile(path.resolve(".auth/test-access.json"), "utf8")) as { token: string };
    const page = await rolePage(browser, "admin", access.token);
    await use(page);
    await page.context().close();
  },
  reviewerPage: async ({ browser }, use) => {
    const access = JSON.parse(await fs.readFile(path.resolve(".auth/test-access.json"), "utf8")) as { token: string };
    const page = await rolePage(browser, "reviewer", access.token);
    await use(page);
    await page.context().close();
  },
  readerPage: async ({ browser }, use) => {
    const access = JSON.parse(await fs.readFile(path.resolve(".auth/test-access.json"), "utf8")) as { token: string };
    const page = await rolePage(browser, "reader", access.token);
    await use(page);
    await page.context().close();
  },
  guestPage: async ({ browser }, use) => {
    const access = JSON.parse(await fs.readFile(path.resolve(".auth/test-access.json"), "utf8")) as { token: string };
    const page = await rolePage(browser, "guest", access.token);
    await use(page);
    await page.context().close();
  },
  publicPage: async ({ browser }, use) => {
    const access = JSON.parse(await fs.readFile(path.resolve(".auth/test-access.json"), "utf8")) as { token: string };
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    await context.addInitScript((token: string) => {
      window.sessionStorage.setItem("wine_words_test_access_token", token);
    }, access.token);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  wineListPage: async ({ page }, use) => use(new WineListPage(page)),
  wineDetailPage: async ({ page }, use) => use(new WineDetailPage(page)),
  adminUsersPage: async ({ page }, use) => use(new AdminUsersPage(page)),
});

export { expect };
export type { Page };