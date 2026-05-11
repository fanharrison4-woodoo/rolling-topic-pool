"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isAppAdminEmail } from "@/lib/app-admins";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  getFeaturedTopicId,
  getTopicDisplayStatus,
} from "@/lib/topic-rules";
import { canRevealPredictionsToPlayers } from "@/lib/settlement-rules";
import type { Topic } from "@/lib/types";

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
  currentTopic: {
    id: string;
    title: string;
    description: string;
    status: Topic["status"];
    closeAt: string;
  } | null;
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
  userPrediction: {
    id: string;
    text: string;
    updatedAt: string;
  } | null;
  topicPredictions: {
    id: string;
    userId: string;
    predictionText: string;
    updatedAt: string;
    displayName: string;
  }[];
  currentTopicSettlement: {
    settledAt: string;
    winnerCount: number;
    payoutPerWinner: number;
    nextPoolAmount: number;
    resolutionNote: string | null;
    winnerNames: string[];
  } | null;
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

function statusTone(status: Topic["status"]) {
  switch (getTopicDisplayStatus(status)) {
    case "open":
      return "bg-emerald-100 text-emerald-800";
    case "closed":
      return "bg-amber-100 text-amber-800";
    case "settled":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-zinc-200 text-zinc-700";
  }
}

interface LiveCurrentTopicSectionProps {
  circleId: string;
}

