"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export function MagicLinkForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setStatus("Supabase env is missing locally.");
      return;
    }

    setSubmitting(true);
    setStatus(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setStatus(error.message);
    } else {
      setStatus("Magic link sent. Check your inbox.");
      setEmail("");
    }

    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-zinc-50 p-4">
      <div>
        <p className="text-sm font-medium text-zinc-900">Magic-link sign-in</p>
        <p className="mt-1 text-sm text-zinc-600">
          First-pass auth wiring for the MVP.
        </p>
      </div>

      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
        required
      />

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Sending..." : "Send magic link"}
      </button>

      {status ? <p className="text-sm text-zinc-600">{status}</p> : null}
    </form>
  );
}
