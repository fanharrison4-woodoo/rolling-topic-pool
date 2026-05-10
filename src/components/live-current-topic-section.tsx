"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isAppAdminEmail } from "@/lib/app-admins";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  canLeagueAdminCloseTopic,
  canLeagueAdminDeclareWinners,
  canLeagueAdminOpenTopic,
  canSettleTopicByOrder,
  getFeaturedTopicId,
  getNextTopicStatusOnCreate,
  getTopicDisplayStatus,
  validateTopicCloseTimesByOrder,
} from "@/lib/topic-rules";
import { canRevealPredictionsToPlayers, computeSettlement } from "@/lib/settlement-rules";
import type { League, PoolState, Prediction, Topic } from "@/lib/types";

interface LiveCurrentTopicSectionProps {
  fallbackLeague: League;
  fallbackPool: PoolState;
  fallbackTopic: Topic;
  fallbackUserPrediction?: Prediction;
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

export function LiveCurrentTopicSection({
  fallbackLeague,
  fallbackPool,
  fallbackTopic,
  fallbackUserPrediction,
}: LiveCurrentTopicSectionProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [draft, setDraft] = useState(fallbackUserPrediction?.text ?? "");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [joining, setJoining] = useState(false);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [topicCloseAt, setTopicCloseAt] = useState("");
  const [topicStatus, setTopicStatus] = useState<string | null>(null);
  const [roleStatus, setRoleStatus] = useState<string | null>(null);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);
  const [changingTopicId, setChangingTopicId] = useState<string | null>(null);
  const [selectedWinnerUserIds, setSelectedWinnerUserIds] = useState<string[]>([]);
  const [resolutionNote, setResolutionNote] = useState("");
  const [settlingTopic, setSettlingTopic] = useState(false);

