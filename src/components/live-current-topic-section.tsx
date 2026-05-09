"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
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
    topicCount: number;
  };
  currentTopic: {
    id: string;
    title: string;
    description: string;
    status: Topic["status"];
    closeAt: string;
  } | null;
  userPrediction: {
    id: string;
    text: string;
    updatedAt: string;
  } | null;
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
  switch (status) {
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

    const [membersResult, membershipResult, topicsResult, settlementResult] = await Promise.all([
      supabase
        .from("league_members")
        .select("id")
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

    const liveTopic =
      topicsResult.data?.find((topic) => topic.status === "open") ??
      topicsResult.data?.find((topic) => topic.status === "closed") ??
      null;

    let livePrediction: LiveSnapshot["userPrediction"] = null;

    const viewerRole = membershipResult.data?.is_active ? membershipResult.data.role : null;

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
      userPrediction: livePrediction,
      carryover,
      contribution,
      totalPool: carryover + contribution,
    };

    setSnapshot(nextSnapshot);
    setDraft(livePrediction?.text ?? "");
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
    const nextStatus = snapshot.currentTopic?.status === "open" ? "upcoming" : "open";

    const { error: createError } = await supabase.from("topics").insert({
      league_id: snapshot.league.id,
      order_index: nextOrder,
      title: nextTitle,
      description: nextDescription || null,
      status: nextStatus,
      open_at: nextStatus === "open" ? new Date().toISOString() : null,
      close_at: new Date(topicCloseAt).toISOString(),
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
    setTopicStatus(nextStatus === "open" ? "Topic created and opened." : "Topic created as upcoming because there is already an active open topic.");
    await loadLiveState(session);
    setCreatingTopic(false);
  }

  const usingLiveData = Boolean(session && snapshot);
  const displayLeague = snapshot
    ? {
        name: snapshot.league.name,
        stakePerTopic: snapshot.league.stakeAmount,
        currency: snapshot.league.currency,
        playerCount: snapshot.league.playerCount,
        viewerRole: snapshot.league.viewerRole,
        topicCount: snapshot.league.topicCount,
      }
    : {
        name: fallbackLeague.name,
        stakePerTopic: fallbackLeague.stakePerTopic,
        currency: fallbackLeague.currency,
        playerCount: fallbackLeague.playerIds.length,
        viewerRole: null,
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

  return (
    <div className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Current topic</p>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${usingLiveData ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
              {usingLiveData ? "Live from Supabase" : "Mock preview"}
            </span>
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{displayTopic.title}</h2>
          <p className="mt-2 max-w-2xl text-zinc-600">{displayTopic.description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusTone(displayTopic.status)}`}>
          {displayTopic.status}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-sm text-zinc-500">League</p>
          <p className="mt-2 font-medium">{displayLeague.name}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {displayLeague.viewerRole ? `Access: ${displayLeague.viewerRole}` : "Access: viewer"}
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

      {loading ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
          Restoring live league data...
        </div>
      ) : session && !snapshot ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-700">
          <p>
            {error
              ? `Couldn’t load live data yet: ${error}`
              : "You’re signed in, but this account doesn’t see a league/topic in Supabase yet. The homepage is still falling back to the mock preview below."}
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
                <p className="mt-1 text-sm text-zinc-600">New topics are appended to this league. If an open topic already exists, the new one is created as upcoming.</p>
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
                    : "Sign in to switch this section from mock preview to live data."}
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
            {saving ? "Saving..." : canSaveLive ? "Save to Supabase" : usingLiveData ? "Member action required" : "Save draft mock"}
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-700">
          {saveStatus
            ? saveStatus
            : usingLiveData
              ? "This box is now wired for the real current topic + your real prediction row. The rest of the page is still partly mock for now."
              : "This area is still showing mock content until you’re signed in and live league data exists."}
        </div>
      </div>
    </div>
  );
}
