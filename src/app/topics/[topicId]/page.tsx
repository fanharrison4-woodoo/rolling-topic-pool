import Link from "next/link";
import { LiveTopicDetail } from "@/components/live-topic-detail";
import { SiteNav } from "@/components/site-nav";
import { LEAGUE, PLAYERS, TOPICS, getPredictionsForTopic } from "@/lib/mock-data";

const playerNamesById = new Map(PLAYERS.map((player) => [player.id, player.name]));

export default async function TopicDetailPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const fallbackTopic = TOPICS.find((topic) => topic.id === topicId) ?? null;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">PoolChain</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Topic detail</h1>
            <p className="mt-2 max-w-2xl text-zinc-600">Drill into one round: prompt, timing, revealed predictions, and settlement outcome.</p>
          </div>
          <SiteNav />
        </div>

        <Link href="/topics" className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline">
          ← Back to all topics
        </Link>

        <LiveTopicDetail
          topicId={topicId}
          fallbackCurrency={LEAGUE.currency}
          fallbackTopic={fallbackTopic
            ? {
                id: fallbackTopic.id,
                order: fallbackTopic.order,
                title: fallbackTopic.title,
                description: fallbackTopic.description,
                status: fallbackTopic.status,
                closeAt: fallbackTopic.closeAt,
                settlement: fallbackTopic.status === "settled"
                  ? {
                      settledAt: fallbackTopic.settledAt ?? fallbackTopic.closeAt,
                      winnerCount: fallbackTopic.winnerIds?.length ?? 0,
                      payoutPerWinner: fallbackTopic.payoutPerWinner ?? 0,
                      nextPoolAmount: 0,
                      resolutionNote: fallbackTopic.resolutionNote ?? null,
                      winnerNames: (fallbackTopic.winnerIds ?? []).map((winnerId) => playerNamesById.get(winnerId) ?? winnerId),
                    }
                  : null,
                predictions: getPredictionsForTopic(fallbackTopic.id).map((prediction) => ({
                  id: prediction.id,
                  displayName: playerNamesById.get(prediction.playerId) ?? prediction.playerId,
                  text: prediction.text,
                  updatedAt: prediction.updatedAt,
                  isWinner: Boolean(prediction.isWinner),
                })),
              }
            : null}
        />
      </div>
    </main>
  );
}
