"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isAppAdminEmail } from "@/lib/app-admins";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { getTopicDisplayStatus } from "@/lib/topic-rules";
import type { Topic } from "@/lib/types";

interface OpenTopicSnap {
  id: string;
  order: number;
  title: string;
  description: string;
  closeAt: string;
  userPrediction: { id: string; text: string; updatedAt: string } | null;
}

interface LiveSnapshot {
  league: {
    id: string;
    name: string;
    stakeAmount: number;
    currency: string;
    playerCount: number;
    viewerRole: "admin" | "player" | null;
    viewerIsAppAdmin: boolean;
    topicCount: number;
    membershipOpen: boolean;
  };
  openTopics: OpenTopicSnap[];
  topics: {
    id: string;
    order: number;
    title: string;
    description: string;
    status: Topic["status"];
    closeAt: string;
    settlement: {
      settledAt: string;
      winnerCount: number;
      payoutPerWinner: number;
      nextPoolAmount: number;
      resolutionNote: string | null;
      winnerNames: string[];
    } | null;
  }[];
  members: {
    userId: string;
    displayName: string;
    role: "admin" | "player";
    isCurrentUser: boolean;
  }[];
  carryover: number;
  contribution: number;
  totalPool: number;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusBadge(status: Topic["status"]) {
  switch (getTopicDisplayStatus(status)) {
    case "open":
      return "bg-emerald-100 text-emerald-800";
    case "closed":
      return "bg-amber-100 text-amber-800";
    case "settled":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

interface Props {
  circleId: string;
}

export function LiveCurrentTopicSection({ circleId }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveStatuses, setSaveStatuses] = useState<Record<string, string | null>>({});
  const [savingTopics, setSavingTopics] = useState<Set<string>>(new Set());
  const [joining, setJoining] = useState(false);

  const loadLiveState = useCallback(
    async (activeSession: Session | null) => {
      if (!supabase) return;

      setSession(activeSession);
      setSaveStatuses({});

      if (!activeSession) {
        setSnapshot(null);
        setDrafts({});
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const leagueResult = await supabase
        .from("leagues")
        .select("id, name, stake_amount, currency")
        .eq("id", circleId)
        .maybeSingle();

      if (leagueResult.error) {
        setError(leagueResult.error.message);
        setSnapshot(null);
        setLoading(false);
        return;
      }

      if (!leagueResult.data) {
        setError("Circle not found.");
        setSnapshot(null);
        setLoading(false);
        return;
      }

      const league = leagueResult.data;
      const viewerIsAppAdmin = isAppAdminEmail(activeSession.user.email);

      const [membersResult, membershipResult, topicsResult, membershipOpenResult] =
        await Promise.all([
          supabase
            .from("league_members")
            .select("user_id, role, is_active")
            .eq("league_id", league.id)
            .eq("is_active", true),
          supabase
            .from("league_members")
            .select("role, is_active")
            .eq("league_id", league.id)
            .eq("user_id", activeSession.user.id)
            .maybeSingle(),
          supabase
            .from("topics")
            .select("id, title, description, status, close_at, order_index")
            .eq("league_id", league.id)
            .order("order_index", { ascending: true }),
          // membership_open is optional — ignore its error if column doesn't exist yet
          supabase.from("leagues").select("membership_open").eq("id", league.id).maybeSingle(),
        ]);

      const membershipOpen =
        (membershipOpenResult.data as unknown as { membership_open?: boolean } | null)
          ?.membership_open ?? true;

      const firstError = membersResult.error ?? membershipResult.error ?? topicsResult.error;
      if (firstError) {
        setError(firstError.message);
        setSnapshot(null);
        setLoading(false);
        return;
      }

      const viewerRole = membershipResult.data?.is_active
        ? (membershipResult.data.role as "admin" | "player")
        : null;
      const memberIds = (membersResult.data ?? []).map((m) => m.user_id);
      let memberProfiles = new Map<string, string>();

      if (memberIds.length > 0) {
        const profilesResult = await supabase
          .from("users_profile")
          .select("id, display_name")
          .in("id", memberIds);

        if (profilesResult.error) {
          setError(profilesResult.error.message);
          setSnapshot(null);
          setLoading(false);
          return;
        }
        memberProfiles = new Map(
          (profilesResult.data ?? []).map((p) => [p.id, p.display_name]),
        );
      }

      const allTopics = topicsResult.data ?? [];
      const topicIds = allTopics.map((t) => t.id);
      const settlementByTopicId = new Map<
        string,
        NonNullable<LiveSnapshot["topics"][0]["settlement"]>
      >();
      let latestSettlementCarryover = 0;

      if (topicIds.length > 0) {
        const settlementsResult = await supabase
          .from("settlements")
          .select(
            "id, topic_id, winner_count, payout_per_winner, next_pool_amount, resolution_note, settled_at",
          )
          .in("topic_id", topicIds);

        if (settlementsResult.error) {
          setError(settlementsResult.error.message);
          setSnapshot(null);
          setLoading(false);
          return;
        }

        const settlementRows = settlementsResult.data ?? [];
        const sorted = [...settlementRows].sort(
          (a, b) => new Date(b.settled_at).getTime() - new Date(a.settled_at).getTime(),
        );
        latestSettlementCarryover = Number(sorted[0]?.next_pool_amount ?? 0);

        const settlementIds = settlementRows.map((r) => r.id);
        const winnerNamesBySettlementId = new Map<string, string[]>();

        if (settlementIds.length > 0) {
          const winnerRowsResult = await supabase
            .from("settlement_winners")
            .select("settlement_id, user_id")
            .in("settlement_id", settlementIds);

          if (winnerRowsResult.error) {
            setError(winnerRowsResult.error.message);
            setSnapshot(null);
            setLoading(false);
            return;
          }

          for (const row of winnerRowsResult.data ?? []) {
            const curr = winnerNamesBySettlementId.get(row.settlement_id) ?? [];
            curr.push(memberProfiles.get(row.user_id) ?? row.user_id);
            winnerNamesBySettlementId.set(row.settlement_id, curr);
          }
        }

        for (const row of settlementRows) {
          settlementByTopicId.set(row.topic_id, {
            settledAt: row.settled_at,
            winnerCount: row.winner_count,
            payoutPerWinner: Number(row.payout_per_winner ?? 0),
            nextPoolAmount: Number(row.next_pool_amount ?? 0),
            resolutionNote: row.resolution_note,
            winnerNames: winnerNamesBySettlementId.get(row.id) ?? [],
          });
        }
      }

      // Load user's predictions for all open topics at once
      const openTopicsData = allTopics.filter((t) => t.status === "open");
      const userPredictionsByTopicId = new Map<
        string,
        { id: string; text: string; updatedAt: string }
      >();

      if (openTopicsData.length > 0 && viewerRole) {
        const predsResult = await supabase
          .from("predictions")
          .select("id, topic_id, prediction_text, updated_at")
          .in(
            "topic_id",
            openTopicsData.map((t) => t.id),
          )
          .eq("user_id", activeSession.user.id);

        if (predsResult.error) {
          setError(predsResult.error.message);
          setSnapshot(null);
          setLoading(false);
          return;
        }

        for (const p of predsResult.data ?? []) {
          userPredictionsByTopicId.set(p.topic_id, {
            id: p.id,
            text: p.prediction_text,
            updatedAt: p.updated_at,
          });
        }
      }

      const playerCount = membersResult.data?.length ?? 0;
      const stakeAmount = Number(league.stake_amount ?? 0);
      const carryover = latestSettlementCarryover;
      const contribution = stakeAmount * playerCount;

      const nextSnapshot: LiveSnapshot = {
        league: {
          id: league.id,
          name: league.name,
          stakeAmount,
          currency: league.currency,
          playerCount,
          viewerRole,
          viewerIsAppAdmin,
          topicCount: allTopics.length,
          membershipOpen,
        },
        openTopics: openTopicsData.map((t) => ({
          id: t.id,
          order: t.order_index,
          title: t.title,
          description: t.description ?? "",
          closeAt: t.close_at,
          userPrediction: userPredictionsByTopicId.get(t.id) ?? null,
        })),
        topics: allTopics.map((t) => ({
          id: t.id,
          order: t.order_index,
          title: t.title,
          description: t.description ?? "",
          status: t.status,
          closeAt: t.close_at,
          settlement: settlementByTopicId.get(t.id) ?? null,
        })),
        members: (membersResult.data ?? []).map((m) => ({
          userId: m.user_id,
          displayName: memberProfiles.get(m.user_id) ?? m.user_id,
          role: m.role as "admin" | "player",
          isCurrentUser: m.user_id === activeSession.user.id,
        })),
        carryover,
        contribution,
        totalPool: carryover + contribution,
      };

      setSnapshot(nextSnapshot);

      const initDrafts: Record<string, string> = {};
      for (const t of openTopicsData) {
        initDrafts[t.id] = userPredictionsByTopicId.get(t.id)?.text ?? "";
      }
      setDrafts(initDrafts);
      setLoading(false);
    },
    [circleId, supabase],
  );

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) void loadLiveState(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (isMounted) void loadLiveState(next ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadLiveState, supabase]);

  async function handleJoinLeague() {
    if (!supabase || !session || !snapshot) return;
    setJoining(true);
    setError(null);

    const { error: joinError } = await supabase.rpc("join_league", {
      target_league: snapshot.league.id,
    });

    if (joinError) {
      setError(joinError.message);
      setJoining(false);
      return;
    }

    await loadLiveState(session);
    setJoining(false);
  }

  async function handleSave(topicId: string) {
    if (!supabase || !session || !snapshot?.league.viewerRole) return;

    const draftText = (drafts[topicId] ?? "").trim();
    if (!draftText) {
      setSaveStatuses((prev) => ({ ...prev, [topicId]: "Prediction can't be empty." }));
      return;
    }

    setSavingTopics((prev) => new Set(prev).add(topicId));
    setSaveStatuses((prev) => ({ ...prev, [topicId]: null }));

    const { data, error: saveError } = await supabase
      .from("predictions")
      .upsert(
        { topic_id: topicId, user_id: session.user.id, prediction_text: draftText },
        { onConflict: "topic_id,user_id" },
      )
      .select("id, prediction_text, updated_at")
      .single();

    if (saveError) {
      setSaveStatuses((prev) => ({ ...prev, [topicId]: saveError.message }));
      setSavingTopics((prev) => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
      return;
    }

    setSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        openTopics: prev.openTopics.map((t) =>
          t.id === topicId
            ? {
                ...t,
                userPrediction: {
                  id: data.id,
                  text: data.prediction_text,
                  updatedAt: data.updated_at,
                },
              }
            : t,
        ),
      };
    });
    setDrafts((prev) => ({ ...prev, [topicId]: data.prediction_text }));
    setSaveStatuses((prev) => ({ ...prev, [topicId]: "Saved!" }));
    setSavingTopics((prev) => {
      const next = new Set(prev);
      next.delete(topicId);
      return next;
    });
  }

