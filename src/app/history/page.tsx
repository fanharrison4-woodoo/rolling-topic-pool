import { LiveCircleBrowser } from "@/components/live-circle-browser";

export default function HistoryPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">History</h1>
        <p className="mt-1 text-sm text-zinc-500">Settled rounds, payouts, and resolution notes.</p>
      </div>
      <LiveCircleBrowser mode="history" />
    </main>
  );
}
