"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { MagicLinkForm } from "@/components/magic-link-form";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export function AppHeader() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [authError, setAuthError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    let isMounted = true;

    async function restoreSession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errorDescription =
        url.searchParams.get("error_description") ?? url.searchParams.get("error");

      if (errorDescription && isMounted) {
        setAuthError(errorDescription);
      }

      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (isMounted) {
          if (error) {
            setAuthError(`Sign-in failed: ${error.message}`);
          } else {
            url.searchParams.delete("code");
            url.searchParams.delete("state");
            window.history.replaceState({}, "", url.toString());
          }
        }
      }

      const { data, error } = await client.auth.getSession();
      if (!isMounted) return;

      if (error) {
        setAuthError(error.message);
      } else {
        const active = data.session ?? null;
        setSession(active);
        if (active) {
          const googleName =
            (active.user.user_metadata?.full_name as string | undefined) ??
            (active.user.user_metadata?.name as string | undefined);
          if (googleName) {
            void client
              .from("users_profile")
              .upsert({ id: active.user.id, display_name: googleName }, { onConflict: "id" });
          }
        }
      }

      setLoading(false);
    }

    void restoreSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, next) => {
      if (!isMounted) return;
      setSession(next ?? null);
      setLoading(false);
      setAuthError(null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSignOut() {
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    setOpen(false);
  }

  const googleName =
    (session?.user.user_metadata?.full_name as string | undefined) ??
    (session?.user.user_metadata?.name as string | undefined);
  const displayName = googleName ?? session?.user.email?.split("@")[0] ?? "";
  const initials = displayName
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/circles" className="text-sm font-semibold text-zinc-950 tracking-tight">
            PoolChain
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/circles"
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            >
              Circles
            </Link>
            <Link
              href="/topics"
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            >
              Topics
            </Link>
            <Link
              href="/history"
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            >
              History
            </Link>
          </nav>
        </div>

        <div className="relative" ref={dropdownRef}>
          {loading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200" />
          ) : session ? (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label="Account"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-700"
              >
                {initials}
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg">
                  <p className="text-sm font-medium text-zinc-900 truncate">{displayName}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 truncate">{session.user.email}</p>
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="w-full rounded-xl bg-zinc-50 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                  {authError && <p className="mt-2 text-xs text-rose-600">{authError}</p>}
                </div>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Sign in
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg">
                  <MagicLinkForm />
                  {authError && <p className="mt-2 text-xs text-rose-600">{authError}</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
