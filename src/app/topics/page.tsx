import { LiveLeagueBrowser } from "@/components/live-league-browser";
import { SiteNav } from "@/components/site-nav";
import { LEAGUE, TOPICS, getPredictionsForTopic } from "@/lib/mock-data";

export default function TopicsPage() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">PoolChain</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">All topics</h1>
            <p className="mt-2 max-w-2xl text-zinc-600">Browse the ordered queue, see what is open or waiting, and inspect settlement summaries as the league moves forward.</p>
          </div>
          <SiteNav />
        </div>

        <LiveLeagueBrowser
          mode="topics"
          fallbackCurrency={LEAGUE.currency}
          fallbackItems={TOPICS.map((topic) => ({
            id: topic.id,
            order: topic.order,
            title: topic.title,
            description: topic.description,
            status: topic.status,
            closeAt: topic.closeAt,
            predictionCount: getPredictionsForTopic(topic.id).length,
            playerCount: LEAGUE.playerIds.length,
            settlement: topic.status === "settled"
              ? {
                  settledAt: topic.settledAt ?? topic.closeAt,
                  winnerCount: topic.winnerIds?.length ?? 0,
                  payoutPerWinner: topic.payoutPerWinner ?? 0,
                  nextPoolAmount: 0,
                  resolutionNote: topic.resolutionNote ?? null,
                  winnerNames: [],
                }
              : null,
          }))}
        />
      </div>
    </main>
  );
}
