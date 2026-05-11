import { test, expect } from "@playwright/test";
import { authFile, getTestIds } from "./helpers/fixtures";

test.use({ storageState: authFile("player1") });

test.describe("player flow", () => {
  test("sees their circle and navigates to it", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto("/circles");
    // Single circle → auto-redirects
    await expect(page).toHaveURL(`/circles/${circleId}`, { timeout: 8000 });
  });

  test("sees open topic with prediction form", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}`);
    await expect(page.getByRole("heading", { name: "Who will win the championship?" })).toBeVisible();
    await expect(page.getByText("Your prediction")).toBeVisible();
    await expect(page.getByPlaceholder("Type your prediction here")).toBeVisible();
  });

  test("submits a prediction", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}`);
    const textarea = page.getByPlaceholder("Type your prediction here");
    await textarea.fill("Team Alpha will win");
    await page.getByRole("button", { name: /submit prediction/i }).click();
    await expect(page.getByText("Prediction saved.")).toBeVisible();
    // The prediction text appears in both the <p> display and the textarea value — scope to the paragraph
    await expect(page.locator("p").filter({ hasText: "Team Alpha will win" })).toBeVisible();
  });

  test("edits an existing prediction", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}`);
    const textarea = page.getByPlaceholder("Type your prediction here");
    await textarea.fill("Team Beta will win");
    await page.getByRole("button", { name: /update prediction/i }).click();
    await expect(page.getByText("Prediction saved.")).toBeVisible();
    await expect(page.locator("p").filter({ hasText: "Team Beta will win" })).toBeVisible();
  });

  test("cannot see admin controls", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}`);
    await expect(page.getByRole("button", { name: /create topic/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /settle/i })).not.toBeVisible();
  });

  test("cannot access /admin panel", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText(/do not have permission/i).first()).toBeVisible();
  });

  test("topic detail shows locked message before close", async ({ page }) => {
    const { openTopicId } = getTestIds();
    await page.goto(`/topics/${openTopicId}`);
    await expect(page.getByText("Predictions are hidden until the topic closes.")).toBeVisible();
  });
});
