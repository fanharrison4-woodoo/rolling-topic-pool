"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  canLeagueAdminCloseTopic,
  canLeagueAdminDeclareWinners,
  canLeagueAdminEditTopic,
  canLeagueAdminOpenTopic,
  canSettleTopicByOrder,
  getFeaturedTopicId,
  getNextTopicStatusOnCreate,
  getTopicDisplayStatus,
  validateTopicCloseTimesByOrder,
} from "@/lib/topic-rules";
import { computeSettlement } from "@/lib/settlement-rules";
import type { Topic } from "@/lib/types";

interface SettingsSnapshot {
  league: {
    id: string;
    name: string;
    stakeAmount: number;
    currency: string;
    playerCount: number;
    viewerRole: "admin" | "player" | null;
    topicCount: number;
    membershipOpen: boolean;
  };
  featuredTopicId: string | null;
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
  topicPredictions: {
    id: string;
    userId: string;
    predictionText: string;
    updatedAt: string;
    displayName: string;
  }[];
  members: {
    userId: string;
    displayName: string;
    role: "admin" | "player";
    isCurrentUser: boolean;
  }[];
  carryover: number;
  contribution: number;
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

interface LiveCircleSettingsProps {
  circleId: string;
}

export function LiveCircleSettings({ circleId }: LiveCircleSettingsProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);

  // Topic create state
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [topicCloseAt, setTopicCloseAt] = useState("");
  const [topicStatus, setTopicStatus] = useState<string | null>(null);
  const [creatingTopic, setCreatingTopic] = useState(false);

