import { LiveAdminPanel } from "@/components/live-admin-panel";

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Admin</h1>
        <p className="mt-1 text-sm text-zinc-500">Global role management across all leagues.</p>
      </div>
      <LiveAdminPanel />
    </main>
  );
}
