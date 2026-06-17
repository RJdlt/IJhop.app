-- Overzicht uitgebreid (users_30d + active_5m) en opschonen van test-events.
-- Draai dit ná 0004 in de Supabase SQL-editor.

create or replace function public.analytics_overview()
returns json language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select json_build_object(
    'users_total',    (select count(distinct user_id) from analytics_events),
    'users_today',    (select count(distinct user_id) from analytics_events where created_at >= date_trunc('day', now())),
    'users_7d',       (select count(distinct user_id) from analytics_events where created_at >= now() - interval '7 days'),
    'users_30d',      (select count(distinct user_id) from analytics_events where created_at >= now() - interval '30 days'),
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
                        from analytics_events where name = 'game_over' and props ? 'score'),
    'active_5m',      (select count(distinct user_id) from analytics_events where created_at > now() - interval '5 minutes')
  ) into result;
  return result;
end; $$;

-- Verwijder test-events (session_id begint met 'test-'). Admin-only.
create or replace function public.admin_delete_test_events()
returns json language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.analytics_events where session_id like 'test-%';
  get diagnostics n = row_count;
  return json_build_object('deleted', n);
end; $$;

grant execute on function public.admin_delete_test_events() to authenticated;
