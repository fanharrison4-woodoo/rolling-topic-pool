"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isAppAdminEmail } from "@/lib/app-admins";
import { createSupabaseBrowserClient } from "@/lib/supabase";

interface MemberRow {
  memberId: string;
  userId: string;
  displayName: string;
  leagueId: string;
  leagueName: string;
  role: "admin" | "player";
  isCurrentUser: boolean;
}

export function LiveAdminPanel() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const load = useCallback(async (activeSession: Session | null) => {
    if (!supabase) return;

    setSession(activeSession);
    if (!activeSession || !isAppAdminEmail(activeSession.user.email)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const membershipsResult = await supabase
      .from("league_members")
      .select("id, user_id, role, leagues(id, name)")
      .eq("is_active", true);

    if (membershipsResult.error) {
      setError(membershipsResult.error.message);
      setLoading(false);
      return;
    }

    const rows = membershipsResult.data ?? [];
    const userIds = [...new Set(rows.map((r) => r.user_id))];

    const profilesResult = userIds.length > 0
      ? await supabase.from("users_profile").select("id, display_name").in("id", userIds)
      : { data: [], error: null };

    if (profilesResult.error) {
      setError(profilesResult.error.message);
      setLoading(false);
      return;
    }

    const profilesById = new Map((profilesResult.data ?? []).map((p) => [p.id, p.display_name]));

    setMembers(
      rows.map((r) => {
        const lg = r.leagues as unknown as { id: string; name: string } | null;
        return {
          memberId: r.id,
          userId: r.user_id,
          displayName: profilesById.get(r.user_id) ?? r.user_id,
          leagueId: lg?.id ?? "",
          leagueName: lg?.name ?? "",
          role: r.role as "admin" | "player",
          isCurrentUser: r.user_id === activeSession.user.id,
        };
      }),
    );

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) void load(data.session ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (isMounted) void load(next ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [load, supabase]);

  if (!session && !loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-sm text-zinc-600">Sign in to access the admin panel.</p>
      </div>
    );
  }

  if (!loading && session && !isAppAdminEmail(session.user.email)) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        You do not have permission to access this page.{" "}
        <Link href="/circles" className="underline">Go to Circles</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-2xl bg-zinc-200" />
        <div className="h-12 animate-pulse rounded-2xl bg-zinc-100" />
      </div>
    );
  }

  const byLeague = new Map<string, { leagueName: string; members: MemberRow[] }>();
  for (const m of members) {
    if (!byLeague.has(m.leagueId)) {
      byLeague.set(m.leagueId, { leagueName: m.leagueName, members: [] });
    }
    byLeague.get(m.leagueId)!.members.push(m);
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {members.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          No league members found.
        </div>
      )}

      {[...byLeague.entries()].map(([leagueId, { leagueName, members: leagueMembers }]) => (
        <div key={leagueId} className="rounded-2xl border border-zinc-200 bg-white p-5">
          <Link href={`/leagues/${leagueId}`} className="text-sm font-semibold text-zinc-900 hover:underline">
            {leagueName}
          </Link>
          <div className="mt-4 space-y-3">
            {leagueMembers.map((m) => (
              <div key={m.memberId} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 p-3">
                <p className="text-sm font-medium text-zinc-900">
                  {m.displayName}{m.isCurrentUser ? " (you)" : ""}
                </p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.role === "admin" ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
