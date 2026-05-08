import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const { url, anonKey, configured } = getSupabasePublicEnv();

  if (!configured || !url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey);
}
