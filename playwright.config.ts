import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const frontendUrl = process.env.E2E_FRONTEND_URL ?? "http://127.0.0.1:4173";
const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3100/api/v1";
const apiRepository = process.env.E2E_API_REPOSITORY ?? path.resolve("../wine_words_api");
const auth = (role: string) => path.resolve(`.auth/${role}.json`);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  timeout: 30_000,
  expect: { timeout: 7_500, toHaveScreenshot: { animations: "disabled" } },
  outputDir: "test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
  use: {
    baseURL: frontendUrl,
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
    viewport: { width: 1440, height: 1000 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testIgnore: [/auth\.setup\.ts/, /accessibility\//, /visual\//],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: auth("admin") },
    },
    {
      name: "firefox",
      testMatch: /smoke\/.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Firefox"], storageState: auth("admin") },
    },
    {
      name: "accessibility",
      testMatch: /accessibility\/.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: auth("admin") },
    },
    {
      name: "visual",
      testMatch: /visual\/.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: auth("admin") },
    },
  ],
  webServer: [
    {
      command: `cd "${apiRepository}" && RAILS_ENV=e2e E2E_USER_PASSWORD=Playwright123! TEST_ACCESS_PASSWORD=playwright-access FRONTEND_URL=${frontendUrl} bin/rails e2e:prepare && RAILS_ENV=e2e E2E_USER_PASSWORD=Playwright123! TEST_ACCESS_PASSWORD=playwright-access FRONTEND_URL=${frontendUrl} bin/rails server -p 3100 -b 127.0.0.1`,
      url: `${apiUrl.replace(/\/api\/v1$/, "")}/up`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `VITE_API_BASE_URL=${apiUrl} npm run dev -- --host 127.0.0.1 --port 4173`,
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});