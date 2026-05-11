import { test, expect } from "@playwright/test";
import { authFile } from "./helpers/fixtures";
import { adminClient } from "./helpers/supabase-admin";

// creator is NOT a member of any circle, so no auto-redirect occurs
test.use({ storageState: authFile("creator") });

async function cleanupCreatorCircles() {
  const { data: leagues } = await adminClient.from("leagues").select("id, name");
  const testIds = (leagues ?? [])
    .filter((l) => l.name.startsWith("[TEST]") && l.name !== "[TEST] Prediction Circle")
    .map((l) => l.id);
  if (testIds.length === 0) return;

  const { data: topics } = await adminClient.from("topics").select("id").in("league_id", testIds);
  const topicIds = (topics ?? []).map((t) => t.id);
  if (topicIds.length > 0) {
    const { data: settlements } = await adminClient.from("settlements").select("id").in("topic_id", topicIds);
    const settlementIds = (settlements ?? []).map((s) => s.id);
    if (settlementIds.length > 0) {
      await adminClient.from("settlement_winners").delete().in("settlement_id", settlementIds);
      await adminClient.from("settlements").delete().in("id", settlementIds);
    }
    await adminClient.from("predictions").delete().in("topic_id", topicIds);
    await adminClient.from("topics").delete().in("id", topicIds);
  }
  await adminClient.from("league_members").delete().in("league_id", testIds);
  await adminClient.from("leagues").delete().in("id", testIds);
}

test.describe("create circle flow (two-step)", () => {
  // Clean up any circles the creator made in previous tests so there's no auto-redirect
  test.beforeEach(async () => {
    await cleanupCreatorCircles();
  });

  test.afterAll(async () => {
    await cleanupCreatorCircles();
  });

  test("step 1: fills in circle details", async ({ page }) => {
    await page.goto("/circles");
    await page.getByRole("button", { name: /create a circle/i }).click();
    await expect(page.getByText("Create a circle")).toBeVisible();

    await page.getByPlaceholder("Circle name").fill("[TEST] New Circle");
    await page.getByPlaceholder("Stake per topic").fill("5");
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByText("Create the first topic")).toBeVisible({ timeout: 8000 });
  });

  test("step 2: requires topic before finishing", async ({ page }) => {
    await page.goto("/circles");
    await page.getByRole("button", { name: /create a circle/i }).click();
    await page.getByPlaceholder("Circle name").fill("[TEST] New Circle B");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("Create the first topic")).toBeVisible({ timeout: 8000 });

    await page.getByPlaceholder("Topic title").fill("First topic");
    await page.getByRole("button", { name: /create topic/i }).click();
    await expect(page.getByText("Close time is required.")).toBeVisible();
  });

  test("step 2: creates topic and opens circle", async ({ page }) => {
    await page.goto("/circles");
    await page.getByRole("button", { name: /create a circle/i }).click();
    await page.getByPlaceholder("Circle name").fill("[TEST] Complete Circle");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("Create the first topic")).toBeVisible({ timeout: 8000 });

    const closeDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const localClose = closeDate.toISOString().slice(0, 16);

    await page.getByPlaceholder("Topic title").fill("Opening topic");
    await page.locator('input[type="datetime-local"]').fill(localClose);
    await page.getByRole("button", { name: /create topic/i }).click();

    await expect(page).toHaveURL(/\/circles\//, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Opening topic" })).toBeVisible();
  });
});