  // Topic edit state
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCloseAt, setEditCloseAt] = useState("");
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Topic status change
  const [changingTopicId, setChangingTopicId] = useState<string | null>(null);

  // Settlement state
  const [selectedWinnerUserIds, setSelectedWinnerUserIds] = useState<string[]>([]);
  const [resolutionNote, setResolutionNote] = useState("");
  const [settlingTopic, setSettlingTopic] = useState(false);
  const prevFeaturedTopicIdRef = useRef<string | null | undefined>(undefined);

  // Membership toggle
  const [togglingMembership, setTogglingMembership] = useState(false);
  const [membershipMsg, setMembershipMsg] = useState<string | null>(null);

  // Member role change
  const [changingMemberUserId, setChangingMemberUserId] = useState<string | null>(null);
  const [memberRoleMsg, setMemberRoleMsg] = useState<string | null>(null);

  const loadState = useCallback(async (activeSession: Session | null) => {
    if (!supabase) return;

    setSession(activeSession);

    if (!activeSession) {
      setSnapshot(null);
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

    if (leagueResult.error || !leagueResult.data) {
      setError(leagueResult.error?.message ?? "Circle not found.");
      setSnapshot(null);
      setLoading(false);
      return;
    }

    const league = leagueResult.data;

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

    const membershipOpen =
      (membershipOpenResult.data as unknown as { membership_open?: boolean } | null)?.membership_open ?? true;

    const firstError = membersResult.error ?? membershipResult.error ?? topicsResult.error;
    if (firstError) {
      setError(firstError.message);
      setSnapshot(null);
      setLoading(false);
      return;
    }

    const viewerRole = membershipResult.data?.is_active ? membershipResult.data.role : null;

    if (viewerRole !== "admin") {
      setError("You do not have permission to manage this circle.");
      setSnapshot(null);
      setLoading(false);
      return;
    }

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

    const topicIds = (topicsResult.data ?? []).map((t) => t.id);
    let settlementByTopicId = new Map<string, NonNullable<SettingsSnapshot["topics"][number]["settlement"]>>();
    let latestSettlementCarryover = 0;

    if (topicIds.length > 0) {
      const settlementsResult = await supabase
        .from("settlements")
        .select("id, topic_id, winner_count, payout_per_winner, next_pool_amount, resolution_note, settled_at")
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
          const current = winnerNamesBySettlementId.get(row.settlement_id) ?? [];
          current.push(memberProfiles.get(row.user_id) ?? row.user_id);
          winnerNamesBySettlementId.set(row.settlement_id, current);
        }
      }

      settlementByTopicId = new Map(
        settlementRows.map((r) => [
          r.topic_id,
          {
            settledAt: r.settled_at,
            winnerCount: r.winner_count,
            payoutPerWinner: Number(r.payout_per_winner ?? 0),
            nextPoolAmount: Number(r.next_pool_amount ?? 0),
            resolutionNote: r.resolution_note,
            winnerNames: winnerNamesBySettlementId.get(r.id) ?? [],
          },
        ]),
      );
    }

    const featuredTopicId = getFeaturedTopicId(
      (topicsResult.data ?? []).map((t) => ({
        id: t.id,
        order: t.order_index,
        closeAt: t.close_at,
        status: t.status,
      })),
    );

    const featuredTopic = topicsResult.data?.find((t) => t.id === featuredTopicId) ?? null;
    let topicPredictions: SettingsSnapshot["topicPredictions"] = [];

    if (featuredTopic && (featuredTopic.status === "closed" || featuredTopic.status === "settled")) {
      const predsResult = await supabase
        .from("predictions")
        .select("id, user_id, prediction_text, updated_at")
        .eq("topic_id", featuredTopic.id)
        .order("updated_at", { ascending: true });

      if (predsResult.error) {
        setError(predsResult.error.message);
        setSnapshot(null);
        setLoading(false);
        return;
      }

      topicPredictions = (predsResult.data ?? []).map((p) => ({
        id: p.id,
        userId: p.user_id,
        predictionText: p.prediction_text,
        updatedAt: p.updated_at,
        displayName: memberProfiles.get(p.user_id) ?? p.user_id,
      }));
    }

    const playerCount = membersResult.data?.length ?? 0;
    const stakeAmount = Number(league.stake_amount ?? 0);

    setSnapshot({
      league: {
        id: league.id,
        name: league.name,
        stakeAmount,
        currency: league.currency,
        playerCount,
        viewerRole,
        topicCount: topicsResult.data?.length ?? 0,
        membershipOpen,
      },
      featuredTopicId,
      topics: (topicsResult.data ?? []).map((t) => ({
        id: t.id,
        order: t.order_index,
        title: t.title,
        description: t.description ?? "",
        status: t.status,
        closeAt: t.close_at,
        settlement: settlementByTopicId.get(t.id) ?? null,
      })),
      topicPredictions,
      members: (membersResult.data ?? []).map((m) => ({
        userId: m.user_id,
        displayName: memberProfiles.get(m.user_id) ?? m.user_id,
        role: m.role,
        isCurrentUser: m.user_id === activeSession.user.id,
      })),
      carryover: latestSettlementCarryover,
      contribution: stakeAmount * playerCount,
    });

    if (prevFeaturedTopicIdRef.current !== featuredTopicId) {
      prevFeaturedTopicIdRef.current = featuredTopicId;
      setSelectedWinnerUserIds([]);
      setResolutionNote("");
    }
    setLoading(false);
  }, [circleId, supabase]);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      void loadState(data.session ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      void loadState(nextSession ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadState, supabase]);

  async function handleCreateTopic() {
    if (!supabase || !session || !snapshot || snapshot.league.viewerRole !== "admin") return;

    const nextTitle = topicTitle.trim();
    const nextDescription = topicDescription.trim();

    if (!nextTitle) { setTopicStatus("Topic title is required."); return; }
    if (!topicCloseAt) { setTopicStatus("Close time is required."); return; }

    setCreatingTopic(true);
    setTopicStatus(null);

    const nextOrder = snapshot.league.topicCount + 1;
    const nextCloseAtIso = new Date(topicCloseAt).toISOString();
    const nextStatus = getNextTopicStatusOnCreate(
      snapshot.topics.some((t) => getTopicDisplayStatus(t.status) === "open"),
    );
    const orderingResult = validateTopicCloseTimesByOrder([
      ...snapshot.topics.map((t) => ({ order: t.order, closeAt: t.closeAt })),
      { order: nextOrder, closeAt: nextCloseAtIso },
    ]);

    if (!orderingResult.valid) {
      setTopicStatus("Close time conflicts with topic order — later topics cannot close earlier than previous ones.");
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
    const createMsg = nextStatus === "open" ? "Topic created and opened." : "Topic created as draft (an open topic already exists).";
    await loadState(session);
    setTopicStatus(createMsg);
    setCreatingTopic(false);
  }

  async function handleChangeTopicStatus(topicId: string, nextStatus: "open" | "closed") {
    if (!supabase || !session || !snapshot || snapshot.league.viewerRole !== "admin") return;

    setChangingTopicId(topicId);
    setTopicStatus(null);

    const updates: { status: "open" | "closed"; open_at?: string } = { status: nextStatus };
    if (nextStatus === "open") updates.open_at = new Date().toISOString();

    const { error: updateError } = await supabase.from("topics").update(updates).eq("id", topicId);

    if (updateError) {
      setTopicStatus(updateError.message);
      setChangingTopicId(null);
      return;
    }

    const changeMsg = nextStatus === "open" ? "Topic opened." : "Topic closed. Predictions are now viewable and ready for judging.";
    await loadState(session);
    setTopicStatus(changeMsg);
    setChangingTopicId(null);
  }

  function startEditingTopic(topic: { id: string; title: string; description: string; closeAt: string }) {
    setEditingTopicId(topic.id);
    setEditTitle(topic.title);
    setEditDescription(topic.description);
    const localCloseAt = new Date(topic.closeAt)
      .toLocaleString("sv-SE", { hour12: false })
      .replace(" ", "T")
      .slice(0, 16);
    setEditCloseAt(localCloseAt);
    setEditStatus(null);
  }

  async function handleSaveTopicEdit(topicId: string) {
    if (!supabase || !session || !snapshot) return;

    const nextTitle = editTitle.trim();
    if (!nextTitle) { setEditStatus("Title is required."); return; }
    if (!editCloseAt) { setEditStatus("Close time is required."); return; }

    const nextCloseAtIso = new Date(editCloseAt).toISOString();
    const otherTopics = snapshot.topics.filter((t) => t.id !== topicId);
    const thisOrder = snapshot.topics.find((t) => t.id === topicId)!.order;
    const orderingResult = validateTopicCloseTimesByOrder([
      ...otherTopics.map((t) => ({ order: t.order, closeAt: t.closeAt })),
      { order: thisOrder, closeAt: nextCloseAtIso },
    ]);

    if (!orderingResult.valid) {
      setEditStatus("Close time conflicts with topic order.");
      return;
    }

    setSavingEdit(true);
    setEditStatus(null);

    const { error: updateError } = await supabase.from("topics").update({
      title: nextTitle,
      description: editDescription.trim() || null,
      close_at: nextCloseAtIso,
      updated_at: new Date().toISOString(),
    }).eq("id", topicId);

    if (updateError) {
      setEditStatus(updateError.message);
      setSavingEdit(false);
      return;
    }

    await loadState(session);
    setEditingTopicId(null);
    setEditStatus(null);
    setSavingEdit(false);
  }

  function toggleWinnerSelection(userId: string) {
    setSelectedWinnerUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  async function handleSettleTopic() {
    if (!supabase || !session || !snapshot?.featuredTopicId) return;

    const featuredTopic = snapshot.topics.find((t) => t.id === snapshot.featuredTopicId);
    if (!featuredTopic || !canLeagueAdminDeclareWinners(featuredTopic.status)) return;

    const eligibility = canSettleTopicByOrder(
      snapshot.topics.map((t) => ({ id: t.id, order: t.order, closeAt: t.closeAt, status: t.status })),
      featuredTopic.id,
    );

    if (!eligibility.eligible) {
      setTopicStatus(`Settle topic #${eligibility.blockingTopicOrder ?? "?"} first.`);
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

    const settlementInsert = await supabase
      .from("settlements")
      .insert({
        topic_id: featuredTopic.id,
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
        selectedWinnerUserIds.map((userId) => ({ settlement_id: settlementId, user_id: userId })),
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
      .eq("id", featuredTopic.id);

    if (topicUpdate.error) {
      await supabase.from("settlements").delete().eq("id", settlementId);
      setTopicStatus(topicUpdate.error.message);
      setSettlingTopic(false);
      return;
    }

    await loadState(session);
    setTopicStatus(
      winnerCount > 0
        ? `Settled with ${winnerCount} winner${winnerCount === 1 ? "" : "s"}.`
        : "Settled with no winners. Full pool carried forward.",
    );
    setSettlingTopic(false);
  }

  async function handleToggleMembership() {
    if (!supabase || !session || !snapshot) return;

    setTogglingMembership(true);
    setMembershipMsg(null);

    const nextValue = !snapshot.league.membershipOpen;
    const { error: updateError } = await supabase
      .from("leagues")
      .update({ membership_open: nextValue })
      .eq("id", snapshot.league.id);

    if (updateError) {
      setMembershipMsg(updateError.message);
      setTogglingMembership(false);
      return;
    }

    await loadState(session);
    setMembershipMsg(nextValue ? "Membership opened." : "Membership closed.");
    setTogglingMembership(false);
  }

  async function handleChangeMemberRole(userId: string, nextRole: "admin" | "player") {
    if (!supabase || !session || !snapshot) return;

    setChangingMemberUserId(userId);
    setMemberRoleMsg(null);

    const { error: updateError } = await supabase
      .from("league_members")
      .update({ role: nextRole })
      .eq("league_id", snapshot.league.id)
      .eq("user_id", userId);

    if (updateError) {
      setMemberRoleMsg(updateError.message);
      setChangingMemberUserId(null);
      return;
    }

    await loadState(session);
    setMemberRoleMsg(nextRole === "admin" ? "Promoted to admin." : "Changed to player.");
    setChangingMemberUserId(null);
  }

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
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-lg font-semibold text-zinc-900">Sign in to manage this circle</p>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-rose-600">
        {error ?? "Circle not found."}
      </div>
    );
  }

  const currency = snapshot.league.currency;
  const featuredTopic = snapshot.topics.find((t) => t.id === snapshot.featuredTopicId) ?? null;
  const canJudge = featuredTopic ? canLeagueAdminDeclareWinners(featuredTopic.status) : false;
  const settlementEligibility = featuredTopic
    ? canSettleTopicByOrder(
        snapshot.topics.map((t) => ({ id: t.id, order: t.order, closeAt: t.closeAt, status: t.status })),
        featuredTopic.id,
      )
    : { eligible: false };
  const settlementPreview = canJudge
    ? computeSettlement({
        carryoverAmount: snapshot.carryover,
        stakeAmount: snapshot.league.stakeAmount,
        playerCount: snapshot.league.playerCount,
        winnerCount: selectedWinnerUserIds.length,
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Membership toggle */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-zinc-900">Membership</p>
            <p className="mt-1 text-sm text-zinc-600">
              {snapshot.league.membershipOpen
                ? "Open — new players can join this circle."
                : "Closed — no new players are being accepted."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleMembership}
            disabled={togglingMembership}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              snapshot.league.membershipOpen
                ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            }`}
          >
            {togglingMembership
              ? "Saving…"
              : snapshot.league.membershipOpen
              ? "Close membership"
              : "Open membership"}
          </button>
        </div>
        {membershipMsg ? <p className="mt-3 text-sm text-zinc-600">{membershipMsg}</p> : null}
      </div>

      {/* Settle closed topic */}
      {canJudge && featuredTopic && settlementPreview ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-medium text-amber-900">Settle: {featuredTopic.title}</p>
          <p className="mt-1 text-sm text-amber-800">Select winners, then confirm settlement.</p>

          {snapshot.topicPredictions.length > 0 ? (
            <div className="mt-4 space-y-2">
              {snapshot.topicPredictions.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedWinnerUserIds.includes(p.userId)}
                    onChange={() => toggleWinnerSelection(p.userId)}
                    disabled={settlingTopic}
                    className="mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="font-medium text-zinc-900">{p.displayName}</p>
                    <p className="mt-0.5 text-zinc-600">{p.predictionText}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">{formatDate(p.updatedAt)}</p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-800">No predictions submitted.</p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 text-sm text-zinc-700">
              <div className="rounded-xl bg-white p-3">Contribution: {formatMoney(settlementPreview.contributionAmount, currency)}</div>
              <div className="rounded-xl bg-white p-3">Total pool: {formatMoney(settlementPreview.totalPoolAmount, currency)}</div>
              <div className="rounded-xl bg-white p-3">Per winner: {formatMoney(settlementPreview.payoutPerWinner, currency)}</div>
              <div className="rounded-xl bg-white p-3">Next carryover: {formatMoney(settlementPreview.nextCarryoverAmount, currency)}</div>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-zinc-700">{selectedWinnerUserIds.length} winner{selectedWinnerUserIds.length === 1 ? "" : "s"} selected</p>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Optional resolution note"
                className="min-h-20 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={handleSettleTopic}
                disabled={settlingTopic || !settlementEligibility.eligible}
                className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {settlingTopic ? "Settling…" : "Confirm settlement"}
              </button>
              {!settlementEligibility.eligible && (
                <p className="text-xs text-amber-700">
                  Topic #{(settlementEligibility as { blockingTopicOrder?: number }).blockingTopicOrder ?? "?"} must be settled first.
                </p>
              )}
            </div>
          </div>
          {topicStatus && <p className="mt-3 text-sm text-zinc-700">{topicStatus}</p>}
        </div>
      ) : null}

      {/* Create topic */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Create topic</p>
        <p className="mt-1 text-sm text-zinc-600">
          Topics: {snapshot.league.topicCount}. New topics are created as drafts when an open topic exists.
        </p>
        <div className="mt-4 space-y-3">
          <input
            type="text"
            value={topicTitle}
            onChange={(e) => setTopicTitle(e.target.value)}
            placeholder="Topic title"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none"
          />
          <textarea
            value={topicDescription}
            onChange={(e) => setTopicDescription(e.target.value)}
            placeholder="Description / question (optional)"
            className="min-h-20 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none"
          />
          <input
            type="datetime-local"
            value={topicCloseAt}
            onChange={(e) => setTopicCloseAt(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateTopic}
              disabled={creatingTopic}
              className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {creatingTopic ? "Creating…" : "Create topic"}
            </button>
            {topicStatus && <p className="text-sm text-zinc-600">{topicStatus}</p>}
          </div>
        </div>
      </div>

      {/* Topic list with edit/open/close */}
      {snapshot.topics.length > 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">All topics</p>
          <div className="mt-4 space-y-3">
            {snapshot.topics.map((topic) => (
              <div key={topic.id} className="rounded-xl border border-zinc-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-xs font-medium text-white">#{topic.order}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(topic.status)}`}>
                        {getTopicDisplayStatus(topic.status)}
                      </span>
                      {topic.id === snapshot.featuredTopicId && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">current</span>
                      )}
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
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {canLeagueAdminEditTopic(topic.status) && (
                      <button
                        type="button"
                        onClick={() =>
                          editingTopicId === topic.id
                            ? (setEditingTopicId(null), setEditStatus(null))
                            : startEditingTopic(topic)
                        }
                        disabled={changingTopicId === topic.id}
                        className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-50"
                      >
                        {editingTopicId === topic.id ? "Cancel" : "Edit"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleChangeTopicStatus(topic.id, "open")}
                      disabled={changingTopicId === topic.id || !canLeagueAdminOpenTopic(topic.status)}
                      className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-50"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeTopicStatus(topic.id, "closed")}
                      disabled={changingTopicId === topic.id || !canLeagueAdminCloseTopic(topic.status)}
                      className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-50"
                    >
                      Close
                    </button>
                  </div>
                </div>

                {editingTopicId === topic.id ? (
                  <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description"
                      className="min-h-16 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none"
                    />
                    <input
                      type="datetime-local"
                      value={editCloseAt}
                      onChange={(e) => setEditCloseAt(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveTopicEdit(topic.id)}
                        disabled={savingEdit}
                        className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        {savingEdit ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingTopicId(null); setEditStatus(null); }}
                        className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-900"
                      >
                        Cancel
                      </button>
                    </div>
                    {editStatus && <p className="text-xs text-rose-600">{editStatus}</p>}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Members */}
      {snapshot.members.length > 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Members ({snapshot.members.length})</p>
          {memberRoleMsg && <p className="mt-2 text-sm text-zinc-600">{memberRoleMsg}</p>}
          <div className="mt-4 space-y-2">
            {snapshot.members.map((member) => (
              <div key={member.userId} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-4 py-3">
                <p className="text-sm font-medium text-zinc-900">
                  {member.displayName}
                  {member.isCurrentUser ? <span className="ml-2 text-xs text-zinc-400">(you)</span> : null}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${member.role === "admin" ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                    {member.role}
                  </span>
                  {snapshot.league.viewerRole === "admin" && !member.isCurrentUser && (
                    <button
                      type="button"
                      onClick={() => handleChangeMemberRole(member.userId, member.role === "admin" ? "player" : "admin")}
                      disabled={changingMemberUserId === member.userId}
                      className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 disabled:opacity-40"
                    >
                      {changingMemberUserId === member.userId
                        ? "…"
                        : member.role === "admin"
                          ? "Make player"
                          : "Make admin"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Back link */}
      <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-sm">
        <Link href={`/circles/${circleId}`} className="font-medium text-zinc-700 hover:text-zinc-950">
          ← Back to circle
        </Link>
      </div>
    </div>
  );
}
