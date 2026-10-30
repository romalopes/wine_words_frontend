import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../fixtures/test";

for (const [name, route] of [
  ["wine catalogue", "/wines"],
  ["wine detail", "/wines/playwright-shiraz"],
  ["articles", "/articles"],
  ["user administration", "/users"],
] as const) {
  test(`${name} has no critical automated accessibility violations`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();
    await test.info().attach("axe-results", {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });
    const blocking = results.violations.filter((violation) =>
      violation.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
}