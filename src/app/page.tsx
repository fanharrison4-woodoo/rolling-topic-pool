import Link from "next/link";
import {
  CURRENT_USER,
  LEAGUE,
  PLAYERS,
  TOPICS,
  getActivePool,
  getUserPrediction,
} from "@/lib/mock-data";
import { AuthStatusCard } from "@/components/auth-status-card";
import { LiveCurrentTopicSection } from "@/components/live-current-topic-section";
import { LiveLeagueMembersCard } from "@/components/live-league-members-card";
import { SiteNav } from "@/components/site-nav";
import { getSupabasePublicEnv } from "@/lib/env";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Home() {
  const pool = getActivePool(LEAGUE);
  const currentTopic = TOPICS.find((topic) => topic.id === pool.currentTopicId) ?? TOPICS[0];
  const userPrediction = getUserPrediction(currentTopic.id, CURRENT_USER.id);
  const settledCount = TOPICS.filter((topic) => topic.status === "settled").length;
  const supabase = getSupabasePublicEnv();

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-sky-900 p-8 text-white shadow-xl">
          <div className="mb-6 flex justify-end">
            <SiteNav />
          </div>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="text-sm uppercase tracking-[0.25em] text-sky-200">PoolChain MVP</p>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Transparent rolling pool bets for your friends.
              </h1>
              <p className="max-w-2xl text-lg text-zinc-200">
                One ordered series of topics, one fixed stake per player, and a jackpot that rolls until someone wins.
                The current build now supports the full core loop from prediction to settlement.
              </p>
            </div>

            <div className="grid min-w-[280px] gap-4 rounded-3xl bg-white/10 p-5 backdrop-blur">
              <div>
                <p className="text-sm text-zinc-300">League</p>
                <p className="text-2xl font-semibold">{LEAGUE.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-300">Stake</p>
                  <p className="text-xl font-semibold">{formatMoney(LEAGUE.stakePerTopic, LEAGUE.currency)}</p>
                </div>
                <div>
                  <p className="text-zinc-300">Players</p>
                  <p className="text-xl font-semibold">{PLAYERS.length}</p>
                </div>
                <div>
                  <p className="text-zinc-300">Carryover</p>
                  <p className="text-xl font-semibold">{formatMoney(pool.accumulatedPool, LEAGUE.currency)}</p>
                </div>
                <div>
                  <p className="text-zinc-300">Settled rounds</p>
                  <p className="text-xl font-semibold">{settledCount}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr_0.8fr]">
          <LiveCurrentTopicSection
            fallbackLeague={LEAGUE}
            fallbackPool={pool}
            fallbackTopic={currentTopic}
            fallbackUserPrediction={userPrediction}
          />

          <aside className="space-y-6">
            <AuthStatusCard projectHost={supabase.projectHost} configured={supabase.configured} />

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">How a round works</p>
              <ol className="mt-4 space-y-3 text-sm text-zinc-700">
                <li>1. League admin creates a topic and opens it.</li>
                <li>2. Players join the league and submit one prediction per open topic.</li>
                <li>3. At close, predictions lock and become visible.</li>
                <li>4. League admin selects winners and saves the settlement.</li>
                <li>5. The app records payout or carryover for the next round.</li>
              </ol>
            </div>

            <LiveLeagueMembersCard fallbackLeague={LEAGUE} fallbackPlayers={PLAYERS} />
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Explore the league</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Browse topics, drill into rounds, and inspect history</h3>
            <p className="mt-2 max-w-3xl text-zinc-600">
              The app now has dedicated browsing pages so testers can move around naturally instead of relying on one long homepage.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Link
                href="/topics"
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition hover:bg-zinc-100"
              >
                <p className="font-medium text-zinc-900">Topics</p>
                <p className="mt-2 text-sm text-zinc-600">See the full ordered queue, live statuses, prediction counts, and settlement summaries.</p>
              </Link>
              <Link
                href="/history"
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition hover:bg-zinc-100"
              >
                <p className="font-medium text-zinc-900">History</p>
                <p className="mt-2 text-sm text-zinc-600">Review settled rounds, winners, payout splits, carryover outcomes, and notes.</p>
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Friend-test status</p>
            <div className="mt-4 space-y-3 text-sm text-zinc-700">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="font-medium text-zinc-900">Core loop</p>
                <p className="mt-1">Sign in, join, predict, close, reveal, settle.</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="font-medium text-zinc-900">Browseability</p>
                <p className="mt-1">Home, topics, history, and per-topic drilldown are all in.</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="font-medium text-zinc-900">Safety</p>
                <p className="mt-1">Settlement order now respects topic order so carryover math stays sane.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
