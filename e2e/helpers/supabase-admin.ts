import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const adminClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface TestUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
  session: Session;
}

export async function createTestUser(email: string, password: string, displayName: string): Promise<TestUser> {
  const { data: existing } = await adminClient.auth.admin.listUsers();
  const found = existing?.users.find((u) => u.email === email);
  if (found) {
    await adminClient.auth.admin.deleteUser(found.id);
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  await adminClient.from("users_profile").upsert(
    { id: data.user.id, display_name: displayName },
    { onConflict: "id" },
  );

  const anonClient = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: sessionData, error: signInError } = await anonClient.auth.signInWithPassword({ email, password });
  if (signInError || !sessionData.session) throw new Error(`signIn failed: ${signInError?.message}`);

  return {
    id: data.user.id,
    email,
    password,
    displayName,
    session: sessionData.session,
  };
}

/** Build a Playwright storageState with the full Supabase session injected into localStorage. */
export function buildStorageState(session: Session, supabaseUrl: string) {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const key = `sb-${projectRef}-auth-token`;
  return {
    cookies: [] as object[],
    origins: [
      {
        origin: "http://localhost:3000",
        localStorage: [{ name: key, value: JSON.stringify(session) }],
      },
    ],
  };
}

export async function resetTestData() {
  const { data: leagues } = await adminClient.from("leagues").select("id, name");
  const testLeagueIds = (leagues ?? []).filter((l) => l.name.startsWith("[TEST]")).map((l) => l.id);
  if (testLeagueIds.length === 0) return;

  const { data: topics } = await adminClient.from("topics").select("id").in("league_id", testLeagueIds);
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

  await adminClient.from("league_members").delete().in("league_id", testLeagueIds);
  await adminClient.from("leagues").delete().in("id", testLeagueIds);
}
