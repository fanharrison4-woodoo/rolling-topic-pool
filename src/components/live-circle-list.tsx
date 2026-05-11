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
  playerCount: number;
  membershipOpen: boolean;
  openTopicTitle: string | null;
  openTopicCloseAt: string | null;
}

interface PublicCircle {
  id: string;
  name: string;
  stakeAmount: number;
  currency: string;
  memberCount: number;
  openTopicTitle: string | null;
  openTopicCloseAt: string | null;
}

type CreateStep = "idle" | "circle" | "topic";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function MyCircleCard({ circle }: { circle: CircleEntry }) {
  return (
    <Link
      href={`/circles/${circle.id}`}
      className="block rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900">{circle.name}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {circle.playerCount} player{circle.playerCount === 1 ? "" : "s"} · stake {formatMoney(circle.stakeAmount, circle.currency)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            {circle.role === "admin" ? "Admin" : "Player"}
          </span>
          {!circle.membershipOpen && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Membership closed</span>
          )}
        </div>
      </div>
      {circle.openTopicTitle ? (
        <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3">
          <p className="text-xs font-medium text-emerald-700">Open topic</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-900">{circle.openTopicTitle}</p>
          {circle.openTopicCloseAt && (
            <p className="mt-0.5 text-xs text-zinc-500">Closes {formatDate(circle.openTopicCloseAt)}</p>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-zinc-50 px-4 py-3">
          <p className="text-xs text-zinc-400">No open topic right now</p>
        </div>
      )}
    </Link>
  );
}

function PublicCircleCard({ circle, onView }: { circle: PublicCircle; onView: () => void }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900">{circle.name}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {circle.memberCount} player{circle.memberCount === 1 ? "" : "s"} · stake {formatMoney(circle.stakeAmount, circle.currency)}
          </p>
        </div>
        <button
          type="button"
          onClick={onView}
          className="shrink-0 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-500"
        >
          View
        </button>
      </div>
      {circle.openTopicTitle && (
        <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3">
          <p className="text-xs font-medium text-emerald-700">Open topic</p>
          <p className="mt-0.5 text-sm text-zinc-800">{circle.openTopicTitle}</p>
        </div>
      )}
    </div>
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

  // Browse public circles
  const [showBrowse, setShowBrowse] = useState(false);
  const [publicCircles, setPublicCircles] = useState<PublicCircle[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  // Create circle form
  const [createStep, setCreateStep] = useState<CreateStep>("idle");
  const [circleName, setCircleName] = useState("");
  const [stakeAmount, setStakeAmount] = useState("5");
  const [currency, setCurrency] = useState("USD");
  const [creatingCircle, setCreatingCircle] = useState(false);
  const [newCircleId, setNewCircleId] = useState<string | null>(null);
  const [createCircleError, setCreateCircleError] = useState<string | null>(null);

  // First topic form
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
    const circleIds = rows
      .map((r) => (r.leagues as unknown as { id: string } | null)?.id)
      .filter(Boolean) as string[];

    let playerCounts = new Map<string, number>();
    let openTopicByCircle = new Map<string, { title: string; closeAt: string }>();
    let membershipOpenById = new Map<string, boolean>();

    if (circleIds.length > 0) {
      const [membersResult, topicsResult, membershipOpenResult] = await Promise.all([
        supabase.from("league_members").select("league_id").in("league_id", circleIds).eq("is_active", true),
        supabase
          .from("topics")
          .select("league_id, title, close_at")
          .in("league_id", circleIds)
          .eq("status", "open")
          .order("order_index", { ascending: true }),
        // Separate query for membership_open — silently defaults to true if column doesn't exist yet
        supabase.from("leagues").select("id, membership_open").in("id", circleIds),
      ]);

      for (const m of membersResult.data ?? []) {
        playerCounts.set(m.league_id, (playerCounts.get(m.league_id) ?? 0) + 1);
      }
      // First open topic per circle (results already ordered by order_index)
      for (const t of topicsResult.data ?? []) {
        if (!openTopicByCircle.has(t.league_id)) {
          openTopicByCircle.set(t.league_id, { title: t.title, closeAt: t.close_at });
        }
      }
      for (const l of membershipOpenResult.data ?? []) {
        membershipOpenById.set(l.id, (l as unknown as { membership_open?: boolean }).membership_open ?? true);
      }
    }

    const entries: CircleEntry[] = rows
      .map((r) => {
        const lg = r.leagues as unknown as {
          id: string; name: string; stake_amount: number; currency: string;
        } | null;
        if (!lg) return null;
        const openTopic = openTopicByCircle.get(lg.id) ?? null;
        return {
          id: lg.id,
          name: lg.name,
          stakeAmount: Number(lg.stake_amount ?? 0),
          currency: lg.currency,
          role: r.role as "admin" | "player",
          playerCount: playerCounts.get(lg.id) ?? 0,
          membershipOpen: membershipOpenById.get(lg.id) ?? true,
          openTopicTitle: openTopic?.title ?? null,
          openTopicCloseAt: openTopic?.closeAt ?? null,
        };
      })
      .filter((e): e is CircleEntry => e !== null);

    setCircles(entries);
    setLoading(false);
  }, [supabase]);

  async function loadPublicCircles() {
    if (!supabase || !session) return;
    setBrowseLoading(true);
    const { data, error: rpcError } = await supabase.rpc("public_open_circles");
    if (!rpcError && data) {
      setPublicCircles(
        (data as Array<{
          id: string; name: string; stake_amount: number; currency: string;
          member_count: number; open_topic_title: string | null; open_topic_close_at: string | null;
        }>).map((row) => ({
          id: row.id,
          name: row.name,
          stakeAmount: Number(row.stake_amount),
          currency: row.currency,
          memberCount: Number(row.member_count),
          openTopicTitle: row.open_topic_title,
          openTopicCloseAt: row.open_topic_close_at,
        })),
      );
    }
    setBrowseLoading(false);
    setShowBrowse(true);
  }

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
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
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
              className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
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
          <button
            type="button"
            onClick={handleCreateFirstTopic}
            disabled={creatingTopic}
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {creatingTopic ? "Creating…" : "Create topic & open circle"}
          </button>
        </div>
      </div>
    );
  }

  const adminCircles = circles.filter((c) => c.role === "admin");
  const playerCircles = circles.filter((c) => c.role === "player");
  const hasAdminRole = adminCircles.length > 0;

  return (
    <div className="space-y-8">
      {error && <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {hasAdminRole && (
        <section>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Circles I manage</p>
          <div className="space-y-3">
            {adminCircles.map((circle) => <MyCircleCard key={circle.id} circle={circle} />)}
          </div>
        </section>
      )}

      {playerCircles.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            {hasAdminRole ? "Circles I play in" : "My circles"}
          </p>
          <div className="space-y-3">
            {playerCircles.map((circle) => <MyCircleCard key={circle.id} circle={circle} />)}
          </div>
        </section>
      )}

      {circles.length === 0 && !showBrowse && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          You are not in any circle yet.
        </div>
      )}

      {/* Browse public circles */}
      {session && !showBrowse && (
        <button
          type="button"
          onClick={loadPublicCircles}
          disabled={browseLoading}
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
        >
          {browseLoading ? "Loading…" : "Browse open circles →"}
        </button>
      )}

      {showBrowse && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Open circles</p>
            <button
              type="button"
              onClick={() => setShowBrowse(false)}
              className="text-xs text-zinc-400 hover:text-zinc-700"
            >
              Hide
            </button>
          </div>
          {publicCircles.length === 0 ? (
            <p className="text-sm text-zinc-500">No other open circles right now.</p>
          ) : (
            <div className="space-y-3">
              {publicCircles.map((circle) => (
                <PublicCircleCard
                  key={circle.id}
                  circle={circle}
                  onView={() => router.push(`/circles/${circle.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {session && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setCreateStep("circle")}
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
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
