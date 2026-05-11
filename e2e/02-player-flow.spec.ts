import { test, expect } from "@playwright/test";
import { authFile, getTestIds } from "./helpers/fixtures";

test.use({ storageState: authFile("player1") });

test.describe("player flow", () => {
  test("sees their circle and navigates to it", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto("/circles");
    // Circle appears as a card — click through to the circle page
    const circleCard = page.getByRole("link", { name: /\[TEST\] Prediction Circle/i });
    await expect(circleCard).toBeVisible({ timeout: 8000 });
    await circleCard.click();
    await expect(page).toHaveURL(`/circles/${circleId}`, { timeout: 8000 });
  });

  test("sees open topic with prediction form", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}`);
    // Topic title appears in the open topic card
    await expect(page.getByText("Who will win the championship?")).toBeVisible({ timeout: 8000 });
    // Prediction form is visible
    await expect(page.getByPlaceholder("What's your call?")).toBeVisible();
  });

  test("submits a prediction", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}`);
    const textarea = page.getByPlaceholder("What's your call?");
    await textarea.fill("Team Alpha will win");
    await page.getByRole("button", { name: /lock in my call/i }).click();
    await expect(page.getByText("Saved!")).toBeVisible({ timeout: 8000 });
    await expect(page.locator("p").filter({ hasText: "Team Alpha will win" })).toBeVisible();
  });

  test("edits an existing prediction", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}`);
    // After submitting, the placeholder switches to "Edit your call…"
    const textarea = page.getByPlaceholder("Edit your call…");
    await textarea.fill("Team Beta will win");
    await page.getByRole("button", { name: /update call/i }).click();
    await expect(page.getByText("Saved!")).toBeVisible({ timeout: 8000 });
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
