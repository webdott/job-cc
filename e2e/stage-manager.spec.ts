import { expect, test } from "@playwright/test";

// Exercises a real, AI-free create/verify/delete round trip through the
// Stage Manager modal — deliberately not the "Add job" flow, which requires
// a real Gemini API key and would incur AI cost on every CI run.
test("create a custom stage, see it as a new Kanban column, then delete it", async ({ page }) => {
  const label = `E2E Stage ${Date.now()}`;

  await page.goto("/pipeline");
  await page.getByRole("button", { name: "Manage stages" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("New stage name").fill(label);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByText(label, { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText(label, { exact: true })).toBeVisible();

  // Clean up so repeated local runs don't accumulate stages.
  await page.getByRole("button", { name: "Manage stages" }).click();
  const row = dialog.locator("div").filter({ hasText: label }).last();
  await row.getByRole("button", { name: "Delete stage" }).click();
  await expect(dialog.getByText(label, { exact: true })).toHaveCount(0);
});
