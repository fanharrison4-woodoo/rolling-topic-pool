import Link from "next/link";
import { LiveCircleSettings } from "@/components/live-circle-settings";

export default async function CircleSettingsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/circles/${circleId}`} className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Back to circle
        </Link>
        <h1 className="text-lg font-semibold text-zinc-900">Circle settings</h1>
      </div>
      <LiveCircleSettings circleId={circleId} />
    </main>
  );
}
