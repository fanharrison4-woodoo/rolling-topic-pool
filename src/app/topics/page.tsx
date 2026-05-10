import { LiveLeagueBrowser } from "@/components/live-league-browser";

export default function TopicsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Topics</h1>
        <p className="mt-1 text-sm text-zinc-500">All rounds in order — open, closed, and settled.</p>
      </div>
      <LiveLeagueBrowser mode="topics" />
    </main>
  );
}
