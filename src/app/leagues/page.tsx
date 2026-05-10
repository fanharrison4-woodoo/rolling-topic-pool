import { LiveLeagueList } from "@/components/live-league-list";

export default function LeaguesPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Leagues</h1>
        <p className="mt-1 text-sm text-zinc-500">Your prediction pools.</p>
      </div>
      <LiveLeagueList />
    </main>
  );
}
