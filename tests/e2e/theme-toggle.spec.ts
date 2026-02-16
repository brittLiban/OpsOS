import { expect, test } from "@playwright/test";

test("theme toggle switches dark mode and persists", async ({ page }) => {
  await page.goto("/today");

  const html = page.locator("html");
  const wasDark = await html.evaluate((element) => element.classList.contains("dark"));

  await page
    .getByRole("button", { name: /Switch to (dark|light) mode/i })
    .click();

  await expect
    .poll(async () => html.evaluate((element) => element.classList.contains("dark")))
    .toBe(!wasDark);

  await expect
    .poll(async () =>
      page.evaluate(() => window.localStorage.getItem("opsos-theme")),
    )
    .toBe(wasDark ? "light" : "dark");

  await page.reload();

  await expect
    .poll(async () => html.evaluate((element) => element.classList.contains("dark")))
    .toBe(!wasDark);
});
