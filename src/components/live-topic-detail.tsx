"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { canPlayersViewAllPredictions, getTopicDisplayStatus } from "@/lib/topic-rules";
import type { Topic } from "@/lib/types";

interface LiveTopicDetailProps {
  topicId: string;
  fallbackCurrency: string;
  fallbackTopic: {
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
    predictions: {
      id: string;
      displayName: string;
      text: string;
      updatedAt: string;
      isWinner: boolean;
    }[];
  } | null;
}

interface TopicDetailState {
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
  predictions: {
    id: string;
    displayName: string;
    text: string;
    updatedAt: string;
    isWinner: boolean;
  }[];
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

export function LiveTopicDetail({ topicId, fallbackCurrency, fallbackTopic }: LiveTopicDetailProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [topic, setTopic] = useState<TopicDetailState | null>(fallbackTopic);
  const [currency, setCurrency] = useState(fallbackCurrency);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [usingLiveData, setUsingLiveData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (activeSession: Session | null) => {
    if (!supabase) {
      return;
    }

    if (!activeSession) {
      setTopic(fallbackTopic);
      setCurrency(fallbackCurrency);
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const leagueResult = await supabase.from("leagues").select("id, currency").limit(1).maybeSingle();
    const topicResult = await supabase
      .from("topics")
      .select("id, order_index, title, description, status, close_at")
      .eq("id", topicId)
      .maybeSingle();

    const firstError = leagueResult.error ?? topicResult.error;
    if (firstError || !topicResult.data || !leagueResult.data) {
      setError(firstError?.message ?? "Topic not found");
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    const [membershipResult, settlementResult] = await Promise.all([
      supabase.from("league_members").select("user_id, is_active").eq("league_id", leagueResult.data.id).eq("is_active", true),
      supabase
        .from("settlements")
        .select("id, winner_count, payout_per_winner, next_pool_amount, resolution_note, settled_at")
        .eq("topic_id", topicId)
        .maybeSingle(),
    ]);

    const secondError = membershipResult.error ?? settlementResult.error;
    if (secondError) {
      setError(secondError.message);
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    const memberIds = (membershipResult.data ?? []).map((member) => member.user_id);
    const profilesResult = memberIds.length > 0
      ? await supabase.from("users_profile").select("id, display_name").in("id", memberIds)
      : { data: [], error: null };

    if (profilesResult.error) {
      setError(profilesResult.error.message);
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));
    const settlement = settlementResult.data;
    const winnerIds = new Set<string>();
    let settlementSummary: TopicDetailState["settlement"] = null;

    if (settlement) {
      const winnerRowsResult = await supabase.from("settlement_winners").select("user_id").eq("settlement_id", settlement.id);
      if (winnerRowsResult.error) {
        setError(winnerRowsResult.error.message);
        setUsingLiveData(false);
        setLoading(false);
        return;
      }

      const winnerNames = (winnerRowsResult.data ?? []).map((row) => {
        winnerIds.add(row.user_id);
        return profilesById.get(row.user_id) ?? row.user_id;
      });

      settlementSummary = {
        settledAt: settlement.settled_at,
        winnerCount: settlement.winner_count,
        payoutPerWinner: Number(settlement.payout_per_winner ?? 0),
        nextPoolAmount: Number(settlement.next_pool_amount ?? 0),
        resolutionNote: settlement.resolution_note,
        winnerNames,
      };
    }

    const predictionsResult = canPlayersViewAllPredictions(topicResult.data.status)
      ? await supabase.from("predictions").select("id, user_id, prediction_text, updated_at").eq("topic_id", topicId).order("updated_at", { ascending: true })
      : { data: [], error: null };

    if (predictionsResult.error) {
      setError(predictionsResult.error.message);
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    setTopic({
      id: topicResult.data.id,
      order: topicResult.data.order_index,
      title: topicResult.data.title,
      description: topicResult.data.description ?? "",
      status: topicResult.data.status,
      closeAt: topicResult.data.close_at,
      settlement: settlementSummary,
      predictions: (predictionsResult.data ?? []).map((prediction) => ({
        id: prediction.id,
        displayName: profilesById.get(prediction.user_id) ?? prediction.user_id,
        text: prediction.prediction_text,
        updatedAt: prediction.updated_at,
        isWinner: winnerIds.has(prediction.user_id),
      })),
    });
    setCurrency(leagueResult.data.currency);
    setUsingLiveData(true);
    setLoading(false);
  }, [fallbackCurrency, fallbackTopic, supabase, topicId]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        void load(data.session ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        void load(nextSession ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [load, supabase]);

  if (!topic) {
    return <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">Topic not found.</div>;
  }

  return (
    <div className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white">#{topic.order}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(topic.status)}`}>{getTopicDisplayStatus(topic.status)}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${usingLiveData ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>{usingLiveData ? "Live from Supabase" : "Preview mode"}</span>
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">{topic.title}</h2>
          <p className="mt-2 max-w-3xl text-zinc-600">{topic.description}</p>
          <p className="mt-3 text-sm text-zinc-500">Closes {formatDate(topic.closeAt)}</p>
        </div>
      </div>

      {loading ? <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">Loading…</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {topic.settlement ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-950">
          <p className="font-medium uppercase tracking-[0.2em] text-sky-700">Settlement outcome</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-white p-3">Winners: {topic.settlement.winnerCount}</div>
            <div className="rounded-xl bg-white p-3">Payout each: {formatMoney(topic.settlement.payoutPerWinner, currency)}</div>
            <div className="rounded-xl bg-white p-3">Next carryover: {formatMoney(topic.settlement.nextPoolAmount, currency)}</div>
            <div className="rounded-xl bg-white p-3">Settled: {formatDate(topic.settlement.settledAt)}</div>
          </div>
          {topic.settlement.winnerNames.length > 0 ? <p className="mt-3">Winners: {topic.settlement.winnerNames.join(", ")}</p> : <p className="mt-3">No winners were selected. The pool rolled forward.</p>}
          {topic.settlement.resolutionNote ? <p className="mt-2">Note: {topic.settlement.resolutionNote}</p> : null}
        </div>
      ) : null}

      <div className="rounded-2xl bg-zinc-50 p-5">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Predictions</p>
        {canPlayersViewAllPredictions(topic.status) ? (
          <div className="mt-4 space-y-3">
            {topic.predictions.map((prediction) => (
              <div key={prediction.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium text-zinc-900">{prediction.displayName}</p>
                    <p className="mt-1 text-sm text-zinc-700">{prediction.text}</p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {formatDate(prediction.updatedAt)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${prediction.isWinner ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>{prediction.isWinner ? "Winner" : "Prediction"}</span>
                </div>
              </div>
            ))}
            {topic.predictions.length === 0 ? <p className="text-sm text-zinc-600">No predictions recorded.</p> : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">Predictions stay hidden until the topic closes.</p>
        )}
      </div>
    </div>
  );
}