  const loadLiveState = useCallback(async (activeSession: Session | null) => {
    if (!supabase) {
      return;
    }

    setSession(activeSession);
    setSaveStatus(null);

    if (!activeSession) {
      setSnapshot(null);
      setDraft(fallbackUserPrediction?.text ?? "");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const leagueResult = await supabase
      .from("leagues")
      .select("id, name, stake_amount, currency")
      .limit(1)
      .maybeSingle();

    if (leagueResult.error) {
      setError(leagueResult.error.message);
      setSnapshot(null);
      setLoading(false);
      return;
    }

    if (!leagueResult.data) {
      setSnapshot(null);
      setDraft("");
      setLoading(false);
      return;
    }

    const league = leagueResult.data;
    const viewerIsAppAdmin = isAppAdminEmail(activeSession.user.email);

    const [membersResult, membershipResult, topicsResult, settlementResult] = await Promise.all([
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
      supabase
        .from("settlements")
        .select("next_pool_amount, settled_at")
        .order("settled_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const firstError = membersResult.error ?? membershipResult.error ?? topicsResult.error ?? settlementResult.error;
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
    const carryover = Number(settlementResult.data?.next_pool_amount ?? 0);
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
    setSelectedWinnerUserIds([]);
    setResolutionNote("");
    setLoading(false);
  }, [fallbackUserPrediction?.text, supabase]);

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

  async function handleBootstrap() {
    if (!supabase || !session) {
      return;
    }

    setBootstrapping(true);
    setError(null);
    setSaveStatus(null);

    const { data: existingLeague, error: existingLeagueError } = await supabase
      .from("leagues")
      .select("id, name")
      .limit(1)
      .maybeSingle();

    if (existingLeagueError) {
      setError(existingLeagueError.message);
      setBootstrapping(false);
      return;
    }

    let leagueId = existingLeague?.id ?? null;

    if (!leagueId) {
      const { data: bootstrappedLeagueId, error: bootstrapError } = await supabase.rpc("bootstrap_league", {
        league_name: fallbackLeague.name,
        stake: fallbackLeague.stakePerTopic,
        league_currency: fallbackLeague.currency,
      });

      if (bootstrapError) {
        setError(bootstrapError.message);
        setBootstrapping(false);
        return;
      }

      leagueId = bootstrappedLeagueId;
    }

    const { data: existingTopics, error: topicLookupError } = await supabase
      .from("topics")
      .select("id")
      .eq("league_id", leagueId)
      .limit(1);

    if (topicLookupError) {
      setError(topicLookupError.message);
      setBootstrapping(false);
      return;
    }

    if (!existingTopics || existingTopics.length === 0) {
      const { error: topicInsertError } = await supabase.from("topics").insert({
        league_id: leagueId,
        order_index: 1,
        title: fallbackTopic.title,
        description: fallbackTopic.description,
        status: "open",
        open_at: new Date().toISOString(),
        close_at: fallbackTopic.closeAt,
        created_by: session.user.id,
      });

      if (topicInsertError) {
        setError(topicInsertError.message);
        setBootstrapping(false);
        return;
      }
    }

    await loadLiveState(session);
    setSaveStatus("Starter league and topic are ready.");
    setBootstrapping(false);
  }

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
    setSaveStatus("You joined the league. You can submit predictions now.");
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
      setSaveStatus("Prediction text can’t be empty.");
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

  async function handleCreateTopic() {
    if (!supabase || !session || !snapshot || snapshot.league.viewerRole !== "admin") {
      return;
    }

    const nextTitle = topicTitle.trim();
    const nextDescription = topicDescription.trim();

    if (!nextTitle) {
      setTopicStatus("Topic title is required.");
      return;
    }

    if (!topicCloseAt) {
      setTopicStatus("Close time is required.");
      return;
    }

    setCreatingTopic(true);
    setTopicStatus(null);
    setError(null);

    const nextOrder = snapshot.league.topicCount + 1;
    const nextCloseAtIso = new Date(topicCloseAt).toISOString();
    const nextStatus = getNextTopicStatusOnCreate(
      snapshot.topics.some((topic) => getTopicDisplayStatus(topic.status) === "open"),
    );
    const orderingResult = validateTopicCloseTimesByOrder([
      ...snapshot.topics.map((topic) => ({ order: topic.order, closeAt: topic.closeAt })),
      { order: nextOrder, closeAt: nextCloseAtIso },
    ]);

    if (!orderingResult.valid) {
      setTopicStatus("Close time conflicts with topic order. Later topics cannot close earlier than previous ones.");
      setCreatingTopic(false);
      return;
    }

    const { error: createError } = await supabase.from("topics").insert({
      league_id: snapshot.league.id,
      order_index: nextOrder,
      title: nextTitle,
      description: nextDescription || null,
      status: nextStatus,
      open_at: nextStatus === "open" ? new Date().toISOString() : null,
      close_at: nextCloseAtIso,
      created_by: session.user.id,
    });

    if (createError) {
      setTopicStatus(createError.message);
      setCreatingTopic(false);
      return;
    }

    setTopicTitle("");
    setTopicDescription("");
    setTopicCloseAt("");
    setTopicStatus(nextStatus === "open" ? "Topic created and opened." : "Topic created as draft because there is already an active open topic.");
    await loadLiveState(session);
    setCreatingTopic(false);
  }

  async function handleChangeTopicStatus(topicId: string, nextStatus: "open" | "closed") {
    if (!supabase || !session || !snapshot || snapshot.league.viewerRole !== "admin") {
      return;
    }

    setChangingTopicId(topicId);
    setTopicStatus(null);
    setError(null);

    const updates: { status: "open" | "closed"; open_at?: string } = { status: nextStatus };
    if (nextStatus === "open") {
      updates.open_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("topics")
      .update(updates)
      .eq("id", topicId);

    if (updateError) {
      setTopicStatus(updateError.message);
      setChangingTopicId(null);
      return;
    }

    await loadLiveState(session);
    setTopicStatus(nextStatus === "open" ? "Topic opened." : "Topic closed. Predictions are now viewable and ready for judging.");
    setChangingTopicId(null);
  }

  function toggleWinnerSelection(userId: string) {
    setSelectedWinnerUserIds((current) =>
      current.includes(userId) ? current.filter((entry) => entry !== userId) : [...current, userId],
    );
  }

  async function handleSettleCurrentTopic() {
    if (!supabase || !session || !snapshot?.currentTopic || !canJudgeCurrentTopic || settlingTopic) {
      return;
    }

    const eligibility = canSettleTopicByOrder(
      snapshot.topics.map((topic) => ({
        id: topic.id,
        order: topic.order,
        closeAt: topic.closeAt,
        status: topic.status,
      })),
      snapshot.currentTopic.id,
    );

    if (!eligibility.eligible) {
      setTopicStatus(
        `Settle topic #${eligibility.blockingTopicOrder ?? "?"} first. Earlier topics must be settled in order before this round can finalize.`,
      );
      return;
    }

    const winnerCount = selectedWinnerUserIds.length;
    const settlement = computeSettlement({
      carryoverAmount: snapshot.carryover,
      stakeAmount: snapshot.league.stakeAmount,
      playerCount: snapshot.league.playerCount,
      winnerCount,
    });

    setSettlingTopic(true);
    setTopicStatus(null);
    setError(null);

    const settlementInsert = await supabase
      .from("settlements")
      .insert({
        topic_id: snapshot.currentTopic.id,
        previous_pool_amount: snapshot.carryover,
        contribution_amount: settlement.contributionAmount,
        total_pool_amount: settlement.totalPoolAmount,
        winner_count: winnerCount,
        payout_per_winner: settlement.payoutPerWinner,
        next_pool_amount: settlement.nextCarryoverAmount,
        resolution_note: resolutionNote.trim() || null,
        settled_by: session.user.id,
      })
      .select("id")
      .single();

    if (settlementInsert.error) {
      setTopicStatus(settlementInsert.error.message);
      setSettlingTopic(false);
      return;
    }

    const settlementId = settlementInsert.data.id;

    if (selectedWinnerUserIds.length > 0) {
      const winnersInsert = await supabase.from("settlement_winners").insert(
        selectedWinnerUserIds.map((userId) => ({
          settlement_id: settlementId,
          user_id: userId,
        })),
      );

      if (winnersInsert.error) {
        await supabase.from("settlements").delete().eq("id", settlementId);
        setTopicStatus(winnersInsert.error.message);
        setSettlingTopic(false);
        return;
      }
    }

    const topicUpdate = await supabase
      .from("topics")
      .update({ status: "settled" })
      .eq("id", snapshot.currentTopic.id);

    if (topicUpdate.error) {
      await supabase.from("settlements").delete().eq("id", settlementId);
      setTopicStatus(topicUpdate.error.message);
      setSettlingTopic(false);
      return;
    }

    await loadLiveState(session);
    setTopicStatus(
      winnerCount > 0
        ? `Topic settled. ${winnerCount} winner${winnerCount === 1 ? "" : "s"} recorded.`
        : "Topic settled with no winners. Full pool carried forward.",
    );
    setSettlingTopic(false);
  }

  async function handleChangeLeagueRole(userId: string, role: "admin" | "player") {
    if (!supabase || !session || !snapshot || !snapshot.league.viewerIsAppAdmin) {
      return;
    }

    setChangingRoleUserId(userId);
    setRoleStatus(null);
    setError(null);

    const { error: updateError } = await supabase
      .from("league_members")
      .update({ role })
      .eq("league_id", snapshot.league.id)
      .eq("user_id", userId);

    if (updateError) {
      setRoleStatus(updateError.message);
      setChangingRoleUserId(null);
      return;
    }

    await loadLiveState(session);
    setRoleStatus(role === "admin" ? "User is now a league admin." : "User is now a player.");
    setChangingRoleUserId(null);
  }

  const usingLiveData = Boolean(session && snapshot);
  const displayLeague = snapshot
    ? {
        name: snapshot.league.name,
        stakePerTopic: snapshot.league.stakeAmount,
        currency: snapshot.league.currency,
        playerCount: snapshot.league.playerCount,
        viewerRole: snapshot.league.viewerRole,
        viewerIsAppAdmin: snapshot.league.viewerIsAppAdmin,
        topicCount: snapshot.league.topicCount,
      }
    : {
        name: fallbackLeague.name,
        stakePerTopic: fallbackLeague.stakePerTopic,
        currency: fallbackLeague.currency,
        playerCount: fallbackLeague.playerIds.length,
        viewerRole: null,
        viewerIsAppAdmin: false,
        topicCount: 0,
      };
  const displayTopic = snapshot?.currentTopic ?? fallbackTopic;
  const displayPool = snapshot
    ? {
        accumulatedPool: snapshot.carryover,
        topicContribution: snapshot.contribution,
        totalPool: snapshot.totalPool,
      }
    : fallbackPool;
  const displayPrediction = snapshot?.userPrediction ?? fallbackUserPrediction ?? null;
  const canSaveLive = Boolean(session && snapshot?.league.viewerRole && snapshot?.currentTopic?.status === "open");
  const isAdmin = snapshot?.league.viewerRole === "admin";
  const isMember = Boolean(snapshot?.league.viewerRole);
  const canJoinLeague = Boolean(session && snapshot && !snapshot.league.viewerRole);
  const isAppAdmin = Boolean(snapshot?.league.viewerIsAppAdmin);
  const canJudgeCurrentTopic = Boolean(snapshot?.currentTopic && canLeagueAdminDeclareWinners(snapshot.currentTopic.status));
  const liveTopics = snapshot?.topics ?? [];
  const currentTopicPredictions = snapshot?.topicPredictions ?? [];
  const currentTopicSettlement = snapshot?.currentTopicSettlement ?? null;
  const selectedWinnerCount = selectedWinnerUserIds.length;
  const settlementEligibility = snapshot?.currentTopic
    ? canSettleTopicByOrder(
        snapshot.topics.map((topic) => ({
          id: topic.id,
          order: topic.order,
          closeAt: topic.closeAt,
          status: topic.status,
        })),
        snapshot.currentTopic.id,
      )
    : { eligible: false };
  const settlementPreview = snapshot
    ? computeSettlement({
        carryoverAmount: snapshot.carryover,
        stakeAmount: snapshot.league.stakeAmount,
        playerCount: snapshot.league.playerCount,
        winnerCount: selectedWinnerCount,
      })
    : null;

  return (
    <div className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Current topic</p>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${usingLiveData ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
              {usingLiveData ? "Live from Supabase" : "Preview mode"}
            </span>
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{displayTopic.title}</h2>
          <p className="mt-2 max-w-2xl text-zinc-600">{displayTopic.description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusTone(displayTopic.status)}`}>
          {getTopicDisplayStatus(displayTopic.status)}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-sm text-zinc-500">League</p>
          <p className="mt-2 font-medium">{displayLeague.name}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {displayLeague.viewerIsAppAdmin
              ? `Access: app admin${displayLeague.viewerRole ? ` + league ${displayLeague.viewerRole}` : ""}`
              : displayLeague.viewerRole
                ? `Access: league ${displayLeague.viewerRole}`
                : "Access: viewer"}
          </p>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-sm text-zinc-500">Players</p>
          <p className="mt-2 font-medium">{displayLeague.playerCount}</p>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-sm text-zinc-500">Stake</p>
          <p className="mt-2 font-medium">{formatMoney(displayLeague.stakePerTopic, displayLeague.currency)}</p>
        </div>
        <div className="rounded-2xl bg-zinc-950 p-4 text-white">
          <p className="text-sm text-zinc-300">Total pool if settled now</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(displayPool.totalPool, displayLeague.currency)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-sm text-zinc-500">Close time</p>
          <p className="mt-2 font-medium">{formatDate(displayTopic.closeAt)}</p>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-sm text-zinc-500">Carryover before round</p>
          <p className="mt-2 font-medium">{formatMoney(displayPool.accumulatedPool, displayLeague.currency)}</p>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-sm text-zinc-500">New round contributions</p>
          <p className="mt-2 font-medium">{formatMoney(displayPool.topicContribution, displayLeague.currency)}</p>
        </div>
      </div>

      {currentTopicSettlement ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-950">
          <p className="font-medium uppercase tracking-[0.2em] text-sky-700">Saved settlement outcome</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-white p-3">Winners: {currentTopicSettlement.winnerCount}</div>
            <div className="rounded-xl bg-white p-3">Payout each: {formatMoney(currentTopicSettlement.payoutPerWinner, displayLeague.currency)}</div>
            <div className="rounded-xl bg-white p-3">Next carryover: {formatMoney(currentTopicSettlement.nextPoolAmount, displayLeague.currency)}</div>
            <div className="rounded-xl bg-white p-3">Settled: {formatDate(currentTopicSettlement.settledAt)}</div>
          </div>
          {currentTopicSettlement.winnerNames.length > 0 ? (
            <p className="mt-3">Winners: {currentTopicSettlement.winnerNames.join(", ")}</p>
          ) : (
            <p className="mt-3">No winners were selected for this topic. The pool rolled forward.</p>
          )}
          {currentTopicSettlement.resolutionNote ? (
            <p className="mt-2 text-sky-900/90">Note: {currentTopicSettlement.resolutionNote}</p>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
          Restoring live league data...
        </div>
      ) : session && !snapshot ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-700">
          <p>
            {error
              ? `Couldn’t load live data yet: ${error}`
              : "You’re signed in, but this account doesn’t see a league/topic in Supabase yet. The homepage is still falling back to preview data below."}
          </p>
          {!error ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleBootstrap}
                disabled={bootstrapping}
                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bootstrapping ? "Creating starter data..." : "Create starter league + topic"}
              </button>
              <p className="text-xs text-zinc-500">
                This will create your first league, make you admin, and open one starter topic so the real flow works.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {session && snapshot ? (
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-zinc-700">
          {isAdmin ? (
            <>
              <p className="font-medium text-zinc-900">Admin access</p>
              <p className="mt-1">You’re authorized to create/edit league settings, manage topics, and judge winners.</p>
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="font-medium text-zinc-900">Create topic</p>
                <p className="mt-1 text-sm text-zinc-600">New topics are appended to this league. If an open topic already exists, the new one is created as draft.</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {canJudgeCurrentTopic ? "The current topic is closed, so this is also the phase where league admins can declare winners." : "League admins can declare winners once a topic reaches the closed state."}
                </p>
                <div className="mt-4 grid gap-3">
                  <div>
                    <label className="text-sm font-medium text-zinc-700">Title</label>
                    <input
                      type="text"
                      value={topicTitle}
                      onChange={(event) => setTopicTitle(event.target.value)}
                      placeholder="2027 Oscars Best Picture"
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-zinc-700">Description</label>
                    <textarea
                      value={topicDescription}
                      onChange={(event) => setTopicDescription(event.target.value)}
                      placeholder="Which film will win Best Picture?"
                      className="mt-2 min-h-24 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-zinc-700">Close time</label>
                    <input
                      type="datetime-local"
                      value={topicCloseAt}
                      onChange={(event) => setTopicCloseAt(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCreateTopic}
                      disabled={creatingTopic}
                      className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingTopic ? "Creating topic..." : "Create topic"}
                    </button>
                    <p className="text-xs text-zinc-500">Current topics: {displayLeague.topicCount}</p>
                  </div>
                  {topicStatus ? <p className="text-sm text-zinc-700">{topicStatus}</p> : null}
                </div>
              </div>

              {canJudgeCurrentTopic && settlementPreview ? (
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="font-medium text-zinc-900">Settle current closed topic</p>
                  <p className="mt-1 text-sm text-zinc-600">Select the winning players below, add an optional note, then persist the settlement.</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-700">Selected winners</p>
                      <div className="mt-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                        {selectedWinnerCount}
                      </div>
                      <label className="mt-3 block text-sm font-medium text-zinc-700">Resolution note</label>
                      <textarea
                        value={resolutionNote}
                        onChange={(event) => setResolutionNote(event.target.value)}
                        placeholder="Optional note about the result or tie-break"
                        className="mt-2 min-h-24 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSettleCurrentTopic}
                        disabled={settlingTopic || !settlementEligibility.eligible}
                        className="mt-3 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {settlingTopic ? "Settling topic..." : "Settle topic"}
                      </button>
                      {!settlementEligibility.eligible ? (
                        <p className="mt-2 text-xs text-amber-700">
                          Topic #{settlementEligibility.blockingTopicOrder ?? "?"} must be settled first because pool carryover follows topic order.
                        </p>
                      ) : null}
                    </div>
                    <div className="grid gap-2 text-sm text-zinc-700">
                      <div className="rounded-xl bg-white p-3">Contribution: {formatMoney(settlementPreview.contributionAmount, displayLeague.currency)}</div>
                      <div className="rounded-xl bg-white p-3">Total pool: {formatMoney(settlementPreview.totalPoolAmount, displayLeague.currency)}</div>
                      <div className="rounded-xl bg-white p-3">Payout per winner: {formatMoney(settlementPreview.payoutPerWinner, displayLeague.currency)}</div>
                      <div className="rounded-xl bg-white p-3">Next carryover: {formatMoney(settlementPreview.nextCarryoverAmount, displayLeague.currency)}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : isMember ? (
            <>
              <p className="font-medium text-zinc-900">Player access</p>
              <p className="mt-1">You’re participating in this league. You can edit only your own prediction before the topic closes.</p>
            </>
          ) : (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-zinc-900">Not participating yet</p>
                <p className="mt-1">Join this league to submit your own prediction. League/topic editing and winner judging stay admin-only.</p>
              </div>
              <button
                type="button"
                onClick={handleJoinLeague}
                disabled={joining}
                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {joining ? "Joining..." : "Participate / Join league"}
              </button>
            </div>
          )}

          {isAppAdmin ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-medium text-zinc-900">App admin: league role management</p>
              <p className="mt-1 text-sm text-zinc-600">Global admins can promote/demote league admins here. League admins still manage the league itself.</p>
              <div className="mt-4 space-y-3">
                {snapshot.members.map((member) => (
                  <div key={member.userId} className="flex flex-col gap-3 rounded-xl bg-white p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">
                        {member.displayName}
                        {member.isCurrentUser ? " (you)" : ""}
                      </p>
                      <p className="text-sm text-zinc-500">Current league role: {member.role === "admin" ? "league admin" : "player"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleChangeLeagueRole(member.userId, "admin")}
                        disabled={changingRoleUserId === member.userId || member.role === "admin"}
                        className="rounded-full border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Make league admin
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeLeagueRole(member.userId, "player")}
                        disabled={changingRoleUserId === member.userId || member.role === "player"}
                        className="rounded-full border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Make player
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {roleStatus ? <p className="mt-3 text-sm text-zinc-700">{roleStatus}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {liveTopics.length > 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">League topic queue</p>
              <p className="mt-1 text-sm text-zinc-600">Topic order drives carryover. Multiple topics may be open at the same time.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {liveTopics.map((topic) => {
              const normalizedStatus = getTopicDisplayStatus(topic.status);
              return (
                <div key={topic.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white">#{topic.order}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(topic.status)}`}>{normalizedStatus}</span>
                      </div>
                      <p className="mt-2 font-medium text-zinc-900">{topic.title}</p>
                      <p className="mt-1 text-sm text-zinc-600">{topic.description}</p>
                      <p className="mt-2 text-xs text-zinc-500">Closes {formatDate(topic.closeAt)}</p>
                      {topic.settlement ? (
                        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
                          <p>
                            Settled {formatDate(topic.settlement.settledAt)} • {topic.settlement.winnerCount} winner{topic.settlement.winnerCount === 1 ? "" : "s"} • next carryover {formatMoney(topic.settlement.nextPoolAmount, displayLeague.currency)}
                          </p>
                          <p className="mt-1">Payout each: {formatMoney(topic.settlement.payoutPerWinner, displayLeague.currency)}</p>
                          {topic.settlement.winnerNames.length > 0 ? <p className="mt-1">Winners: {topic.settlement.winnerNames.join(", ")}</p> : null}
                          {topic.settlement.resolutionNote ? <p className="mt-1">Note: {topic.settlement.resolutionNote}</p> : null}
                        </div>
                      ) : null}
                    </div>
                    {isAdmin ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleChangeTopicStatus(topic.id, "open")}
                          disabled={changingTopicId === topic.id || !canLeagueAdminOpenTopic(topic.status)}
                          className="rounded-full border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeTopicStatus(topic.id, "closed")}
                          disabled={changingTopicId === topic.id || !canLeagueAdminCloseTopic(topic.status)}
                          className="rounded-full border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Close
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Your prediction</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-lg font-semibold text-zinc-900">
              {displayPrediction?.text || (usingLiveData ? "No prediction submitted yet" : "No prediction submitted yet")}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              {displayPrediction?.updatedAt
                ? `Last updated ${formatDate(displayPrediction.updatedAt)}`
                : canSaveLive
                  ? "You can submit or edit until the close time."
                  : canJoinLeague
                    ? "Join the league first, then you can submit your prediction."
                  : session
                    ? "Prediction saving unlocks when there’s an open topic in live data."
                    : "Sign in to switch this section from preview data to live data."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSaveLive || saving}
            className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : canSaveLive
                ? (displayPrediction ? "Update prediction" : "Submit prediction")
                : canJoinLeague
                  ? "Join league to play"
                  : "Predictions locked"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="text-sm font-medium text-zinc-700">Prediction text</label>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!canSaveLive || saving}
              placeholder={canSaveLive ? "Type your prediction here" : canJoinLeague ? "Join the league to enter a prediction" : "Sign in and open a live topic to edit"}
              className="mt-2 min-h-28 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100"
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSaveLive || saving}
            className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : canSaveLive ? "Save to Supabase" : usingLiveData ? "Member action required" : "Preview only"}
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-700">
          {saveStatus
            ? saveStatus
            : usingLiveData
              ? "This box is wired to the real current topic and your real prediction row."
              : "This area is showing preview data until you’re signed in and live league data exists."}
        </div>

        {currentTopicPredictions.length > 0 ? (
          <div className="mt-4 rounded-2xl bg-white p-4">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Visible predictions</p>
            <div className="mt-3 space-y-3">
              {currentTopicPredictions.map((prediction) => {
                const isSelectedWinner = selectedWinnerUserIds.includes(prediction.userId);
                return (
                  <div key={prediction.id} className="rounded-xl border border-zinc-200 p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium text-zinc-900">{prediction.displayName}</p>
                        <p className="mt-1 text-sm text-zinc-700">{prediction.predictionText}</p>
                        <p className="mt-1 text-xs text-zinc-500">Updated {formatDate(prediction.updatedAt)}</p>
                      </div>
                      {canJudgeCurrentTopic ? (
                        <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                          <input
                            type="checkbox"
                            checked={isSelectedWinner}
                            onChange={() => toggleWinnerSelection(prediction.userId)}
                            disabled={settlingTopic}
                          />
                          Winner
                        </label>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
