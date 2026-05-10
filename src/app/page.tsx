import { LiveCurrentTopicSection } from "@/components/live-current-topic-section";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">League</h1>
        <p className="mt-1 text-sm text-zinc-500">Current topic, your prediction, and the full topic queue.</p>
      </div>
      <LiveCurrentTopicSection />
    </main>
  );
}
