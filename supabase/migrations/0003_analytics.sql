-- Analytics + admin-dashboard voor IJhop.
-- Draai dit in de Supabase SQL-editor.

-- 1) Events ------------------------------------------------------------------
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  session_id text,
  name text not null,
  props jsonb,
  path text,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at);
create index if not exists analytics_events_name_idx on public.analytics_events (name, created_at);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id);
create index if not exists analytics_events_user_idx on public.analytics_events (user_id);

alter table public.analytics_events enable row level security;

-- Iedereen (ook anoniem ingelogd) mag z'n eigen events schrijven.
drop policy if exists analytics_insert_own on public.analytics_events;
create policy analytics_insert_own on public.analytics_events
  for insert to authenticated
  with check (auth.uid() = user_id);

-- 2) Admins ------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists admins_select_self on public.admins;
create policy admins_select_self on public.admins
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Admins mogen alle events lezen (voor losse queries als je wilt).
drop policy if exists analytics_select_admin on public.analytics_events;
create policy analytics_select_admin on public.analytics_events
  for select to authenticated using (public.is_admin());

-- 3) Aggregaten (admin-only) -------------------------------------------------
create or replace function public.analytics_overview()
returns json
language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select json_build_object(
    'users_total',    (select count(distinct user_id) from analytics_events),
    'users_today',    (select count(distinct user_id) from analytics_events where created_at >= date_trunc('day', now())),
    'users_7d',       (select count(distinct user_id) from analytics_events where created_at >= now() - interval '7 days'),
    'sessions_total', (select count(distinct session_id) from analytics_events),
    'sessions_today', (select count(distinct session_id) from analytics_events where created_at >= date_trunc('day', now())),
    'events_total',   (select count(*) from analytics_events),
    'events_today',   (select count(*) from analytics_events where created_at >= date_trunc('day', now())),
    'avg_session_sec',(select coalesce(round(avg(extract(epoch from (mx - mn)))), 0)
                        from (select session_id, min(created_at) mn, max(created_at) mx
                              from analytics_events group by session_id) s),
    'game_overs',     (select count(*) from analytics_events where name = 'game_over'),
    'game_starts',    (select count(*) from analytics_events where name = 'game_start'),
    'avg_score',      (select coalesce(round(avg((props->>'score')::numeric), 1), 0)
                        from analytics_events where name = 'game_over' and props ? 'score'),
    'max_score',      (select coalesce(max((props->>'score')::numeric), 0)
                        from analytics_events where name = 'game_over' and props ? 'score')
  ) into result;
  return result;
end; $$;

create or replace function public.analytics_by_name(days int default 30)
returns table(name text, count bigint)
language sql stable security definer set search_path = public as $$
  select name, count(*)::bigint
  from analytics_events
  where public.is_admin() and created_at >= now() - (days || ' days')::interval
  group by name order by count(*) desc;
$$;

create or replace function public.analytics_daily(days int default 30)
returns table(day date, users bigint, sessions bigint, events bigint)
language sql stable security definer set search_path = public as $$
  select date_trunc('day', created_at)::date as day,
         count(distinct user_id)::bigint as users,
         count(distinct session_id)::bigint as sessions,
         count(*)::bigint as events
  from analytics_events
  where public.is_admin() and created_at >= now() - (days || ' days')::interval
  group by 1 order by 1;
$$;

-- Geef de RPC's vrij voor ingelogde clients (de functies checken zelf op admin).
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.analytics_overview() to anon, authenticated;
grant execute on function public.analytics_by_name(int) to anon, authenticated;
grant execute on function public.analytics_daily(int) to anon, authenticated;