  const isAdmin = snapshot?.league.viewerRole === "admin";
  const isMember = Boolean(snapshot?.league.viewerRole);
  const canJoinLeague = Boolean(session && snapshot && !snapshot.league.viewerRole);
  const isAppAdmin = Boolean(snapshot?.league.viewerIsAppAdmin);
  const currency = snapshot?.league.currency ?? "USD";
  const pastTopics = (snapshot?.topics ?? []).filter(
    (t) => t.status === "closed" || t.status === "settled",
  );

  if (!supabase) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        Supabase is not configured in this environment.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-3xl bg-zinc-200" />
        <div className="h-40 animate-pulse rounded-3xl bg-zinc-100" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-3xl">🔐</p>
        <p className="mt-3 text-lg font-semibold text-zinc-900">Sign in to join the pool</p>
        <p className="mt-1 text-sm text-zinc-500">Use the Sign in button above to get started.</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-rose-600">
        {error ?? "Circle not found."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Admin settings link */}
      {isAdmin && (
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-3">
          <p className="text-sm text-zinc-500">You manage this circle</p>
          <Link
            href={`/circles/${circleId}/settings`}
            className="text-sm font-medium text-zinc-900 hover:underline"
          >
            ⚙ Circle settings →
          </Link>
        </div>
      )}

