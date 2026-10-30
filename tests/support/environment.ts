export const frontendUrl = process.env.E2E_FRONTEND_URL ?? "http://127.0.0.1:4173";
export const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3100/api/v1";
export const testAccessPassword = process.env.E2E_TEST_ACCESS_PASSWORD ?? "playwright-access";
export const userPassword = process.env.E2E_USER_PASSWORD ?? "Playwright123!";

export const accounts = {
  admin: "admin.e2e@winewords.test",
  reviewer: "reviewer.e2e@winewords.test",
  reader: "reader.e2e@winewords.test",
  guest: "guest.e2e@winewords.test",
} as const;

export type AccountRole = keyof typeof accounts;