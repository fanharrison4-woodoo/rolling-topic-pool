import Link from "next/link";
import { LiveTopicDetail } from "@/components/live-topic-detail";

export default async function TopicDetailPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link href="/topics" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Topics
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">Topic detail</h1>
      </div>
      <LiveTopicDetail topicId={topicId} />
    </main>
  );
}