      {/* Pool jackpot summary */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white">
        <p className="text-sm font-medium text-amber-100">{snapshot.league.name}</p>
        <div className="mt-2">
          <p className="text-xs text-amber-200">Current jackpot</p>
          <p className="text-4xl font-bold tracking-tight">
            {formatMoney(snapshot.totalPool, currency)}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-100">
          <span>{snapshot.league.playerCount} players</span>
          <span>·</span>
          <span>{formatMoney(snapshot.league.stakeAmount, currency)} stake each</span>
          {snapshot.carryover > 0 && (
            <>
              <span>·</span>
              <span>{formatMoney(snapshot.carryover, currency)} carryover</span>
            </>
          )}
        </div>
      </div>

      {/* Join CTA */}
      {canJoinLeague &&
        (snapshot.league.membershipOpen ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
            <div>
              <p className="font-semibold text-zinc-900">Not in this circle yet</p>
              <p className="mt-1 text-sm text-zinc-500">
                Join to submit predictions. Your stake counts from the moment you join.
              </p>
            </div>
            <button
              type="button"
              onClick={handleJoinLeague}
              disabled={joining}
              className="shrink-0 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {joining ? "Joining…" : "Join circle"}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="font-semibold text-zinc-700">Membership is closed</p>
            <p className="mt-1 text-sm text-zinc-500">
              This circle isn&apos;t accepting new members right now.
            </p>
          </div>
        ))}

