import Link from "next/link";
import { LiveCurrentTopicSection } from "@/components/live-current-topic-section";

export default async function LeaguePage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link href="/leagues" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Leagues
        </Link>
      </div>
      <LiveCurrentTopicSection leagueId={leagueId} />
    </main>
  );
}
