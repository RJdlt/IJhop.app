-- 0018: installatie-trechter per variant en weekretentie per cohort.
-- Draai dit in de Supabase SQL-editor. Volledige vervanging, zoals 0017: wie
-- 0015, 0016 of 0017 nog niet gedraaid heeft kan direct dit bestand plakken.
--
-- Wat erbij komt:
--
-- 1) `install`: per variant van de A/B-proef hoeveel unieke gebruikers de
--    uitnodiging zagen (`install_prompt_shown`), hoeveel er wegklikten
--    (`install_prompt_dismissed`), hoeveel de iOS-uitleg openden
--    (`install_prompt_ios_help_opened`) en hoeveel er installeerden
--    (`installed`). Tellen op gebruiker en niet op event, want dezelfde
--    persoon kan de uitnodiging in meerdere sessies zien.
--
--    De variant komt uit de props van het event zelf. Zo blijft een gebruiker
--    ook meetellen als hij later opnieuw wordt ingedeeld (na gewiste opslag
--    bijvoorbeeld); we meten de vertoning, niet de persoon.
--
-- 2) `cohorts`: weekretentie. Rijen zijn de week waarin een gebruiker voor het
--    eerst gezien werd, kolommen de weken 1 tot en met 4 daarna, cel is het
--    aantal gebruikers uit dat cohort met minstens één sessie in die week.
--    `size` is de omvang van het cohort, `weeks[k]` is null zolang die week
--    nog niet voorbij is (anders lijkt een jong cohort slecht te presteren).
--
--    Week 0 (de startweek zelf) staat er niet in: dat is per definitie 100%.
--    We kijken maximaal twaalf cohorten terug.
--
--    Let op bij het lezen: dit meet gebruikers-ids, niet mensen. Zolang
--    iemands opslag gewist kan worden ligt de gemeten retentie lager dan de
--    echte. Zie docs/besluit-pwa-grenzen.md.

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
  first_seen as ( -- állereerste event per gebruiker, ook van vóór het venster
    select user_id, date_trunc('week', min(local_ts))::date as first_week
    from ev group by user_id
  ),
  week_users as ( -- welke gebruiker was in welke week actief (binnen het venster)
    select date_trunc('week', local_ts)::date as week_start, user_id
    from win group by 1, 2
  ),
  by_newret as (
    select wu.week_start,
           count(*) filter (where fs.first_week >= wu.week_start)::int as nieuw,
           count(*) filter (where fs.first_week <  wu.week_start)::int as terugkerend
    from week_users wu
    join first_seen fs on fs.user_id = wu.user_id
    group by 1
  ),
  newret as ( -- lege weken ook hier als echte nullen
    select gs.w::date as week_start,
           coalesce(b.nieuw, 0) as nieuw, coalesce(b.terugkerend, 0) as terugkerend
    from generate_series(
           date_trunc('week', start_day::timestamp),
           date_trunc('week', today::timestamp),
           interval '1 week') gs(w)
    left join by_newret b on b.week_start = gs.w::date
  ),
  newret_summary as ( -- terugkerend = in minstens één week van het venster niet nieuw
    select count(distinct wu.user_id)::int as users,
           count(distinct wu.user_id) filter (where fs.first_week < wu.week_start)::int as returning_users
    from week_users wu
    join first_seen fs on fs.user_id = wu.user_id
  ),
  sess as ( -- funnel-vlaggen per sessie, genest
    select session_id,
           bool_or(name = 'heartbeat'
                   or name in ('ferry_pick', 'delay_report', 'disruption_dismiss',
                               'disruption_link', 'ontmoeting_join', 'ontmoeting_found',
                               'ontmoeting_matched', 'push_subscribe')) as clock,
           bool_or(name = 'push_subscribe') as notified
    from win group by session_id
  ),
  sdur as ( -- alleen sessies waar we echt een tijdsspanne zagen (>= 5 seconden)
    select session_id, extract(epoch from max(created_at) - min(created_at)) as sec
    from win group by session_id
    having count(*) >= 2
       and extract(epoch from max(created_at) - min(created_at)) >= 5
  ),
  ivar as ( -- install-events met hun variant; alleen wat een variant meestuurt
    select user_id, name, coalesce(props->>'variant', 'onbekend') as variant
    from win
    where name in ('install_prompt_shown', 'install_prompt_dismissed',
                   'install_prompt_ios_help_opened', 'installed')
  ),
  install as (
    select variant,
           count(distinct user_id) filter (where name = 'install_prompt_shown')::int as shown,
           count(distinct user_id) filter (where name = 'install_prompt_dismissed')::int as dismissed,
           count(distinct user_id) filter (where name = 'install_prompt_ios_help_opened')::int as ios_help,
           count(distinct user_id) filter (where name = 'installed')::int as installed
    from ivar group by variant
  ),
  cohort_first as ( -- eerste week ooit per gebruiker, ook van voor het venster
    select user_id, date_trunc('week', min(local_ts))::date as w0
    from ev group by user_id
  ),
  cohort_weeks as ( -- de laatste twaalf cohorten, jongste eerst weggesneden
    select w0, count(*)::int as size
    from cohort_first
    where w0 >= date_trunc('week', (today - 84)::timestamp)::date
    group by w0
  ),
  cohort_act as ( -- actieve gebruikers per cohort en per week erna
    select cf.w0,
           ((date_trunc('week', e.local_ts)::date - cf.w0) / 7)::int as wk,
           count(distinct e.user_id)::int as users
    from ev e
    join cohort_first cf on cf.user_id = e.user_id
    where cf.w0 >= date_trunc('week', (today - 84)::timestamp)::date
    group by 1, 2
  ),
  cohort_rows as (
    select cw.w0, cw.size,
           (select json_agg(
                     case
                       -- week nog niet voorbij: niets te melden
                       when cw.w0 + (k * 7) + 7 > today then null
                       else coalesce((select users from cohort_act a
                                       where a.w0 = cw.w0 and a.wk = k), 0)
                     end order by k)
              from generate_series(1, 4) k) as weeks
    from cohort_weeks cw
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
      'sessions', (select count(distinct session_id) from win),
      'sessions_per_user', (select round(count(distinct session_id)::numeric
                             / nullif(count(distinct user_id), 0), 2) from win),
      'returning_users', (select returning_users from newret_summary),
      'summary_users',   (select users from newret_summary)
    ),
    'daily', (select json_agg(json_build_object('day', day, 'users', users, 'sessions', sessions, 'events', events) order by day) from daily),
    'weekly', (select json_agg(json_build_object('week_start', week_start, 'users', users, 'sessions', sessions, 'events', events) order by week_start) from weekly),
    'newret', (select json_agg(json_build_object('week_start', week_start, 'nieuw', nieuw, 'terugkerend', terugkerend) order by week_start) from newret),
    'funnel', json_build_object(
      'sessions', (select count(*) from sess),
      'clock',    (select count(*) from sess where clock or notified),
      'notified', (select count(*) from sess where notified)
    ),
    'install', (select coalesce(json_agg(json_build_object(
                  'variant', variant, 'shown', shown, 'dismissed', dismissed,
                  'ios_help', ios_help, 'installed', installed) order by variant), '[]'::json)
                from install),
    'cohorts', (select coalesce(json_agg(json_build_object(
                  'week_start', w0, 'size', size, 'weeks', weeks) order by w0 desc), '[]'::json)
                from cohort_rows),
    'hourly', (select json_agg(coalesce(h2.c, 0) order by gs.h) from generate_series(0, 23) gs(h) left join hourly h2 on h2.h = gs.h),
    'dow',    (select json_agg(coalesce(d2.c, 0) order by gs.dd) from generate_series(1, 7) gs(dd) left join dowt d2 on d2.dd = gs.dd),
    'ferries', (select coalesce(json_agg(t), '[]'::json) from (
      select props->>'key' as value, count(distinct user_id)::int as users, count(*)::int as events
      from win where name = 'ferry_pick' and props ? 'key' group by 1 order by 2 desc limit 12) t),
    'devices', (select coalesce(json_agg(t), '[]'::json) from (
      select props->>'standalone' as value, count(distinct user_id)::int as users, count(*)::int as events
      from win where name = 'session_start' and props ? 'standalone' group by 1 order by 2 desc limit 12) t)
  ) into result;

  return result;
end; $$;

grant execute on function public.analytics_dashboard(int, boolean) to authenticated;
