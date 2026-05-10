"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { League, Player } from "@/lib/types";

interface LiveLeagueMembersCardProps {
  fallbackLeague: League;
  fallbackPlayers: Player[];
}

function avatarInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function LiveLeagueMembersCard({ fallbackLeague, fallbackPlayers }: LiveLeagueMembersCardProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [members, setMembers] = useState(fallbackPlayers);
  const [usingLiveData, setUsingLiveData] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));

  const load = useCallback(async (activeSession: Session | null) => {
    if (!supabase || !activeSession) {
      setMembers(fallbackPlayers);
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    const leagueResult = await supabase.from("leagues").select("id").limit(1).maybeSingle();
    if (leagueResult.error || !leagueResult.data) {
      setMembers(fallbackPlayers);
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    const membersResult = await supabase
      .from("league_members")
      .select("user_id, role")
      .eq("league_id", leagueResult.data.id)
      .eq("is_active", true);

    if (membersResult.error) {
      setMembers(fallbackPlayers);
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    const memberIds = (membersResult.data ?? []).map((member) => member.user_id);
    const profilesResult = memberIds.length > 0
      ? await supabase.from("users_profile").select("id, display_name").in("id", memberIds)
      : { data: [], error: null };

    if (profilesResult.error) {
      setMembers(fallbackPlayers);
      setUsingLiveData(false);
      setLoading(false);
      return;
    }

    const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));

    setMembers(
      (membersResult.data ?? []).map((member) => ({
        id: member.user_id,
        name: profilesById.get(member.user_id) ?? member.user_id,
        avatarInitials: avatarInitials(profilesById.get(member.user_id) ?? member.user_id),
        role: member.role,
      })),
    );
    setUsingLiveData(true);
    setLoading(false);
  }, [fallbackPlayers, supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        void load(data.session ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        void load(nextSession ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [load, supabase]);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">League members</p>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${usingLiveData ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
          {loading ? "Loading..." : usingLiveData ? "Live from Supabase" : "Preview mode"}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {members.map((player) => (
          <div key={player.id} className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                {player.avatarInitials}
              </div>
              <div>
                <p className="font-medium text-zinc-900">{player.name}</p>
                <p className="text-sm text-zinc-500">{player.role}</p>
              </div>
            </div>
            <span className="text-sm text-zinc-500">{formatMoney(fallbackLeague.stakePerTopic, fallbackLeague.currency)}/topic</span>
          </div>
        ))}
      </div>
    </div>
  );
}
