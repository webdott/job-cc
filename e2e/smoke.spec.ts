import { expect, test } from "@playwright/test";

test.describe("authenticated dashboard smoke checks", () => {
  test("home shows a personalized greeting", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("👋");
  });

  test("pipeline board renders", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page.getByRole("heading", { name: "Pipeline" })).toBeVisible();
  });

  test("discover page renders", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
  });

  test("profile page renders", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  });
});
