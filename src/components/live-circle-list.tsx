"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { isAppAdminEmail } from "@/lib/app-admins";
import { createSupabaseBrowserClient } from "@/lib/supabase";

interface CircleEntry {
  id: string;
  name: string;
  stakeAmount: number;
  currency: string;
  role: "admin" | "player";
  topicCount: number;
  playerCount: number;
}

type CreateStep = "idle" | "circle" | "topic";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function CircleCard({ circle }: { circle: CircleEntry }) {
  return (
    <Link
      href={`/circles/${circle.id}`}
      className="block rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-900">{circle.name}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {circle.playerCount} player{circle.playerCount === 1 ? "" : "s"} · {circle.topicCount} topic{circle.topicCount === 1 ? "" : "s"} · stake {formatMoney(circle.stakeAmount, circle.currency)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
          {circle.role === "admin" ? "Admin" : "Player"}
        </span>
      </div>
    </Link>
  );
}

export function LiveCircleList() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [circles, setCircles] = useState<CircleEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [isAppAdmin, setIsAppAdmin] = useState(false);

  // Create circle form state
  const [createStep, setCreateStep] = useState<CreateStep>("idle");
  const [circleName, setCircleName] = useState("");
  const [stakeAmount, setStakeAmount] = useState("5");
  const [currency, setCurrency] = useState("USD");
  const [creatingCircle, setCreatingCircle] = useState(false);
  const [newCircleId, setNewCircleId] = useState<string | null>(null);
  const [createCircleError, setCreateCircleError] = useState<string | null>(null);

  // First topic form state
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [topicCloseAt, setTopicCloseAt] = useState("");
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [createTopicError, setCreateTopicError] = useState<string | null>(null);

  const load = useCallback(async (activeSession: Session | null) => {
    if (!supabase) return;

    setSession(activeSession);
    if (!activeSession) {
      setCircles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsAppAdmin(isAppAdminEmail(activeSession.user.email));

    const membershipsResult = await supabase
      .from("league_members")
      .select("role, league_id, leagues(id, name, stake_amount, currency)")
      .eq("user_id", activeSession.user.id)
      .eq("is_active", true);

    if (membershipsResult.error) {
      setError(membershipsResult.error.message);
      setLoading(false);
      return;
    }

    const rows = membershipsResult.data ?? [];
    const circleIds = rows.map((r) => (r.leagues as unknown as { id: string } | null)?.id).filter(Boolean) as string[];

    let topicCounts = new Map<string, number>();
    let playerCounts = new Map<string, number>();

    if (circleIds.length > 0) {
      const [topicsResult, membersResult] = await Promise.all([
        supabase.from("topics").select("league_id").in("league_id", circleIds),
        supabase.from("league_members").select("league_id").in("league_id", circleIds).eq("is_active", true),
      ]);

      for (const t of topicsResult.data ?? []) {
        topicCounts.set(t.league_id, (topicCounts.get(t.league_id) ?? 0) + 1);
      }
      for (const m of membersResult.data ?? []) {
        playerCounts.set(m.league_id, (playerCounts.get(m.league_id) ?? 0) + 1);
      }
    }

    const entries: CircleEntry[] = rows
      .map((r) => {
        const lg = r.leagues as unknown as { id: string; name: string; stake_amount: number; currency: string } | null;
        if (!lg) return null;
        return {
          id: lg.id,
          name: lg.name,
          stakeAmount: Number(lg.stake_amount ?? 0),
          currency: lg.currency,
          role: r.role as "admin" | "player",
          topicCount: topicCounts.get(lg.id) ?? 0,
          playerCount: playerCounts.get(lg.id) ?? 0,
        };
      })
      .filter((e): e is CircleEntry => e !== null);

    setCircles(entries);
    setLoading(false);

    if (entries.length === 1) {
      router.replace(`/circles/${entries[0].id}`);
    }
  }, [supabase, router]);

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

  async function handleCreateCircle() {
    if (!supabase || !session) return;

    const name = circleName.trim();
    const stake = parseFloat(stakeAmount);

    if (!name) { setCreateCircleError("Circle name is required."); return; }
    if (isNaN(stake) || stake <= 0) { setCreateCircleError("Stake must be a positive number."); return; }

    setCreatingCircle(true);
    setCreateCircleError(null);

    const { data: circleId, error: rpcError } = await supabase.rpc("bootstrap_league", {
      league_name: name,
      stake,
      league_currency: currency,
    });

    if (rpcError) {
      setCreateCircleError(rpcError.message);
      setCreatingCircle(false);
      return;
    }

    setNewCircleId(circleId as string);
    setCreatingCircle(false);
    setCreateStep("topic");
  }

  async function handleCreateFirstTopic() {
    if (!supabase || !session || !newCircleId) return;

    const title = topicTitle.trim();
    if (!title) { setCreateTopicError("Topic title is required."); return; }
    if (!topicCloseAt) { setCreateTopicError("Close time is required."); return; }

    setCreatingTopic(true);
    setCreateTopicError(null);

    const { error: insertError } = await supabase.from("topics").insert({
      league_id: newCircleId,
      order_index: 1,
      title,
      description: topicDescription.trim() || null,
      status: "open",
      open_at: new Date().toISOString(),
      close_at: new Date(topicCloseAt).toISOString(),
      created_by: session.user.id,
    });

    if (insertError) {
      setCreateTopicError(insertError.message);
      setCreatingTopic(false);
      return;
    }

    router.push(`/circles/${newCircleId}`);
  }

  if (!session && !loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-sm text-zinc-600">Sign in to see your circles.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-16 animate-pulse rounded-2xl bg-zinc-200" />
        <div className="h-16 animate-pulse rounded-2xl bg-zinc-100" />
      </div>
    );
  }

  if (createStep === "circle") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="font-semibold text-zinc-900">Create a circle</p>
        <p className="mt-1 text-sm text-zinc-500">You'll become the circle admin and can invite others.</p>
        <div className="mt-5 space-y-3">
          <input
            type="text"
            value={circleName}
            onChange={(e) => setCircleName(e.target.value)}
            placeholder="Circle name"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none"
          />
          <div className="flex gap-3">
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="Stake per topic"
              min="1"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
              <option value="CNY">CNY</option>
              <option value="JPY">JPY</option>
            </select>
          </div>
          {createCircleError && <p className="text-sm text-rose-600">{createCircleError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCreateCircle}
              disabled={creatingCircle}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {creatingCircle ? "Creating…" : "Continue"}
            </button>
            <button
              type="button"
              onClick={() => { setCreateStep("idle"); setCreateCircleError(null); }}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (createStep === "topic") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="font-semibold text-zinc-900">Create the first topic</p>
        <p className="mt-1 text-sm text-zinc-500">Every circle needs at least one topic to get started.</p>
        <div className="mt-5 space-y-3">
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
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Closes at</label>
            <input
              type="datetime-local"
              value={topicCloseAt}
              onChange={(e) => setTopicCloseAt(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none"
            />
          </div>
          {createTopicError && <p className="text-sm text-rose-600">{createTopicError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCreateFirstTopic}
              disabled={creatingTopic}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {creatingTopic ? "Creating…" : "Create topic & open circle"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const adminCircles = circles.filter((c) => c.role === "admin");
  const playerCircles = circles.filter((c) => c.role === "player");
  const hasAdminRole = adminCircles.length > 0;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {hasAdminRole && (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Circles I manage</p>
          <div className="space-y-3">
            {adminCircles.map((circle) => (
              <CircleCard key={circle.id} circle={circle} />
            ))}
          </div>
        </div>
      )}

      {playerCircles.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            {hasAdminRole ? "Circles I play in" : "My circles"}
          </p>
          <div className="space-y-3">
            {playerCircles.map((circle) => (
              <CircleCard key={circle.id} circle={circle} />
            ))}
          </div>
        </div>
      )}

      {circles.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          You are not in any circle yet.
        </div>
      )}

      {session && (
        <div>
          <button
            type="button"
            onClick={() => setCreateStep("circle")}
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
          >
            Create a circle
          </button>
        </div>
      )}

      {isAppAdmin && (
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-sm">
          <Link href="/admin" className="font-medium text-zinc-700 hover:text-zinc-950">
            Global admin panel →
          </Link>
        </div>
      )}
    </div>
  );
}
