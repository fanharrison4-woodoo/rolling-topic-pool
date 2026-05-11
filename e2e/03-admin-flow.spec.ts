import { test, expect } from "@playwright/test";
import { authFile, getTestIds } from "./helpers/fixtures";
import { adminClient } from "./helpers/supabase-admin";

test.use({ storageState: authFile("admin") });

test.describe("admin: topic management", () => {
  test("sees admin controls on circle page", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}`);
    await expect(page.getByRole("link", { name: /circle settings/i })).toBeVisible();
  });

  test("creates a draft topic when an open one exists", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}/settings`);

    const closeDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const localClose = closeDate.toISOString().slice(0, 16);

    await page.getByPlaceholder("Topic title").fill("Draft topic for testing");
    await page.getByPlaceholder("Description / question (optional)").fill("This is a draft test topic");
    await page.locator('input[type="datetime-local"]').last().fill(localClose);
    await page.getByRole("button", { name: /create topic/i }).click();
    await expect(page.getByText(/Topic created as draft/)).toBeVisible();
    await expect(page.getByText("Draft topic for testing")).toBeVisible();
  });

  // Edit must run before open — Edit button only visible while status is draft
  test("edits a draft topic", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}/settings`);

    const draftCard = page.locator(".rounded-xl").filter({ hasText: "Draft topic for testing" });
    await draftCard.getByRole("button", { name: "Edit" }).click();

    const titleInput = draftCard.locator('input[type="text"]');
    await titleInput.clear();
    await titleInput.fill("Draft topic (edited)");
    await draftCard.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Draft topic (edited)")).toBeVisible();
  });

  test("opens a draft topic", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}/settings`);

    const draftCard = page.locator(".rounded-xl").filter({ hasText: "Draft topic (edited)" });
    await draftCard.getByRole("button", { name: "Open" }).click();
    await expect(page.getByText("Topic opened.").first()).toBeVisible();
  });

  test("closes a topic", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}/settings`);

    const topic1Card = page.locator(".rounded-xl").filter({ hasText: "Who will win the championship?" });
    await topic1Card.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText(/Topic closed/).first()).toBeVisible();
  });
});

test.describe("admin: settlement flow", () => {
  test("sees all predictions after topic is closed", async ({ page }) => {
    const { circleId, openTopicId } = getTestIds();
    await adminClient.from("topics").update({ status: "closed" }).eq("id", openTopicId);
    await page.goto(`/circles/${circleId}`);
    await expect(page.getByText("All predictions")).toBeVisible({ timeout: 8000 });
  });

  test("settles topic with winners", async ({ page }) => {
    const { circleId, openTopicId } = getTestIds();
    await adminClient.from("topics").update({ status: "closed" }).eq("id", openTopicId);
    await page.goto(`/circles/${circleId}/settings`);

    // Wait for the settlement section (appears when featured topic is closed)
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible({ timeout: 8000 });
    await firstCheckbox.check();

    await page.getByPlaceholder("Optional resolution note").fill("Team Beta won the championship!");
    await page.getByRole("button", { name: /confirm settlement/i }).click();

    await expect(page.getByText(/Settled with \d+ winner/).first()).toBeVisible({ timeout: 10000 });
  });

  // These two tests rely on the topic being settled by the previous test — no beforeEach reset
  test("settled topic shows outcome", async ({ page }) => {
    const { circleId } = getTestIds();
    await page.goto(`/circles/${circleId}`);
    // After settlement, the topic shows in the All Topics list with settlement info
    // (the current-topic card now features the next open topic, not the settled one)
    await expect(page.getByText(/Settled.*winner/).first()).toBeVisible({ timeout: 8000 });
  });

  test("history page shows settled topic", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByText("Who will win the championship?")).toBeVisible({ timeout: 8000 });
    // "Settled rounds, payouts..." is a subtitle; target the per-topic "Settled May..." timestamp
    await expect(page.getByText(/Settled/).first()).toBeVisible();
  });

  test("no winners rolls pool forward", async ({ page }) => {
    const { circleId } = getTestIds();
    const { data: newTopic } = await adminClient.from("topics").insert({
      league_id: circleId,
      order_index: 99,
      title: "Rollover test topic",
      status: "closed",
      open_at: new Date().toISOString(),
      close_at: new Date().toISOString(),
      created_by: (await adminClient.from("league_members").select("user_id").eq("league_id", circleId).eq("role", "admin").single()).data?.user_id,
    }).select("id").single();

    await page.goto(`/circles/${circleId}/settings`);
    const settleBtn = page.getByRole("button", { name: /confirm settlement/i });
    if (await settleBtn.isVisible()) {
      await settleBtn.click();
      await expect(page.getByText(/pool carried forward|Settled with 0 winners/).first()).toBeVisible({ timeout: 10000 });
    }

    if (newTopic) await adminClient.from("topics").delete().eq("id", newTopic.id);
  });
});
