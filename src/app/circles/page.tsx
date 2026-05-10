import { LiveCircleList } from "@/components/live-circle-list";

export default function CirclesPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Circles</h1>
        <p className="mt-1 text-sm text-zinc-500">Your prediction pools.</p>
      </div>
      <LiveCircleList />
    </main>
  );
}
