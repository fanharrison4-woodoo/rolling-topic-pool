import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <div className="rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-200">Welcome to</p>
        <h1 className="mt-1 text-5xl font-bold tracking-tight text-white">PoolChain</h1>
        <p className="mt-3 text-xl font-medium text-amber-100">Make a call. Win the pool.</p>
        <p className="mt-2 text-sm leading-relaxed text-amber-200">
          A rolling prediction pool for your crew. Everyone stakes in, everyone predicts — the
          sharpest call wins the jackpot. No winner? The pool rolls to the next round.
        </p>
        <Link
          href="/circles"
          className="mt-6 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-50"
        >
          Go to my circles →
        </Link>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">How it works</p>
        <div className="mt-4 space-y-3">
          <div className="flex gap-4 rounded-2xl border border-zinc-100 bg-white p-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
              1
            </span>
            <div>
              <p className="font-semibold text-zinc-900">Join a circle</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                Your circle admin creates prediction topics and opens them for the group. Every
                member stakes in automatically each round.
              </p>
            </div>
          </div>
          <div className="flex gap-4 rounded-2xl border border-zinc-100 bg-white p-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
              2
            </span>
            <div>
              <p className="font-semibold text-zinc-900">Make your call</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                Submit your prediction before the topic closes. Miss the deadline? Your stake still
                counts — you'll show up as N/A.
              </p>
            </div>
          </div>
          <div className="flex gap-4 rounded-2xl border border-zinc-100 bg-white p-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
              3
            </span>
            <div>
              <p className="font-semibold text-zinc-900">Win the jackpot</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                Once the topic closes, your admin picks the winner(s). The pool pays out — or rolls
                forward if nobody nails it.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 p-6 text-center">
        <p className="font-semibold text-amber-900">Ready to play?</p>
        <p className="mt-1 text-sm text-amber-700">
          Sign in above, then browse circles or get invited by a friend.
        </p>
        <Link
          href="/circles"
          className="mt-4 inline-block rounded-full bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
        >
          Browse circles
        </Link>
      </div>
    </main>
  );
}