      {/* Player rules strip */}
      {isMember && !isAdmin && (
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
          Membership is {snapshot.league.membershipOpen ? "open" : "closed"} · Missed a topic?
          Your stake still counts — marked as N/A.
        </div>
      )}

      {/* Open topics — one card per topic */}
      {snapshot.openTopics.length > 0 ? (
        <div className="space-y-4">
          {snapshot.openTopics.map((topic) => {
            const isSaving = savingTopics.has(topic.id);
            const saveStatus = saveStatuses[topic.id] ?? null;
            const draft = drafts[topic.id] ?? "";

            return (
              <div
                key={topic.id}
                className="rounded-3xl border-2 border-emerald-200 bg-white p-6"
              >
                <div>
                  <span className="inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">
                    Open · Round #{topic.order}
                  </span>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-zinc-900">
                    {topic.title}
                  </h2>
                  {topic.description && (
                    <p className="mt-1 text-sm text-zinc-600">{topic.description}</p>
                  )}
                  <p className="mt-2 text-xs text-zinc-400">Closes {formatDate(topic.closeAt)}</p>
                </div>

                {isMember ? (
                  <div className="mt-5 border-t border-zinc-100 pt-5">
                    {topic.userPrediction && (
                      <div className="mb-3 rounded-xl bg-zinc-50 px-4 py-3">
                        <p className="text-xs font-medium text-zinc-500">Your current call</p>
                        <p className="mt-1 font-medium text-zinc-900">{topic.userPrediction.text}</p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          Updated {formatDate(topic.userPrediction.updatedAt)}
                        </p>
                      </div>
                    )}
                    <div className="space-y-3">
                      <textarea
                        value={draft}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [topic.id]: e.target.value }))
                        }
                        disabled={isSaving}
                        placeholder={topic.userPrediction ? "Edit your call…" : "What's your call?"}
                        className="min-h-20 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none placeholder:text-zinc-400 focus:border-emerald-300 focus:bg-white disabled:opacity-50"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleSave(topic.id)}
                          disabled={isSaving}
                          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isSaving
                            ? "Saving…"
                            : topic.userPrediction
                              ? "Update call"
                              : "Lock in my call"}
                        </button>
                        {saveStatus && (
                          <p className="text-sm text-zinc-600">{saveStatus}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-zinc-500">
                    Join the circle to submit a prediction for this round.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        isMember && (
          <div className="rounded-2xl border border-zinc-100 bg-white p-8 text-center">
            <p className="text-3xl">🕐</p>
            <p className="mt-2 font-semibold text-zinc-700">No open rounds right now</p>
            <p className="mt-1 text-sm text-zinc-500">
              Your circle admin will open the next round soon.
            </p>
          </div>
        )
      )}

      {/* Past rounds */}
      {pastTopics.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Past rounds
          </p>
          <div className="mt-4 space-y-3">
            {pastTopics.map((topic) => (
              <div key={topic.id} className="rounded-xl border border-zinc-100 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                    #{topic.order}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(topic.status)}`}
                  >
                    {getTopicDisplayStatus(topic.status)}
                  </span>
                </div>
                <p className="mt-2 font-semibold text-zinc-900">{topic.title}</p>
                {topic.description && (
                  <p className="mt-0.5 text-sm text-zinc-500">{topic.description}</p>
                )}
                <p className="mt-1 text-xs text-zinc-400">Closed {formatDate(topic.closeAt)}</p>
                {topic.settlement ? (
                  <div className="mt-3 rounded-xl bg-sky-50 p-3 text-xs text-sky-900">
                    <span className="font-semibold">
                      {topic.settlement.winnerCount} winner
                      {topic.settlement.winnerCount === 1 ? "" : "s"}
                    </span>
                    {topic.settlement.winnerCount > 0 && (
                      <> · {formatMoney(topic.settlement.payoutPerWinner, currency)} each</>
                    )}{" "}
                    · {formatMoney(topic.settlement.nextPoolAmount, currency)} rolls over
                    {topic.settlement.winnerNames.length > 0 && (
                      <> · {topic.settlement.winnerNames.join(", ")}</>
                    )}
                    {topic.settlement.resolutionNote && (
                      <p className="mt-1 italic">{topic.settlement.resolutionNote}</p>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* App admin link */}
      {isAppAdmin && (
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-sm">
          <Link href="/admin" className="font-medium text-zinc-700 hover:text-zinc-950">
            Global admin panel →
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
