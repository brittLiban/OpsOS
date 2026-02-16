import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("app loads and core routes render", async ({ page }) => {
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  await page.goto("/leads");
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();

  await page.goto("/pipeline");
  await expect(page.getByRole("heading", { name: "Pipeline" })).toBeVisible();

  await page.goto("/clients");
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
});

test("create lead -> log touchpoint -> set follow-up -> appears on Today", async ({ page }) => {
  await page.goto("/leads");
  await page.getByRole("button", { name: "New Lead" }).click();
  await page.getByLabel("Business Name").fill("E2E Lead Co");
  await page.getByRole("button", { name: "Save Lead" }).click();

  await expect(page).toHaveURL(/\/leads\/.+/);
  await expect(page.getByRole("heading", { name: "E2E Lead Co" })).toBeVisible();

  await page.getByRole("button", { name: "Log Touchpoint" }).first().click();
  await page.getByLabel("Summary").fill("Intro call completed");
  await page.getByRole("textbox", { name: "Notes" }).fill("Interested in service package.");
  const followUp = new Date();
  followUp.setHours(followUp.getHours() - 2);
  const localFollowUp = formatDateTimeLocal(followUp);
  await page
    .getByLabel("Next Follow-up")
    .fill(localFollowUp);
  const touchpointSaved = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response.url().includes("/touchpoints") &&
      response.status() === 200
    );
  });
  await page.getByRole("button", { name: "Save Touchpoint" }).click();
  await touchpointSaved;

  await page.goto("/today");
  await expect(page.getByText("E2E Lead Co").first()).toBeVisible();
});

test("import leads -> see results tabs", async ({ page }) => {
  await page.goto("/imports/new");
  const csvPath = path.resolve("tests/fixtures/import-basic.csv");
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  const uploadButton = page.getByRole("button", { name: "Upload CSV" });
  await expect(uploadButton).toBeEnabled();
  await uploadButton.click();
  await page.getByRole("button", { name: "Save Mapping" }).click();
  await page.getByRole("button", { name: "Start Import" }).click();

  await expect(page).toHaveURL(/\/imports\/.+/);
  await expect(page.getByRole("tab", { name: "Created" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Hard Duplicates Skipped" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Soft Duplicates Flagged" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Errors" })).toBeVisible();
});

test("merge soft duplicate -> verify row resolved", async ({ page }) => {
  await page.goto("/imports/new");
  const csvPath = path.resolve("tests/fixtures/import-soft-dup.csv");
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  const uploadButton = page.getByRole("button", { name: "Upload CSV" });
  await expect(uploadButton).toBeEnabled();
  await uploadButton.click();
  await page.getByRole("button", { name: "Save Mapping" }).click();
  await page.getByRole("button", { name: "Start Import" }).click();

  await page.getByRole("tab", { name: "Soft Duplicates Flagged" }).click();
  await expect
    .poll(async () => page.getByRole("button", { name: "Review" }).count(), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Review" }).first().click();
  await page.getByText("Merge with existing").click();
  const resolved = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response.url().includes("/resolve") &&
      response.status() === 200
    );
  });
  await page.getByRole("button", { name: "Confirm Resolution" }).click();
  await resolved;
});

test("convert lead -> client -> onboarding item can be marked done", async ({ page }) => {
  await page.goto("/leads");
  await page.getByRole("link", { name: "E2E Lead Co" }).first().click();
  await page.getByRole("button", { name: "Convert to Client" }).click();
  await expect(page).toHaveURL(/\/clients\/.+/);
  await expect(page.getByText("Onboarding Checklist")).toBeVisible();
  const firstCheckbox = page.getByRole("checkbox").first();
  await firstCheckbox.check();
  await expect(firstCheckbox).toBeChecked();
});

test("create script -> copy -> toast appears", async ({ page }) => {
  await page.goto("/scripts");
  await page.getByRole("button", { name: "New Script" }).click();
  await page.getByLabel("Title").fill("E2E Script");
  await page.getByLabel("Content").fill("Hello {{name}}, thanks for your time.");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Copy" }).first().click();
  await expect(page.getByText("Copied!")).toBeVisible();
});

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
