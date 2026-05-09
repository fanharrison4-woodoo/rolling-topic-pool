import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

let browserClient: SupabaseClient | null | undefined;

export function createSupabaseBrowserClient() {
  const { url, anonKey, configured } = getSupabasePublicEnv();

  if (!configured || !url || !anonKey) {
    browserClient = null;
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(url, anonKey);
  }

  return browserClient;
}
