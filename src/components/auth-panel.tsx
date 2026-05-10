"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { MagicLinkForm } from "@/components/magic-link-form";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type LeagueSummary = {
  id: string;
  name: string;
  stake_amount: number;
  currency: string;
};

type TopicSummary = {
  id: string;
  title: string;
  status: string;
  close_at: string;
};

type MemberSummary = {
  user_id: string;
  role: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AuthPanel() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingLeague, setLoadingLeague] = useState(false);
  const [league, setLeague] = useState<LeagueSummary | null>(null);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [leagueError, setLeagueError] = useState<string | null>(null);
  const [creatingLeague, setCreatingLeague] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("Friends Prediction Pool");
  const [stake, setStake] = useState("5");

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return;
      }

      if (error) {
        setLeagueError(error.message);
      }

      setSession(data.session ?? null);
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      setLeague(null);
      setTopics([]);
      setMembers([]);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session?.user) {
      return;
    }

    const client = supabase as NonNullable<typeof supabase>;

    let mounted = true;

    async function loadLeagueState() {
      setLoadingLeague(true);
      setLeagueError(null);

      const leaguesResult = await client
        .from("leagues")
        .select("id, name, stake_amount, currency")
        .order("created_at", { ascending: true })
        .limit(1);

      if (!mounted) {
        return;
      }

      if (leaguesResult.error) {
        setLeagueError(leaguesResult.error.message);
        setLeague(null);
        setTopics([]);
        setMembers([]);
        setLoadingLeague(false);
        return;
      }

      const firstLeague = leaguesResult.data?.[0] ?? null;
      setLeague(firstLeague);

      if (!firstLeague) {
        setTopics([]);
        setMembers([]);
        setLoadingLeague(false);
        return;
      }

      const [topicsResult, membersResult] = await Promise.all([
        client
          .from("topics")
          .select("id, title, status, close_at")
          .eq("league_id", firstLeague.id)
          .order("order_index", { ascending: true })
          .limit(5),
        client
          .from("league_members")
          .select("user_id, role")
          .eq("league_id", firstLeague.id)
          .eq("is_active", true)
          .order("joined_at", { ascending: true }),
      ]);

      if (!mounted) {
        return;
      }

      if (topicsResult.error) {
        setLeagueError(topicsResult.error.message);
      } else {
        setTopics((topicsResult.data as TopicSummary[] | null) ?? []);
      }

      if (membersResult.error) {
        setLeagueError(membersResult.error.message);
      } else {
        setMembers((membersResult.data as MemberSummary[] | null) ?? []);
      }

      setLoadingLeague(false);
    }

    loadLeagueState();

    return () => {
      mounted = false;
    };
  }, [session, supabase]);

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    const client = supabase as NonNullable<typeof supabase>;
    await client.auth.signOut();
  }

  async function handleCreateLeague(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setCreateError("Supabase env is missing locally.");
      return;
    }

    const client = supabase as NonNullable<typeof supabase>;

    const numericStake = Number(stake);
    if (!leagueName.trim() || !Number.isFinite(numericStake) || numericStake < 0) {
      setCreateError("Enter a valid league name and stake.");
      return;
    }

    setCreatingLeague(true);
    setCreateError(null);

    const result = await client.rpc("bootstrap_league", {
      league_name: leagueName.trim(),
      stake: numericStake,
      league_currency: "USD",
    });

    if (result.error) {
      setCreateError(result.error.message);
      setCreatingLeague(false);
      return;
    }

    setLeague(null);
    setTopics([]);
    setMembers([]);
    setCreatingLeague(false);

    const leaguesResult = await client
      .from("leagues")
      .select("id, name, stake_amount, currency")
      .eq("id", result.data)
      .single();

    if (leaguesResult.error) {
      setCreateError(leaguesResult.error.message);
      return;
    }

    setLeague(leaguesResult.data as LeagueSummary);
  }

  if (!supabase) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Backend status</p>
        <div className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700">
          Supabase public env is missing in this environment.
        </div>
        <div className="mt-4">
          <MagicLinkForm />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Backend status</p>

      {loadingSession ? (
        <div className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700">Checking auth session…</div>
      ) : !session ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700">
            Signed out. Use a magic link to enter the real app state.
          </div>
          <MagicLinkForm />
        </div>
      ) : (
        <div className="mt-4 space-y-4 text-sm text-zinc-700">
          <div className="rounded-2xl bg-zinc-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-zinc-500">Signed in as</p>
                <p className="mt-1 font-medium text-zinc-900">{session.user.email}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
              >
                Sign out
              </button>
            </div>
          </div>

          {loadingLeague ? (
            <div className="rounded-2xl bg-zinc-50 p-4">Loading league data…</div>
          ) : league ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-zinc-500">Live league</p>
                  <p className="mt-1 font-medium text-zinc-900">{league.name}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-zinc-500">Stake</p>
                  <p className="mt-1 font-medium text-zinc-900">{formatMoney(league.stake_amount, league.currency)}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-zinc-500">Active members</p>
                  <p className="mt-1 font-medium text-zinc-900">{members.length}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-zinc-500">Loaded topics</p>
                  <p className="mt-1 font-medium text-zinc-900">{topics.length}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="font-medium text-zinc-900">Recent topics</p>
                {topics.length ? (
                  <div className="mt-3 space-y-2">
                    {topics.map((topic) => (
                      <div key={topic.id} className="rounded-xl bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-zinc-900">{topic.title}</span>
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs uppercase tracking-wide text-zinc-600">
                            {topic.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">Closes {formatDate(topic.close_at)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-zinc-600">No topics yet. Next step is creating the first topic flow.</p>
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleCreateLeague} className="space-y-3 rounded-2xl bg-zinc-50 p-4">
              <div>
                <p className="font-medium text-zinc-900">Create the first real league</p>
                <p className="mt-1 text-zinc-600">This calls the live Supabase bootstrap function instead of staying in mock mode.</p>
              </div>
              <input
                value={leagueName}
                onChange={(event) => setLeagueName(event.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
                placeholder="League name"
                required
              />
              <input
                value={stake}
                onChange={(event) => setStake(event.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
                type="number"
                min="0"
                step="0.01"
                placeholder="Stake per topic"
                required
              />
              <button
                type="submit"
                disabled={creatingLeague}
                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creatingLeague ? "Creating…" : "Create first league"}
              </button>
              {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
            </form>
          )}

          {leagueError ? <p className="text-sm text-red-600">{leagueError}</p> : null}
        </div>
      )}
    </div>
  );
}
