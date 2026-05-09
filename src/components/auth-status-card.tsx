"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { MagicLinkForm } from "@/components/magic-link-form";
import { createSupabaseBrowserClient } from "@/lib/supabase";

interface AuthStatusCardProps {
  projectHost: string | null;
  configured: boolean;
}

export function AuthStatusCard({ projectHost, configured }: AuthStatusCardProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        setSignOutError(error.message);
      } else {
        setSession(data.session ?? null);
      }

      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession ?? null);
      setLoading(false);
      setSignOutError(null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    setSigningOut(true);
    setSignOutError(null);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setSignOutError(error.message);
    }

    setSigningOut(false);
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Auth status</p>
      <div className="mt-4 space-y-3 text-sm text-zinc-700">
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-zinc-500">Supabase project</p>
          <p className="mt-1 font-medium text-zinc-900">{projectHost ?? "Not configured yet"}</p>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-zinc-500">Session</p>
          <p className="mt-1 font-medium text-zinc-900">
            {!configured
              ? "Missing public env"
              : loading
                ? "Restoring session..."
                : session
                  ? "Signed in"
                  : "Signed out"}
          </p>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-zinc-500">Signed-in email</p>
          <p className="mt-1 font-medium text-zinc-900">{session?.user.email ?? "No active session"}</p>
        </div>
      </div>

      {!configured ? (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          Add <code className="rounded bg-white px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to test auth.
        </div>
      ) : null}

      {session ? (
        <div className="mt-4 space-y-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
          <p>You’re signed in. This is the first real piece of the app now.</p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {signingOut ? "Signing out..." : "Log out"}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <MagicLinkForm />
        </div>
      )}

      {signOutError ? <p className="mt-3 text-sm text-rose-700">{signOutError}</p> : null}
    </div>
  );
}
