-- 0023: appversies in het dashboard. Volledige vervanging, zoals eerder.
-- Draai dit in de Supabase SQL-editor, na 0019 tot en met 0022. Alles uit die
-- migraties zit hierin, dus dit ene bestand volstaat.
--
-- Wat erbij komt: `versions`. Elk analytics-event draagt sinds deze build de
-- commit-hash van de app mee in `props.app_version`. Per versie tellen we
-- unieke gebruikers en sessies, plus wanneer die versie voor het eerst en
-- voor het laatst van zich liet horen.
--
-- De nieuwste versie herken je aan `first_seen`: een build verschijnt op het
-- moment van deployen en daarvoor nooit. `last_seen` is niet bruikbaar als
-- volgorde, want een oude versie blijft events sturen zolang er toestellen op
-- draaien; dat is juist wat we willen zien.
--
-- Events van voor deze build hebben geen `app_version` en tellen niet mee in
-- dit blok; die vallen vanzelf uit het venster.

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
  deal_ev as ( -- de drie stappen die uit de app komen, per deal
    select coalesce(props->>'deal_id', 'onbekend') as deal_id, name, user_id
    from win
    where name in ('deal_seen', 'deal_claim', 'deal_code_shown')
  ),
  deal_funnel as (
    select deal_id,
           count(distinct user_id) filter (where name = 'deal_seen')::int as seen,
           count(distinct user_id) filter (where name = 'deal_claim')::int as claimed,
           count(distinct user_id) filter (where name = 'deal_code_shown')::int as shown
    from deal_ev group by deal_id
  ),
  deal_rows as ( -- alle deals die in het venster liepen, met partner en steiger
    select d.id::text as deal_id, d.offer, d.stop_id, p.name as partner,
           d.valid_from, d.valid_to,
           (select count(*)::int from public.deal_codes c
             where c.deal_id = d.id and not c.preview) as codes,
           (select count(*)::int from public.deal_codes c
             where c.deal_id = d.id and c.redeemed_at is not null and not c.preview) as redeemed
    from public.deals d
    join public.partners p on p.id = d.partner_id
    where d.valid_to >= start_day::timestamptz
  ),
  code_weeks as ( -- in welke week pakte iemand een code?
    select date_trunc('week', (c.created_at at time zone 'Europe/Amsterdam'))::date as week_start,
           c.user_id
    from public.deal_codes c
    where not c.preview
    group by 1, 2
  ),
  active_weeks as ( -- in welke week was iemand actief in de app?
    select date_trunc('week', local_ts)::date as week_start, user_id
    from ev group by 1, 2
  ),
  return_base as ( -- per actieve gebruiker per week: had hij een code, en kwam hij terug?
    select a.week_start,
           a.user_id,
           (cw.user_id is not null) as had_deal,
           exists (select 1 from active_weeks a2
                    where a2.user_id = a.user_id and a2.week_start = a.week_start + 7) as kwam_terug
    from active_weeks a
    left join code_weeks cw on cw.user_id = a.user_id and cw.week_start = a.week_start
    -- Alleen weken waarvan de week erna al voorbij is.
    where a.week_start + 14 <= today
  ),
  deal_return as (
    select count(*) filter (where had_deal)::int as met_deal,
           count(*) filter (where had_deal and kwam_terug)::int as met_deal_terug,
           count(*) filter (where not had_deal)::int as zonder_deal,
           count(*) filter (where not had_deal and kwam_terug)::int as zonder_deal_terug
    from return_base
  ),
  versies as ( -- welke appversie draaien de toestellen in dit venster?
    select coalesce(props->>'app_version', 'onbekend') as version,
           count(distinct user_id)::int as users,
           count(distinct session_id)::int as sessions,
           min(created_at) as first_seen,
           max(created_at) as last_seen
    from win
    where props ? 'app_version'
    group by 1
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
    'deals', json_build_object(
      'rows', (select coalesce(json_agg(json_build_object(
                 'deal_id', r.deal_id, 'offer', r.offer, 'partner', r.partner,
                 'stop_id', r.stop_id, 'valid_from', r.valid_from, 'valid_to', r.valid_to,
                 'seen', coalesce(f.seen, 0), 'claimed', coalesce(f.claimed, 0),
                 'shown', coalesce(f.shown, 0), 'codes', r.codes, 'redeemed', r.redeemed)
                 order by r.valid_from desc), '[]'::json)
               from deal_rows r left join deal_funnel f on f.deal_id = r.deal_id),
      'by_stop', (select coalesce(json_agg(t), '[]'::json) from (
                    select r.stop_id as value,
                           sum(coalesce(f.seen, 0))::int as seen,
                           sum(coalesce(f.claimed, 0))::int as claimed,
                           sum(r.redeemed)::int as redeemed
                    from deal_rows r left join deal_funnel f on f.deal_id = r.deal_id
                    group by r.stop_id order by 2 desc limit 12) t),
      'return', (select json_build_object(
                   'with_deal', met_deal, 'with_deal_returned', met_deal_terug,
                   'without_deal', zonder_deal, 'without_deal_returned', zonder_deal_terug)
                 from deal_return)
    ),
    'versions', (select coalesce(json_agg(json_build_object(
                   'version', version, 'users', users, 'sessions', sessions,
                   'first_seen', first_seen, 'last_seen', last_seen) order by first_seen desc), '[]'::json)
                 from versies),
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
