"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let isMounted = true;

    async function loadLiveState(activeSession: Session | null) {
      if (!isMounted) {
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

      const leagueResult = await client
        .from("leagues")
        .select("id, name, stake_amount, currency")
        .limit(1)
        .maybeSingle();

      if (leagueResult.error) {
        if (!isMounted) {
          return;
        }
        setError(leagueResult.error.message);
        setSnapshot(null);
        setLoading(false);
        return;
      }

      if (!leagueResult.data) {
        if (!isMounted) {
          return;
        }
        setSnapshot(null);
        setDraft("");
        setLoading(false);
        return;
      }

      const league = leagueResult.data;

      const [membersResult, topicsResult, settlementResult] = await Promise.all([
        client
          .from("league_members")
          .select("id")
          .eq("league_id", league.id)
          .eq("is_active", true),
        client
          .from("topics")
          .select("id, title, description, status, close_at, order_index")
          .eq("league_id", league.id)
          .order("order_index", { ascending: true }),
        client
          .from("settlements")
          .select("next_pool_amount, settled_at")
          .order("settled_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const firstError = membersResult.error ?? topicsResult.error ?? settlementResult.error;
      if (firstError) {
        if (!isMounted) {
          return;
        }
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

      if (liveTopic) {
        const predictionResult = await client
          .from("predictions")
          .select("id, prediction_text, updated_at")
          .eq("topic_id", liveTopic.id)
          .eq("user_id", activeSession.user.id)
          .maybeSingle();

        if (predictionResult.error) {
          if (!isMounted) {
            return;
          }
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

      if (!isMounted) {
        return;
      }

      setSnapshot(nextSnapshot);
      setDraft(livePrediction?.text ?? "");
      setLoading(false);
    }

    client.auth.getSession().then(({ data }) => {
      void loadLiveState(data.session ?? null);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      void loadLiveState(nextSession ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fallbackUserPrediction?.text, supabase]);

  async function handleSave() {
    if (!supabase || !session || !snapshot?.currentTopic || snapshot.currentTopic.status !== "open") {
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

  const usingLiveData = Boolean(session && snapshot);
  const displayLeague = snapshot
    ? {
        name: snapshot.league.name,
        stakePerTopic: snapshot.league.stakeAmount,
        currency: snapshot.league.currency,
        playerCount: snapshot.league.playerCount,
      }
    : {
        name: fallbackLeague.name,
        stakePerTopic: fallbackLeague.stakePerTopic,
        currency: fallbackLeague.currency,
        playerCount: fallbackLeague.playerIds.length,
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
  const canSaveLive = Boolean(session && snapshot?.currentTopic?.status === "open");

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
          {error
            ? `Couldn’t load live data yet: ${error}`
            : "You’re signed in, but this account doesn’t see a league/topic in Supabase yet. The homepage is still falling back to the mock preview below."}
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
            {saving ? "Saving..." : canSaveLive ? (displayPrediction ? "Update prediction" : "Submit prediction") : "Predictions locked"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="text-sm font-medium text-zinc-700">Prediction text</label>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!canSaveLive || saving}
              placeholder={canSaveLive ? "Type your prediction here" : "Sign in and open a live topic to edit"}
              className="mt-2 min-h-28 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100"
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSaveLive || saving}
            className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : usingLiveData ? "Save to Supabase" : "Save draft mock"}
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
