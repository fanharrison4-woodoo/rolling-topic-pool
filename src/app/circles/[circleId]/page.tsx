import Link from "next/link";
import { LiveCurrentTopicSection } from "@/components/live-current-topic-section";

export default async function CirclePage({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link href="/circles" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Circles
        </Link>
      </div>
      <LiveCurrentTopicSection circleId={circleId} />
    </main>
  );
}
