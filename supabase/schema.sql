create extension if not exists pgcrypto;

create table if not exists public.users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stake_amount numeric(10,2) not null check (stake_amount >= 0),
  currency text not null default 'USD',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'player')),
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  order_index integer not null,
  title text not null,
  description text,
  status text not null default 'upcoming' check (status in ('upcoming', 'open', 'closed', 'settled')),
  open_at timestamptz,
  close_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, order_index)
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prediction_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_id, user_id)
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null unique references public.topics(id) on delete cascade,
  previous_pool_amount numeric(10,2) not null,
  contribution_amount numeric(10,2) not null,
  total_pool_amount numeric(10,2) not null,
  winner_count integer not null check (winner_count >= 0),
  payout_per_winner numeric(10,2) not null,
  next_pool_amount numeric(10,2) not null,
  resolution_note text,
  settled_by uuid not null references auth.users(id) on delete restrict,
  settled_at timestamptz not null default now()
);

create table if not exists public.settlement_winners (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unique (settlement_id, user_id)
);

create table if not exists public.announcement_logs (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  channel_type text not null,
  channel_target text,
  payload_summary text,
  sent_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users_profile (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1),
      'Player'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

create or replace function public.is_league_member(target_league uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.league_members lm
    where lm.league_id = target_league
      and lm.user_id = auth.uid()
      and lm.is_active = true
  );
$$;

create or replace function public.is_league_admin(target_league uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.league_members lm
    where lm.league_id = target_league
      and lm.user_id = auth.uid()
      and lm.role = 'admin'
      and lm.is_active = true
  );
$$;

create or replace function public.bootstrap_league(
  league_name text,
  stake numeric,
  league_currency text default 'USD'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.leagues (name, stake_amount, currency, created_by)
  values (league_name, stake, league_currency, auth.uid())
  returning id into new_league_id;

  insert into public.league_members (league_id, user_id, role, is_active)
  values (new_league_id, auth.uid(), 'admin', true)
  on conflict (league_id, user_id) do update
    set role = 'admin', is_active = true;

  return new_league_id;
end;
$$;

grant execute on function public.bootstrap_league(text, numeric, text) to authenticated;

create or replace function public.join_league(target_league uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  joined_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select id into joined_league_id
  from public.leagues
  where id = target_league;

  if joined_league_id is null then
    raise exception 'League not found';
  end if;

  insert into public.league_members (league_id, user_id, role, is_active)
  values (joined_league_id, auth.uid(), 'player', true)
  on conflict (league_id, user_id) do update
    set is_active = true;

  return joined_league_id;
end;
$$;

grant execute on function public.join_league(uuid) to authenticated;

alter table public.users_profile enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.topics enable row level security;
alter table public.predictions enable row level security;
alter table public.settlements enable row level security;
alter table public.settlement_winners enable row level security;
alter table public.announcement_logs enable row level security;

drop policy if exists "profiles are readable by authenticated users" on public.users_profile;
create policy "profiles are readable by authenticated users"
on public.users_profile for select
using (auth.role() = 'authenticated');

drop policy if exists "users manage own profile" on public.users_profile;
create policy "users manage own profile"
on public.users_profile for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "authenticated users can read leagues" on public.leagues;
create policy "authenticated users can read leagues"
on public.leagues for select
to authenticated
using (true);

drop policy if exists "members can create leagues they own" on public.leagues;
create policy "members can create leagues they own"
on public.leagues for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "admins update leagues" on public.leagues;
create policy "admins update leagues"
on public.leagues for update
using (public.is_league_admin(id))
with check (public.is_league_admin(id));

drop policy if exists "admins delete leagues" on public.leagues;
create policy "admins delete leagues"
on public.leagues for delete
using (public.is_league_admin(id));

drop policy if exists "authenticated users can read league_members" on public.league_members;
create policy "authenticated users can read league_members"
on public.league_members for select
to authenticated
using (true);

drop policy if exists "admins manage league_members" on public.league_members;
create policy "admins manage league_members"
on public.league_members for all
using (public.is_league_admin(league_id))
with check (public.is_league_admin(league_id));

drop policy if exists "authenticated users can read topics" on public.topics;
create policy "authenticated users can read topics"
on public.topics for select
to authenticated
using (true);

drop policy if exists "admins manage topics" on public.topics;
create policy "admins manage topics"
on public.topics for all
using (public.is_league_admin(league_id))
with check (public.is_league_admin(league_id));

drop policy if exists "members can read predictions" on public.predictions;
create policy "members can read predictions"
on public.predictions for select
using (
  exists (
    select 1
    from public.topics t
    where t.id = topic_id
      and public.is_league_member(t.league_id)
  )
);

drop policy if exists "players manage own predictions before close" on public.predictions;
create policy "players manage own predictions before close"
on public.predictions for all
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.topics t
    join public.league_members lm on lm.league_id = t.league_id
    where t.id = topic_id
      and lm.user_id = auth.uid()
      and lm.is_active = true
      and now() < t.close_at
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.topics t
    join public.league_members lm on lm.league_id = t.league_id
    where t.id = topic_id
      and lm.user_id = auth.uid()
      and lm.is_active = true
      and now() < t.close_at
  )
);

drop policy if exists "authenticated users can read settlements" on public.settlements;
create policy "authenticated users can read settlements"
on public.settlements for select
to authenticated
using (true);

drop policy if exists "admins manage settlements" on public.settlements;
create policy "admins manage settlements"
on public.settlements for all
using (
  exists (
    select 1
    from public.topics t
    where t.id = topic_id
      and public.is_league_admin(t.league_id)
  )
)
with check (
  exists (
    select 1
    from public.topics t
    where t.id = topic_id
      and public.is_league_admin(t.league_id)
  )
);

drop policy if exists "authenticated users can read winner rows" on public.settlement_winners;
create policy "authenticated users can read winner rows"
on public.settlement_winners for select
to authenticated
using (true);

drop policy if exists "admins manage winner rows" on public.settlement_winners;
create policy "admins manage winner rows"
on public.settlement_winners for all
using (
  exists (
    select 1
    from public.settlements s
    join public.topics t on t.id = s.topic_id
    where s.id = settlement_id
      and public.is_league_admin(t.league_id)
  )
)
with check (
  exists (
    select 1
    from public.settlements s
    join public.topics t on t.id = s.topic_id
    where s.id = settlement_id
      and public.is_league_admin(t.league_id)
  )
);

drop policy if exists "authenticated users can read announcement logs" on public.announcement_logs;
create policy "authenticated users can read announcement logs"
on public.announcement_logs for select
to authenticated
using (true);

drop policy if exists "admins manage announcement logs" on public.announcement_logs;
create policy "admins manage announcement logs"
on public.announcement_logs for all
using (
  exists (
    select 1
    from public.topics t
    where t.id = topic_id
      and public.is_league_admin(t.league_id)
  )
)
with check (
  exists (
    select 1
    from public.topics t
    where t.id = topic_id
      and public.is_league_admin(t.league_id)
  )
);