export function LiveCurrentTopicSection({ circleId }: LiveCurrentTopicSectionProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [draft, setDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [joining, setJoining] = useState(false);

  const loadLiveState = useCallback(async (activeSession: Session | null) => {
    if (!supabase) {
      return;
    }

    setSession(activeSession);
    setSaveStatus(null);

    if (!activeSession) {
      setSnapshot(null);
      setDraft("");
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
      setError("League not found.");
      setSnapshot(null);
      setLoading(false);
      return;
    }

    const league = leagueResult.data;
    const viewerIsAppAdmin = isAppAdminEmail(activeSession.user.email);

    const [membersResult, membershipResult, topicsResult, membershipOpenResult] = await Promise.all([
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
      // Optional column — defaults to true if not yet migrated
      supabase.from("leagues").select("membership_open").eq("id", league.id).maybeSingle(),
    ]);

    // membership_open is optional — ignore its error
    const membershipOpen =
      (membershipOpenResult.data as unknown as { membership_open?: boolean } | null)?.membership_open ?? true;

    const firstError = membersResult.error ?? membershipResult.error ?? topicsResult.error;
    if (firstError) {
      setError(firstError.message);
      setSnapshot(null);
      setLoading(false);
      return;
    }

    const featuredTopicId = getFeaturedTopicId(
      (topicsResult.data ?? []).map((topic) => ({
        id: topic.id,
        order: topic.order_index,
        closeAt: topic.close_at,
        status: topic.status,
      })),
    );

    const liveTopic = topicsResult.data?.find((topic) => topic.id === featuredTopicId) ?? null;

    let livePrediction: LiveSnapshot["userPrediction"] = null;
    let topicPredictions: LiveSnapshot["topicPredictions"] = [];
    let currentTopicSettlement: LiveSnapshot["currentTopicSettlement"] = null;

    const viewerRole = membershipResult.data?.is_active ? membershipResult.data.role : null;

    const memberIds = (membersResult.data ?? []).map((member) => member.user_id);
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
        (profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]),
      );
    }

    const topicIds = (topicsResult.data ?? []).map((topic) => topic.id);
    let settlementByTopicId = new Map<string, NonNullable<LiveSnapshot["currentTopicSettlement"]>>();
    let latestSettlementCarryover = 0;

    if (topicIds.length > 0) {
      const settlementsForTopicsResult = await supabase
        .from("settlements")
        .select("id, topic_id, winner_count, payout_per_winner, next_pool_amount, resolution_note, settled_at")
        .in("topic_id", topicIds);

      if (settlementsForTopicsResult.error) {
        setError(settlementsForTopicsResult.error.message);
        setSnapshot(null);
        setLoading(false);
        return;
      }

      const settlementRows = settlementsForTopicsResult.data ?? [];
      const sortedSettlements = [...settlementRows].sort(
        (a, b) => new Date(b.settled_at).getTime() - new Date(a.settled_at).getTime(),
      );
      latestSettlementCarryover = Number(sortedSettlements[0]?.next_pool_amount ?? 0);
      const settlementIds = settlementRows.map((row) => row.id);
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

        for (const winnerRow of winnerRowsResult.data ?? []) {
          const current = winnerNamesBySettlementId.get(winnerRow.settlement_id) ?? [];
          current.push(memberProfiles.get(winnerRow.user_id) ?? winnerRow.user_id);
          winnerNamesBySettlementId.set(winnerRow.settlement_id, current);
        }
      }

      settlementByTopicId = new Map(
        settlementRows.map((row) => [
          row.topic_id,
          {
            settledAt: row.settled_at,
            winnerCount: row.winner_count,
            payoutPerWinner: Number(row.payout_per_winner ?? 0),
            nextPoolAmount: Number(row.next_pool_amount ?? 0),
            resolutionNote: row.resolution_note,
            winnerNames: winnerNamesBySettlementId.get(row.id) ?? [],
          },
        ]),
      );
    }

    if (liveTopic) {
      currentTopicSettlement = settlementByTopicId.get(liveTopic.id) ?? null;
    }

    if (liveTopic && viewerRole) {
      const predictionResult = await supabase
        .from("predictions")
        .select("id, prediction_text, updated_at")
        .eq("topic_id", liveTopic.id)
        .eq("user_id", activeSession.user.id)
        .maybeSingle();

      if (predictionResult.error) {
        setError(predictionResult.error.message);
        setSnapshot(null);
        setLoading(false);
        return;
      }

      livePrediction = predictionResult.data
        ? {
            id: predictionResult.data.id,
            text: predictionResult.data.prediction_text,
            updatedAt: predictionResult.data.updated_at,
          }
        : null;

      if (canRevealPredictionsToPlayers(getTopicDisplayStatus(liveTopic.status))) {
        const allPredictionsResult = await supabase
          .from("predictions")
          .select("id, user_id, prediction_text, updated_at")
          .eq("topic_id", liveTopic.id)
          .order("updated_at", { ascending: true });

        if (allPredictionsResult.error) {
          setError(allPredictionsResult.error.message);
          setSnapshot(null);
          setLoading(false);
          return;
        }

        topicPredictions = (allPredictionsResult.data ?? []).map((entry) => ({
          id: entry.id,
          userId: entry.user_id,
          predictionText: entry.prediction_text,
          updatedAt: entry.updated_at,
          displayName: memberProfiles.get(entry.user_id) ?? entry.user_id,
        }));
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
        topicCount: topicsResult.data?.length ?? 0,
        membershipOpen,
      },
      currentTopic: liveTopic
        ? {
            id: liveTopic.id,
            title: liveTopic.title,
            description: liveTopic.description ?? "",
            status: liveTopic.status,
            closeAt: liveTopic.close_at,
          }
        : null,
      topics: (topicsResult.data ?? []).map((topic) => ({
        id: topic.id,
        order: topic.order_index,
        title: topic.title,
        description: topic.description ?? "",
        status: topic.status,
        closeAt: topic.close_at,
        settlement: settlementByTopicId.get(topic.id) ?? null,
      })),
      members: (membersResult.data ?? []).map((member) => ({
        userId: member.user_id,
        displayName: memberProfiles.get(member.user_id) ?? member.user_id,
        role: member.role,
        isCurrentUser: member.user_id === activeSession.user.id,
      })),
      userPrediction: livePrediction,
      topicPredictions,
      currentTopicSettlement,
      carryover,
      contribution,
      totalPool: carryover + contribution,
    };

    setSnapshot(nextSnapshot);
    setDraft(livePrediction?.text ?? "");
    setLoading(false);
  }, [circleId, supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }
      void loadLiveState(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }
      void loadLiveState(nextSession ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadLiveState, supabase]);

  async function handleJoinLeague() {
    if (!supabase || !session || !snapshot) {
      return;
    }

    setJoining(true);
    setError(null);
    setSaveStatus(null);

    const { error: joinError } = await supabase.rpc("join_league", {
      target_league: snapshot.league.id,
    });

    if (joinError) {
      setError(joinError.message);
      setJoining(false);
      return;
    }

    await loadLiveState(session);
    setSaveStatus("You joined the circle. You can submit predictions now.");
    setJoining(false);
  }

  async function handleSave() {
    if (
      !supabase ||
      !session ||
      !snapshot?.currentTopic ||
      !snapshot.league.viewerRole ||
      snapshot.currentTopic.status !== "open"
    ) {
      return;
    }

    const nextText = draft.trim();
    if (!nextText) {
      setSaveStatus("Prediction text can't be empty.");
      return;
    }

    setSaving(true);
    setSaveStatus(null);

    const { data, error: saveError } = await supabase
      .from("predictions")
      .upsert(
        {
          topic_id: snapshot.currentTopic.id,
          user_id: session.user.id,
          prediction_text: nextText,
        },
        { onConflict: "topic_id,user_id" },
      )
      .select("id, prediction_text, updated_at")
      .single();

    if (saveError) {
      setSaveStatus(saveError.message);
      setSaving(false);
      return;
    }

    const updatedPrediction = {
      id: data.id,
      text: data.prediction_text,
      updatedAt: data.updated_at,
    };

    setSnapshot({
      ...snapshot,
      userPrediction: updatedPrediction,
    });
    setDraft(updatedPrediction.text);
    setSaveStatus("Prediction saved.");
    setSaving(false);
  }

  const canSaveLive = Boolean(session && snapshot?.league.viewerRole && snapshot?.currentTopic?.status === "open");
  const isAdmin = snapshot?.league.viewerRole === "admin";
  const isMember = Boolean(snapshot?.league.viewerRole);
  const canJoinLeague = Boolean(session && snapshot && !snapshot.league.viewerRole);
  const isAppAdmin = Boolean(snapshot?.league.viewerIsAppAdmin);
  const liveTopics = snapshot?.topics ?? [];
  const currentTopicPredictions = snapshot?.topicPredictions ?? [];
  const currentTopicSettlement = snapshot?.currentTopicSettlement ?? null;

  // Build full prediction list including N/A for members who didn't submit
  const predictionsWithNa = useMemo(() => {
    if (!snapshot || currentTopicPredictions.length === 0) return currentTopicPredictions;
    const submittedIds = new Set(currentTopicPredictions.map((p) => p.userId));
    const naEntries = snapshot.members
      .filter((m) => !submittedIds.has(m.userId))
      .map((m) => ({
        id: `na-${m.userId}`,
        userId: m.userId,
        predictionText: "N/A",
        updatedAt: "",
        displayName: m.displayName,
      }));
    return [...currentTopicPredictions, ...naEntries];
  }, [snapshot, currentTopicPredictions]);

  if (!supabase) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        Supabase is not configured in this environment.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-2/3 animate-pulse rounded-xl bg-zinc-200" />
        <div className="h-4 w-full animate-pulse rounded-xl bg-zinc-100" />
        <div className="h-4 w-5/6 animate-pulse rounded-xl bg-zinc-100" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-lg font-semibold text-zinc-900">Sign in to join the pool</p>
        <p className="mt-2 text-sm text-zinc-600">Use the Sign in button in the top-right corner to get started.</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-rose-600">
        {error ?? "League not found."}
      </div>
    );
  }

  const currency = snapshot.league.currency;

  return (
    <div className="space-y-6">
      {/* Admin settings link */}
      {isAdmin ? (
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-3">
          <p className="text-sm text-zinc-500">You manage this circle</p>
          <Link
            href={`/circles/${circleId}/settings`}
            className="text-sm font-medium text-zinc-900 hover:underline"
          >
            ⚙ Circle settings →
          </Link>
        </div>
      ) : null}

      {/* Circle rules (player-facing) */}
      {isMember && !isAdmin ? (
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-600">
          <p className="font-medium text-zinc-800">How this circle works</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Every member must submit a prediction for each topic.</li>
            <li>Your stake is counted even if you don&apos;t submit — your prediction shows as N/A.</li>
            <li>Membership{snapshot.league.membershipOpen ? " is open" : " is closed"} — {snapshot.league.membershipOpen ? "new players can join." : "no new players are being accepted."}</li>
          </ul>
        </div>
      ) : null}

      {/* Current topic header */}
      {snapshot.currentTopic ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Current topic</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{snapshot.currentTopic.title}</h2>
              <p className="mt-2 text-zinc-600">{snapshot.currentTopic.description}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${statusTone(snapshot.currentTopic.status)}`}>
              {getTopicDisplayStatus(snapshot.currentTopic.status)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">Circle</p>
              <p className="mt-1 text-sm font-medium">{snapshot.league.name}</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">Players</p>
              <p className="mt-1 text-sm font-medium">{snapshot.league.playerCount}</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">Stake</p>
              <p className="mt-1 text-sm font-medium">{formatMoney(snapshot.league.stakeAmount, currency)}</p>
            </div>
            <div className="rounded-xl bg-zinc-950 p-3 text-white">
              <p className="text-xs text-zinc-300">Total pool</p>
              <p className="mt-1 text-sm font-semibold">{formatMoney(snapshot.totalPool, currency)}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">Closes</p>
              <p className="mt-1 text-sm font-medium">{formatDate(snapshot.currentTopic.closeAt)}</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">Carryover</p>
              <p className="mt-1 text-sm font-medium">{formatMoney(snapshot.carryover, currency)}</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">New contributions</p>
              <p className="mt-1 text-sm font-medium">{formatMoney(snapshot.contribution, currency)}</p>
            </div>
          </div>

          {currentTopicSettlement ? (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
              <p className="font-medium text-sky-700">Settlement outcome</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg bg-white p-2 text-xs">Winners: {currentTopicSettlement.winnerCount}</div>
                <div className="rounded-lg bg-white p-2 text-xs">Payout: {formatMoney(currentTopicSettlement.payoutPerWinner, currency)}</div>
                <div className="rounded-lg bg-white p-2 text-xs">Next pool: {formatMoney(currentTopicSettlement.nextPoolAmount, currency)}</div>
                <div className="rounded-lg bg-white p-2 text-xs">{formatDate(currentTopicSettlement.settledAt)}</div>
              </div>
              {currentTopicSettlement.winnerNames.length > 0
                ? <p className="mt-2 text-xs">Winners: {currentTopicSettlement.winnerNames.join(", ")}</p>
                : <p className="mt-2 text-xs">No winners — pool rolled forward.</p>}
              {currentTopicSettlement.resolutionNote && <p className="mt-1 text-xs">Note: {currentTopicSettlement.resolutionNote}</p>}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-500">{snapshot.league.name}</p>
          <p className="mt-2 text-zinc-700">No active topic right now. Check back soon.</p>
        </div>
      )}

      {/* Membership / join */}
      {canJoinLeague ? (
        snapshot.league.membershipOpen ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
            <div>
              <p className="font-medium text-zinc-900">Not participating yet</p>
              <p className="mt-1 text-sm text-zinc-600">Join to submit predictions. Your stake is counted for every topic from the moment you join.</p>
            </div>
            <button
              type="button"
              onClick={handleJoinLeague}
              disabled={joining}
              className="shrink-0 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {joining ? "Joining…" : "Join circle"}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="font-medium text-zinc-700">Membership is closed</p>
            <p className="mt-1 text-sm text-zinc-500">This circle is no longer accepting new members.</p>
          </div>
        )
      ) : null}

      {/* Prediction form */}
      {snapshot.currentTopic && isMember ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Your prediction</p>
          {snapshot.userPrediction ? (
            <p className="mt-2 font-medium text-zinc-900">{snapshot.userPrediction.text}</p>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">No prediction submitted yet.</p>
          )}
          {snapshot.userPrediction && (
            <p className="mt-1 text-xs text-zinc-400">Last updated {formatDate(snapshot.userPrediction.updatedAt)}</p>
          )}

          {canSaveLive ? (
            <div className="mt-4 space-y-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={saving}
                placeholder="Type your prediction here"
                className="min-h-24 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none placeholder:text-zinc-400 disabled:opacity-50"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : snapshot.userPrediction ? "Update prediction" : "Submit prediction"}
                </button>
                {saveStatus && <p className="text-sm text-zinc-600">{saveStatus}</p>}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-zinc-400">
              {snapshot.currentTopic.status === "open" ? "Predictions are open." : "Predictions are locked — topic is closed."}
            </p>
          )}

          {predictionsWithNa.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">All predictions</p>
              <div className="mt-3 space-y-2">
                {predictionsWithNa.map((prediction) => (
                  <div key={prediction.id} className="flex items-start gap-3 rounded-xl border border-zinc-100 p-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{prediction.displayName}</p>
                      <p className={`mt-0.5 text-sm ${prediction.predictionText === "N/A" ? "italic text-zinc-400" : "text-zinc-700"}`}>
                        {prediction.predictionText}
                      </p>
                      {prediction.updatedAt && (
                        <p className="mt-0.5 text-xs text-zinc-400">{formatDate(prediction.updatedAt)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Topic history */}
      {liveTopics.length > 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">All topics</p>
          <div className="mt-4 space-y-3">
            {liveTopics.map((topic) => (
              <div key={topic.id} className="rounded-xl border border-zinc-100 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-xs font-medium text-white">#{topic.order}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(topic.status)}`}>{getTopicDisplayStatus(topic.status)}</span>
                </div>
                <p className="mt-2 font-medium text-zinc-900">{topic.title}</p>
                {topic.description && <p className="mt-0.5 text-sm text-zinc-600">{topic.description}</p>}
                <p className="mt-1 text-xs text-zinc-400">Closes {formatDate(topic.closeAt)}</p>
                {topic.settlement ? (
                  <div className="mt-2 rounded-lg bg-sky-50 p-2 text-xs text-sky-800">
                    Settled • {topic.settlement.winnerCount} winner{topic.settlement.winnerCount === 1 ? "" : "s"} • {formatMoney(topic.settlement.nextPoolAmount, currency)} carryover
                    {topic.settlement.winnerNames.length > 0 && <span> • {topic.settlement.winnerNames.join(", ")}</span>}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* App admin: link to global admin panel */}
      {isAppAdmin ? (
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-sm">
          <Link href="/admin" className="font-medium text-zinc-700 hover:text-zinc-950">
            Global admin panel →
          </Link>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}
