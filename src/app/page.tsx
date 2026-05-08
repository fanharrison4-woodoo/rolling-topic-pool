import {
  CURRENT_USER,
  LEAGUE,
  PLAYERS,
  TOPICS,
  getActivePool,
  getPlayerById,
  getPredictionsForTopic,
  getUserPrediction,
} from "@/lib/mock-data";
import { Prediction, Topic } from "@/lib/types";

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

function PredictionRow({ prediction, topicStatus }: { prediction: Prediction; topicStatus: Topic["status"] }) {
  const player = getPlayerById(prediction.playerId);

  return (
    <div className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[1.2fr_1.6fr_1fr_1fr]">
      <div>
        <p className="font-medium text-zinc-900">{player?.name}</p>
        <p className="text-sm text-zinc-500">{player?.role}</p>
      </div>
      <div>
        <p className="font-medium text-zinc-900">{prediction.text}</p>
        <p className="text-sm text-zinc-500">
          Submitted {formatDate(prediction.createdAt)}
        </p>
      </div>
      <div className="text-sm text-zinc-600">
        Updated {formatDate(prediction.updatedAt)}
      </div>
      <div className="flex items-center justify-start md:justify-end">
        {topicStatus === "settled" ? (
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              prediction.isWinner
                ? "bg-emerald-100 text-emerald-800"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {prediction.isWinner ? "Winner" : "No payout"}
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600">
            {topicStatus === "open" ? "Editable" : "Locked"}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const pool = getActivePool(LEAGUE);
  const currentTopic = TOPICS.find((topic) => topic.id === pool.currentTopicId) ?? TOPICS[0];
  const userPrediction = getUserPrediction(currentTopic.id, CURRENT_USER.id);
  const currentTopicPredictions = getPredictionsForTopic(currentTopic.id);
  const settledTopics = TOPICS.filter((topic) => topic.status === "settled");

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-sky-900 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="text-sm uppercase tracking-[0.25em] text-sky-200">PoolChain MVP</p>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Transparent rolling pool bets for your friends.
              </h1>
              <p className="max-w-2xl text-lg text-zinc-200">
                One ordered series of topics, one fixed stake per player, and a jackpot that rolls until someone wins.
                This prototype keeps the rules visible, the math auditable, and the workflow simple.
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
                  <p className="text-zinc-300">Live pool</p>
                  <p className="text-xl font-semibold">{formatMoney(pool.totalPool, LEAGUE.currency)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Current topic</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">{currentTopic.title}</h2>
                <p className="mt-2 max-w-2xl text-zinc-600">{currentTopic.description}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusTone(currentTopic.status)}`}>
                {currentTopic.status}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-sm text-zinc-500">Close time</p>
                <p className="mt-2 font-medium">{formatDate(currentTopic.closeAt)}</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-sm text-zinc-500">Carryover before round</p>
                <p className="mt-2 font-medium">{formatMoney(pool.accumulatedPool, LEAGUE.currency)}</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-sm text-zinc-500">New round contributions</p>
                <p className="mt-2 font-medium">{formatMoney(pool.topicContribution, LEAGUE.currency)}</p>
              </div>
              <div className="rounded-2xl bg-zinc-950 p-4 text-white">
                <p className="text-sm text-zinc-300">Total pool if settled now</p>
                <p className="mt-2 text-2xl font-semibold">{formatMoney(pool.totalPool, LEAGUE.currency)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Your prediction</p>
              <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900">
                    {userPrediction ? userPrediction.text : "No prediction submitted yet"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {userPrediction
                      ? `Last updated ${formatDate(userPrediction.updatedAt)}`
                      : "Players can submit or edit until the close time."}
                  </p>
                </div>
                <button className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800">
                  {currentTopic.status === "open"
                    ? userPrediction
                      ? "Edit prediction"
                      : "Submit prediction"
                    : "Predictions locked"}
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <label className="text-sm font-medium text-zinc-700">Prediction text</label>
                  <textarea
                    className="mt-2 min-h-28 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-zinc-400"
                    defaultValue={userPrediction?.text ?? "Lionel Messi"}
                  />
                </div>
                <button className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100">
                  Save draft mock
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Admin settlement flow</p>
              <ol className="mt-4 space-y-3 text-sm text-zinc-700">
                <li>1. Wait until the topic is closed.</li>
                <li>2. Review all locked predictions.</li>
                <li>3. Add a resolution note describing the real-world outcome.</li>
                <li>4. Mark winner(s) manually.</li>
                <li>5. App calculates payout split or rollover automatically.</li>
                <li>6. Broadcast the result later by email or Discord.</li>
              </ol>
              <div className="mt-5 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700">
                <p className="font-medium text-zinc-900">Mock admin action</p>
                <p className="mt-2">If 2 winners are selected for the current {formatMoney(pool.totalPool, LEAGUE.currency)} pool, each receives {formatMoney(pool.totalPool / 2, LEAGUE.currency)} and the next topic resets to {formatMoney(0, LEAGUE.currency)}.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">League members</p>
              <div className="mt-4 space-y-3">
                {PLAYERS.map((player) => (
                  <div key={player.id} className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                        {player.avatarInitials}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900">{player.name}</p>
                        <p className="text-sm text-zinc-500">{player.role}</p>
                      </div>
                    </div>
                    <span className="text-sm text-zinc-500">{formatMoney(LEAGUE.stakePerTopic, LEAGUE.currency)}/topic</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Ordered topic list</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">From future topics to settled history</h3>
            </div>
            <p className="text-sm text-zinc-500">One stake from every player on every topic.</p>
          </div>

          <div className="mt-6 grid gap-4">
            {TOPICS.map((topic) => {
              const predictionCount = getPredictionsForTopic(topic.id).length;
              return (
                <div key={topic.id} className="grid gap-4 rounded-2xl border border-zinc-200 p-5 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-lg font-semibold text-white">
                    {topic.order}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-lg font-semibold text-zinc-900">{topic.title}</h4>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(topic.status)}`}>
                        {topic.status}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-600">{topic.description}</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Close: {formatDate(topic.closeAt)} · {predictionCount}/{PLAYERS.length} predictions logged
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    {topic.status === "settled"
                      ? `${topic.winnerIds?.length ? `${topic.winnerIds.length} winner(s)` : "Rolled over"} · Pool ${formatMoney(topic.poolAtSettlement ?? 0, LEAGUE.currency)}`
                      : topic.status === "open"
                        ? "Open for edits"
                        : topic.status === "closed"
                          ? "Awaiting admin resolution"
                          : "Not live yet"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Audit trail</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Exact predictions for the active topic</h3>
            <p className="mt-2 text-zinc-600">
              Before launch, you may hide other players&apos; picks while a topic is open. After close time, every prediction stays visible for review.
            </p>
            <div className="mt-6 space-y-3">
              {currentTopicPredictions.map((prediction) => (
                <PredictionRow key={prediction.id} prediction={prediction} topicStatus={currentTopic.status} />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Settled examples</p>
            <div className="mt-4 space-y-4">
              {settledTopics.map((topic) => (
                <div key={topic.id} className="rounded-2xl bg-zinc-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-semibold text-zinc-900">{topic.title}</h4>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">settled</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">{topic.resolutionNote}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-zinc-700">
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-zinc-500">Pool at settlement</p>
                      <p className="mt-1 font-medium">{formatMoney(topic.poolAtSettlement ?? 0, LEAGUE.currency)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-zinc-500">Payout per winner</p>
                      <p className="mt-1 font-medium">{formatMoney(topic.payoutPerWinner ?? 0, LEAGUE.currency)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
