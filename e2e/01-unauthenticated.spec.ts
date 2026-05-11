import { test, expect } from "@playwright/test";

test.describe("unauthenticated visitor", () => {
  test("home redirects to /circles", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/circles/);
  });

  test("/circles shows sign-in prompt", async ({ page }) => {
    await page.goto("/circles");
    await expect(page.getByText("Sign in to see your circles.")).toBeVisible();
  });

  test("/topics shows sign-in prompt", async ({ page }) => {
    await page.goto("/topics");
    await expect(page.getByText("Sign in to see topics.")).toBeVisible();
  });

  test("/history shows sign-in prompt", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByText("Sign in to see history.")).toBeVisible();
  });

  test("/admin shows sign-in prompt", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Sign in to access the admin panel.")).toBeVisible();
  });

  test("header has Sign in button", async ({ page }) => {
    await page.goto("/circles");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});
