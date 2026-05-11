import { test as setup } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import { createTestUser, resetTestData, adminClient, buildStorageState } from "./helpers/supabase-admin";

config({ path: ".env.test" });

const AUTH_DIR = path.join(__dirname, ".auth");

export const USERS = {
  admin: { email: "test-admin@poolchain.test", password: "TestPass123!", displayName: "Alice Admin" },
  player1: { email: "test-player1@poolchain.test", password: "TestPass123!", displayName: "Bob Player" },
  player2: { email: "test-player2@poolchain.test", password: "TestPass123!", displayName: "Carol Player" },
  player3: { email: "test-player3@poolchain.test", password: "TestPass123!", displayName: "Dave Player" },
  player4: { email: "test-player4@poolchain.test", password: "TestPass123!", displayName: "Eve Player" },
  player5: { email: "test-player5@poolchain.test", password: "TestPass123!", displayName: "Frank Player" },
  outsider: { email: "test-outsider@poolchain.test", password: "TestPass123!", displayName: "Grace Outsider" },
  creator: { email: "test-creator@poolchain.test", password: "TestPass123!", displayName: "Hank Creator" },
};

function authFile(key: keyof typeof USERS) {
  return path.join(AUTH_DIR, `${key}.json`);
}

setup("create test users and circle", async () => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  await resetTestData();

  const [admin, p1, p2, p3, p4, p5, outsider, creator] = await Promise.all([
    createTestUser(USERS.admin.email, USERS.admin.password, USERS.admin.displayName),
    createTestUser(USERS.player1.email, USERS.player1.password, USERS.player1.displayName),
    createTestUser(USERS.player2.email, USERS.player2.password, USERS.player2.displayName),
    createTestUser(USERS.player3.email, USERS.player3.password, USERS.player3.displayName),
    createTestUser(USERS.player4.email, USERS.player4.password, USERS.player4.displayName),
    createTestUser(USERS.player5.email, USERS.player5.password, USERS.player5.displayName),
    createTestUser(USERS.outsider.email, USERS.outsider.password, USERS.outsider.displayName),
    createTestUser(USERS.creator.email, USERS.creator.password, USERS.creator.displayName),
  ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Save auth state for each user (creator is intentionally NOT added to any circle)
  const userMap = { admin, player1: p1, player2: p2, player3: p3, player4: p4, player5: p5, outsider, creator };
  for (const [key, user] of Object.entries(userMap)) {
    const state = buildStorageState(user.session, supabaseUrl);
    fs.writeFileSync(authFile(key as keyof typeof USERS), JSON.stringify(state, null, 2));
  }

  // Bootstrap circle as admin
  const { data: circleId, error: bootstrapError } = await adminClient.rpc("bootstrap_league", {
    league_name: "[TEST] Prediction Circle",
    stake: 10,
    league_currency: "USD",
    calling_user_id: admin.id,
  });

  let finalCircleId: string;
  if (bootstrapError) {
    const { data: league, error: leagueError } = await adminClient.from("leagues").insert({
      name: "[TEST] Prediction Circle",
      stake_amount: 10,
      currency: "USD",
      created_by: admin.id,
    }).select("id").single();
    if (leagueError || !league) throw new Error(`create league failed: ${leagueError?.message}`);
    finalCircleId = league.id;

    await adminClient.from("league_members").insert({
      league_id: finalCircleId,
      user_id: admin.id,
      role: "admin",
      is_active: true,
    });
  } else {
    finalCircleId = circleId as string;
  }

  // Add players 1-5 to the circle; outsider and creator are NOT added
  const players = [p1, p2, p3, p4, p5];
  await adminClient.from("league_members").insert(
    players.map((p) => ({
      league_id: finalCircleId,
      user_id: p.id,
      role: "player",
      is_active: true,
    })),
  );

  // Create an open topic (closes in 1 hour)
  const closeAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: openTopic, error: topicError } = await adminClient.from("topics").insert({
    league_id: finalCircleId,
    order_index: 1,
    title: "Who will win the championship?",
    description: "Predict the winner of this season's championship.",
    status: "open",
    open_at: new Date().toISOString(),
    close_at: closeAt,
    created_by: admin.id,
  }).select("id").single();
  if (topicError || !openTopic) throw new Error(`create topic failed: ${topicError?.message}`);

  fs.writeFileSync(
    path.join(AUTH_DIR, "test-ids.json"),
    JSON.stringify({ circleId: finalCircleId, openTopicId: openTopic.id }, null, 2),
  );

  console.log(`✓ Test circle: ${finalCircleId}`);
  console.log(`✓ Open topic: ${openTopic.id}`);
  console.log(`✓ Auth files written for ${Object.keys(userMap).length} users`);
});

export { authFile };
