"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { getTopicDisplayStatus } from "@/lib/topic-rules";
import type { Topic } from "@/lib/types";

interface LiveLeagueBrowserProps {
  mode: "topics" | "history";
}

interface BrowserItem {
  id: string;
  order: number;
  title: string;
  description: string;
  status: Topic["status"];
  closeAt: string;
  predictionCount: number;
  playerCount: number;
  settlement: {
    settledAt: string;
    winnerCount: number;
    payoutPerWinner: number;
    nextPoolAmount: number;
    resolutionNote: string | null;
    winnerNames: string[];
  } | null;
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

export function LiveLeagueBrowser({ mode }: LiveLeagueBrowserProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<BrowserItem[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(Boolean(supabase));
  const [usingLiveData, setUsingLiveData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (activeSession: Session | null) => {
    if (!supabase) {
      return;
    }

    setSession(activeSession);
    if (!activeSession) {
      setItems([]);
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const leagueResult = await supabase.from("leagues").select("id, currency").limit(1).maybeSingle();
    if (leagueResult.error || !leagueResult.data) {
      setError(leagueResult.error?.message ?? "No league found");
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    const leagueId = leagueResult.data.id;
    const [membersResult, topicsResult] = await Promise.all([
      supabase.from("league_members").select("user_id").eq("league_id", leagueId).eq("is_active", true),
      supabase
        .from("topics")
        .select("id, order_index, title, description, status, close_at")
        .eq("league_id", leagueId)
        .order("order_index", { ascending: true }),
    ]);

    const firstError = membersResult.error ?? topicsResult.error;
    if (firstError) {
      setError(firstError.message);
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    const topicIds = (topicsResult.data ?? []).map((topic) => topic.id);
    const [predictionsResult, settlementsResult] = await Promise.all([
      topicIds.length > 0
        ? supabase.from("predictions").select("topic_id") .in("topic_id", topicIds)
        : Promise.resolve({ data: [], error: null }),
      topicIds.length > 0
        ? supabase
            .from("settlements")
            .select("id, topic_id, winner_count, payout_per_winner, next_pool_amount, resolution_note, settled_at")
            .in("topic_id", topicIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const secondError = predictionsResult.error ?? settlementsResult.error;
    if (secondError) {
      setError(secondError.message);
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    const predictionCounts = new Map<string, number>();
    for (const row of predictionsResult.data ?? []) {
      predictionCounts.set(row.topic_id, (predictionCounts.get(row.topic_id) ?? 0) + 1);
    }

    const settlementRows = settlementsResult.data ?? [];
    const settlementIds = settlementRows.map((row) => row.id);
    const winnerNamesBySettlementId = new Map<string, string[]>();

    if (settlementIds.length > 0) {
      const winnerRowsResult = await supabase.from("settlement_winners").select("settlement_id, user_id").in("settlement_id", settlementIds);
      if (winnerRowsResult.error) {
        setError(winnerRowsResult.error.message);
        setUsingLiveData(false);
        setLoading(false);
        return;
      }

      const winnerUserIds = [...new Set((winnerRowsResult.data ?? []).map((row) => row.user_id))];
      const profilesResult = winnerUserIds.length > 0
        ? await supabase.from("users_profile").select("id, display_name").in("id", winnerUserIds)
        : { data: [], error: null };

      if (profilesResult.error) {
        setError(profilesResult.error.message);
        setUsingLiveData(false);
        setLoading(false);
        return;
      }

      const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));
      for (const winnerRow of winnerRowsResult.data ?? []) {
        const current = winnerNamesBySettlementId.get(winnerRow.settlement_id) ?? [];
        current.push(profilesById.get(winnerRow.user_id) ?? winnerRow.user_id);
        winnerNamesBySettlementId.set(winnerRow.settlement_id, current);
      }
    }

    const settlementByTopicId = new Map(
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

    const nextItems = (topicsResult.data ?? []).map((topic) => ({
      id: topic.id,
      order: topic.order_index,
      title: topic.title,
      description: topic.description ?? "",
      status: topic.status,
      closeAt: topic.close_at,
      predictionCount: predictionCounts.get(topic.id) ?? 0,
      playerCount: membersResult.data?.length ?? 0,
      settlement: settlementByTopicId.get(topic.id) ?? null,
    }));

    setItems(mode === "history" ? nextItems.filter((item) => getTopicDisplayStatus(item.status) === "settled") : nextItems);
    setCurrency(leagueResult.data.currency);
    setUsingLiveData(true);
    setLoading(false);
  }, [mode, supabase]);

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

  if (!session && !loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-sm text-zinc-600">Sign in to see {mode === "topics" ? "topics" : "history"}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading ? <div className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-600">Loading…</div> : null}
      {error ? <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white">#{item.order}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>{getTopicDisplayStatus(item.status)}</span>
                </div>
                <p className="mt-2 text-lg font-semibold text-zinc-900">{item.title}</p>
                <p className="mt-1 text-zinc-600">{item.description}</p>
                <p className="mt-2 text-sm text-zinc-500">Closes {formatDate(item.closeAt)}</p>
                {mode === "topics" ? (
                  <p className="mt-1 text-sm text-zinc-500">
                    {item.predictionCount}/{item.playerCount} predictions logged
                  </p>
                ) : null}
              </div>
              <div className="flex min-w-[260px] flex-col gap-3">
                {item.settlement ? (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                    <p>Settled {formatDate(item.settlement.settledAt)}</p>
                    <p className="mt-1">Winners: {item.settlement.winnerCount}</p>
                    <p className="mt-1">Payout each: {formatMoney(item.settlement.payoutPerWinner, currency)}</p>
                    <p className="mt-1">Next carryover: {formatMoney(item.settlement.nextPoolAmount, currency)}</p>
                    {item.settlement.winnerNames.length > 0 ? <p className="mt-1">Winners: {item.settlement.winnerNames.join(", ")}</p> : null}
                    {item.settlement.resolutionNote ? <p className="mt-1">Note: {item.settlement.resolutionNote}</p> : null}
                  </div>
                ) : null}
                <Link
                  href={`/topics/${item.id}`}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
                >
                  View topic detail
                </Link>
              </div>
            </div>
          </div>
        ))}

        {!loading && items.length === 0 ? (
          <div className="rounded-xl bg-zinc-50 p-5 text-sm text-zinc-600">
            {mode === "topics" ? "No topics yet." : "No settled topics yet."}
          </div>
        ) : null}
      </div>
    </div>
  );
}
