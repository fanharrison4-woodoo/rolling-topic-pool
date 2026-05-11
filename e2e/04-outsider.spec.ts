import { test, expect } from "@playwright/test";
import { authFile, getTestIds } from "./helpers/fixtures";

test.use({ storageState: authFile("outsider") });

test.describe("outsider (signed in but not a circle member)", () => {
  test("sees no circles on /circles page", async ({ page }) => {
    await page.goto("/circles");
    // Should stay on /circles (not redirect to a circle) and show empty state or join prompt
    await expect(page).toHaveURL("/circles", { timeout: 5000 });
    await expect(page.getByText(/not in any circle/i)).toBeVisible();
  });

  test("can visit a circle page but sees join button", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}`);
    await expect(page.getByRole("button", { name: /join circle/i })).toBeVisible();
  });

  test("cannot submit prediction before joining", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}`);
    await expect(page.getByPlaceholder("Type your prediction here")).not.toBeVisible();
  });

  test("joins the circle", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}`);
    await page.getByRole("button", { name: /join circle/i }).click();
    // Success: join button disappears and "Your prediction" section appears
    await expect(page.getByRole("button", { name: /join circle/i })).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Your prediction", { exact: true })).toBeVisible();
  });
});
