-- 0015: Tijdvenster "Alles" + weekaggregatie voor het admin-dashboard.
-- Draai dit ná 0014 in de Supabase SQL-editor. Idempotent (create or replace).
--
-- Twee wijzigingen aan analytics_dashboard, verder alles identiek aan 0012:
--
-- 1) p_days <= 0 (of null) betekent nu "alles": het venster begint bij het
--    eerste échte event ooit (test-events en, indien uitgesloten, admins
--    tellen daarin niet mee). De bovengrens gaat van 90 naar 3650 dagen.
--    Het venster-object meldt de werkelijke spanwijdte + all_time-vlag.
--
-- 2) Nieuwe `weekly`-reeks: unieke gebruikers/sessies/events per ISO-week
--    (maandag als weekstart, net als date_trunc('week')). Dit MOET hier
--    server-side gebeuren: unieke gebruikers per week is niet af te leiden
--    uit de dagreeks (iemand die maandag én dinsdag komt telt per dag mee,
--    optellen zou dubbeltellen). Lege weken komen als echte nullen terug,
--    zodat een meetgat zichtbaar blijft in plaats van weg te vallen.

create or replace function public.analytics_dashboard(p_days int default 30, p_include_own boolean default false)
returns json
language plpgsql stable security definer set search_path = public as $$
declare
  result json;
  all_time boolean := coalesce(p_days, 30) <= 0;
  d int := least(greatest(coalesce(p_days, 30), 1), 3650);
  today date := (now() at time zone 'Europe/Amsterdam')::date;
  start_day date;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  if all_time then
    -- Vanaf het eerste echte event ooit; zelfde schoonmaakregels als `ev`.
    select coalesce(min((created_at at time zone 'Europe/Amsterdam')::date), today)
      into start_day
      from analytics_events
     where session_id not like 'test-%'
       and (p_include_own or user_id not in (select user_id from public.admins));
  else
    start_day := today - (d - 1);
  end if;

  with ev as ( -- schone events: geen test-data, optioneel zonder admin-activiteit
    select user_id, session_id, name, props, created_at,
           (created_at at time zone 'Europe/Amsterdam') as local_ts
    from analytics_events
    where session_id not like 'test-%'
      and (p_include_own or user_id not in (select user_id from public.admins))
  ),
  win as ( -- het gekozen venster (lokale dagen)
    select * from ev where local_ts::date >= start_day
  ),
  by_day as (
    select local_ts::date as day,
           count(distinct user_id)::int as users,
           count(distinct session_id)::int as sessions,
           count(*)::int as events
    from win group by 1
  ),
  daily as ( -- aangevuld met echte nullen
    select gs.day::date as day,
           coalesce(b.users, 0) as users, coalesce(b.sessions, 0) as sessions, coalesce(b.events, 0) as events
    from generate_series(start_day, today, interval '1 day') gs(day)
    left join by_day b on b.day = gs.day::date
  ),
  by_week as ( -- unieke tellingen per ISO-week (maandag = weekstart)
    select date_trunc('week', local_ts)::date as week_start,
           count(distinct user_id)::int as users,
           count(distinct session_id)::int as sessions,
           count(*)::int as events
    from win group by 1
  ),
  weekly as ( -- ook hier echte nullen voor weken zonder metingen
    select gs.w::date as week_start,
           coalesce(b.users, 0) as users, coalesce(b.sessions, 0) as sessions, coalesce(b.events, 0) as events
    from generate_series(
           date_trunc('week', start_day::timestamp),
           date_trunc('week', today::timestamp),
           interval '1 week') gs(w)
    left join by_week b on b.week_start = gs.w::date
  ),
  sess as ( -- funnel-vlaggen per sessie, genest
    select session_id,
           bool_or(name = 'game_start') as started,
           (bool_or(name = 'game_start') and bool_or(name = 'game_over')) as finished,
           (bool_or(name in ('snack_open', 'game_start'))
            or bool_or(name = 'tab_view' and props->>'view' = 'arcade')) as arcade
    from win group by session_id
  ),
  sdur as ( -- sessieduur, alleen sessies met minstens 2 events (anders is duur 0 per definitie)
    select session_id, extract(epoch from max(created_at) - min(created_at)) as sec
    from win group by session_id having count(*) >= 2
  ),
  hourly as (
    select extract(hour from local_ts)::int as h, count(distinct session_id)::int as c
    from win group by 1
  ),
  dowt as (
    select extract(isodow from local_ts)::int as dd, count(distinct session_id)::int as c
    from win group by 1
  )
  select json_build_object(
    'quality', json_build_object(
      'last_event_at',      (select max(created_at) from analytics_events),
      'last_real_event_at', (select max(created_at) from ev),
      'events_today',       (select count(*) from ev where local_ts::date = today),
      'test_events',        (select count(*) from analytics_events where session_id like 'test-%'),
      'total_events',       (select count(*) from analytics_events),
      'own_included',       p_include_own
    ),
    'life', json_build_object(
      'users_today',   (select count(distinct user_id) from ev where local_ts::date = today),
      'users_7d',      (select count(distinct user_id) from ev where local_ts::date > today - 7),
      'users_30d',     (select count(distinct user_id) from ev where local_ts::date > today - 30),
      'users_total',   (select count(distinct user_id) from ev),
      'sessions_today',(select count(distinct session_id) from ev where local_ts::date = today),
      'sessions_7d',   (select count(distinct session_id) from ev where local_ts::date > today - 7),
      'sessions_per_user_7d', (select round(count(distinct session_id)::numeric
                                / nullif(count(distinct user_id), 0), 2)
                               from ev where local_ts::date > today - 7),
      'active_5m',     (select count(distinct user_id) from ev where created_at > now() - interval '5 minutes'),
      'median_session_sec', (select coalesce(round(percentile_cont(0.5) within group (order by sec)), 0) from sdur),
      'n_dur_sessions',     (select count(*) from sdur)
    ),
    'window', json_build_object(
      'days',     (today - start_day) + 1,
      'all_time', all_time,
      'start_day', start_day,
      'events',   (select count(*) from win),
      'users',    (select count(distinct user_id) from win),
      'sessions', (select count(distinct session_id) from win)
    ),
    'daily', (select json_agg(json_build_object('day', day, 'users', users, 'sessions', sessions, 'events', events) order by day) from daily),
    'weekly', (select json_agg(json_build_object('week_start', week_start, 'users', users, 'sessions', sessions, 'events', events) order by week_start) from weekly),
    'funnel', json_build_object(
      'sessions', (select count(*) from sess),
      'arcade',   (select count(*) from sess where arcade or started),
      'started',  (select count(*) from sess where started),
      'finished', (select count(*) from sess where finished)
    ),
    'hourly', (select json_agg(coalesce(h2.c, 0) order by gs.h) from generate_series(0, 23) gs(h) left join hourly h2 on h2.h = gs.h),
    'dow',    (select json_agg(coalesce(d2.c, 0) order by gs.dd) from generate_series(1, 7) gs(dd) left join dowt d2 on d2.dd = gs.dd),
    'tabs', (select coalesce(json_agg(t), '[]'::json) from (
      select props->>'view' as value, count(distinct user_id)::int as users, count(*)::int as events
      from win where name = 'tab_view' and props ? 'view' group by 1 order by 2 desc limit 12) t),
    'ferries', (select coalesce(json_agg(t), '[]'::json) from (
      select props->>'key' as value, count(distinct user_id)::int as users, count(*)::int as events
      from win where name = 'ferry_pick' and props ? 'key' group by 1 order by 2 desc limit 12) t),
    'characters', (select coalesce(json_agg(t), '[]'::json) from (
      select props->>'id' as value, count(distinct user_id)::int as users, count(*)::int as events
      from win where name = 'character_select' and props ? 'id' group by 1 order by 2 desc limit 12) t),
    'devices', (select coalesce(json_agg(t), '[]'::json) from (
      select props->>'standalone' as value, count(distinct user_id)::int as users, count(*)::int as events
      from win where name = 'session_start' and props ? 'standalone' group by 1 order by 2 desc limit 12) t)
  ) into result;

  return result;
end; $$;

grant execute on function public.analytics_dashboard(int, boolean) to authenticated;
