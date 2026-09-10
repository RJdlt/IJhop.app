-- 0026: de aankomstplanner. Routing-cache, dagverbruik en herinneringen.
-- Draai dit in de Supabase SQL-editor, na 0019 tot en met 0025. Volledige
-- vervanging van analytics_dashboard, zoals eerder: alles uit de vorige
-- migraties zit hierin.
--
-- Drie tabellen en één dashboardblok.
--
-- `routing_cache` bewaart reistijden per (van, naar, modus) zeven dagen. De
-- coördinaten zijn afgerond op ongeveer elf meter, dus twee mensen op dezelfde
-- hoek delen één antwoord. De steigerparen zijn eindig; na een paar dagen komt
-- bijna alles hieruit.
--
-- `routing_usage` telt per dag hoeveel er uit de cache kwam, hoeveel er bij
-- OpenRouteService is opgehaald en hoeveel er geschat moest worden. ORS geeft
-- 2.000 verzoeken per dag op de gratis laag; zonder deze teller merk je pas
-- dat de emmer leeg is als de planner op een woensdagavond stilvalt.
--
-- `reminders` is de vertrek-nu-melding. Eén actieve per gebruiker, afgedwongen
-- met een unieke index en niet met code.
--
-- Alle drie staan achter RLS zonder policies: de app praat er via functies
-- mee, en de servercode gebruikt de service-role-sleutel die RLS overslaat.

-- ---- Routing ----------------------------------------------------------------

create table if not exists public.routing_cache (
  cache_key text primary key,
  seconds int not null,
  created_at timestamptz not null default now()
);
create index if not exists routing_cache_age_idx on public.routing_cache (created_at);

create table if not exists public.routing_usage (
  day date primary key,
  hits int not null default 0,
  ors int not null default 0,
  estimates int not null default 0
);

alter table public.routing_cache enable row level security;
alter table public.routing_usage enable row level security;

/* Bijtellen in één aanroep, zodat twee gelijktijdige planningen elkaars
   telling niet overschrijven. */
create or replace function public.routing_tally(p_hits int, p_ors int, p_estimates int)
returns void language sql volatile security definer set search_path = public as $$
  insert into public.routing_usage (day, hits, ors, estimates)
  values ((now() at time zone 'Europe/Amsterdam')::date,
          greatest(0, coalesce(p_hits, 0)),
          greatest(0, coalesce(p_ors, 0)),
          greatest(0, coalesce(p_estimates, 0)))
  on conflict (day) do update
    set hits = public.routing_usage.hits + excluded.hits,
        ors = public.routing_usage.ors + excluded.ors,
        estimates = public.routing_usage.estimates + excluded.estimates;
$$;

/* Hoeveel verzoeken zitten er vandaag nog in de emmer? De servercode vraagt
   dit vóór het opvragen en schat de rest zodra het op is. */
create or replace function public.routing_budget_left(p_limit int default 2000)
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, p_limit - coalesce(
    (select ors from public.routing_usage
      where day = (now() at time zone 'Europe/Amsterdam')::date), 0));
$$;

/* Opportunistisch opruimen: wat ouder is dan zeven dagen mag weg. Geen cron
   nodig, de tabel blijft vanzelf klein. */
create or replace function public.routing_cache_sweep()
returns void language sql volatile security definer set search_path = public as $$
  delete from public.routing_cache where created_at < now() - interval '7 days';
$$;

-- ---- Herinneringen -----------------------------------------------------------

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  fire_at timestamptz not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  error text
);
create index if not exists reminders_due_idx on public.reminders (fire_at)
  where sent_at is null and failed_at is null;

/* Eén openstaande herinnering per gebruiker. In de database afgedwongen, want
   twee tabbladen kunnen tegelijk op "Herinner me" tikken. */
create unique index if not exists reminders_een_per_gebruiker
  on public.reminders (user_id) where sent_at is null and failed_at is null;

alter table public.reminders enable row level security;

drop policy if exists "eigen herinnering lezen" on public.reminders;
create policy "eigen herinnering lezen" on public.reminders for select
  using (user_id = auth.uid());

/* Zet of vervang de herinnering van deze gebruiker. Vervangen en niet
   toevoegen: wie een tweede optie kiest bedoelt die, niet allebei. */
create or replace function public.set_reminder(p_fire_at timestamptz, p_title text, p_body text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  nieuw uuid;
begin
  if uid is null then raise exception 'inloggen vereist'; end if;
  if p_fire_at is null then raise exception 'geen tijdstip'; end if;
  if p_fire_at < now() - interval '1 minute' then raise exception 'dat tijdstip is voorbij'; end if;
  if p_fire_at > now() + interval '2 days' then raise exception 'dat ligt te ver vooruit'; end if;

  delete from public.reminders
   where user_id = uid and sent_at is null and failed_at is null;

  insert into public.reminders (user_id, fire_at, title, body)
  values (uid, p_fire_at, coalesce(nullif(trim(p_title), ''), 'Vertrek nu'),
          coalesce(nullif(trim(p_body), ''), ''))
  returning id into nieuw;

  return json_build_object('ok', true, 'id', nieuw, 'fire_at', p_fire_at);
end; $$;

create or replace function public.cancel_reminder()
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  weg int;
begin
  if uid is null then raise exception 'inloggen vereist'; end if;
  delete from public.reminders
   where user_id = uid and sent_at is null and failed_at is null;
  get diagnostics weg = row_count;
  return json_build_object('ok', true, 'removed', weg);
end; $$;

/* Wat staat er voor mij klaar? Voor de knopstand na een herstart van de app. */
create or replace function public.my_reminder()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  r public.reminders;
begin
  select * into r from public.reminders
   where user_id = auth.uid() and sent_at is null and failed_at is null
   order by fire_at limit 1;
  if r.id is null then return null; end if;
  return json_build_object('id', r.id, 'fire_at', r.fire_at, 'title', r.title, 'body', r.body);
end; $$;

grant execute on function public.set_reminder(timestamptz, text, text) to authenticated;
grant execute on function public.cancel_reminder() to authenticated;
grant execute on function public.my_reminder() to authenticated;
revoke all on function public.routing_tally(int, int, int) from public, anon, authenticated;
revoke all on function public.routing_budget_left(int) from public, anon;
revoke all on function public.routing_cache_sweep() from public, anon, authenticated;
grant execute on function public.routing_budget_left(int) to authenticated;

-- ---- Het dashboard: planner en ORS-verbruik ---------------------------------
--
-- Twee blokken erbij.
--
-- `planner`: gebruik per dag, en hoeveel mensen een herinnering zetten. Het
-- aantal daadwerkelijk verstuurde herinneringen komt uit de tabel en niet uit
-- een event, want alleen daar staat wat de server echt de deur uit deed. Een
-- event dat de app stuurt zegt hooguit dat iemand op de knop drukte.
--
-- `routing`: het ORS-verbruik van vandaag naast de daglimiet, plus de
-- cache-hit-rate en de laatste veertien dagen. Dit is het blok waarmee je
-- ziet aankomen dat de emmer leegloopt, in plaats van het te merken doordat de
-- planner op een woensdagavond alleen nog schattingen geeft.

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
    select coalesce(props->>'deal_id', 'onbekend') as deal_id, name, user_id,
           coalesce(props->>'card_mode', 'onbekend') as card_mode,
           coalesce(props->>'has_photo', 'onbekend') as has_photo
    from win
    where name in ('deal_seen', 'deal_claim', 'deal_code_shown')
  ),
  strip_ev as ( -- de strook boven de klok, los van de kaart eronder
    select coalesce(props->>'card_mode', 'onbekend') as card_mode, name, user_id
    from win
    where name in ('deal_strip_seen', 'deal_strip_tap')
  ),
  deal_by_strip as (
    select card_mode,
           count(distinct user_id) filter (where name = 'deal_strip_seen')::int as seen,
           count(distinct user_id) filter (where name = 'deal_strip_tap')::int as claimed
    from strip_ev group by card_mode
  ),
  deal_by_mode as ( -- werkt de compacte kaart net zo goed als de volledige?
    select card_mode,
           count(distinct user_id) filter (where name = 'deal_seen')::int as seen,
           count(distinct user_id) filter (where name = 'deal_claim')::int as claimed
    from deal_ev where card_mode <> 'onbekend' group by card_mode
  ),
  deal_by_photo as ( -- en doet de foto er iets toe?
    select has_photo,
           count(distinct user_id) filter (where name = 'deal_seen')::int as seen,
           count(distinct user_id) filter (where name = 'deal_claim')::int as claimed
    from deal_ev where has_photo in ('true', 'false') group by has_photo
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
  planner_ev as ( -- de aankomstplanner, per dag
    select local_ts::date as day, name, user_id, props
    from win
    where name like 'planner_%'
  ),
  planner_daily as (
    select day,
           count(distinct user_id) filter (where name = 'planner_open')::int as opened,
           count(distinct user_id) filter (where name = 'planner_result')::int as results,
           count(*) filter (where name = 'planner_result' and props->>'fallback' = 'true')::int as fallbacks,
           count(distinct user_id) filter (where name = 'planner_reminder_set')::int as reminders_set
    from planner_ev group by day
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
      'by_mode', (select coalesce(json_agg(json_build_object(
                    'value', card_mode, 'seen', seen, 'claimed', claimed) order by seen desc), '[]'::json)
                  from deal_by_mode),
      'by_strip', (select coalesce(json_agg(json_build_object(
                     'value', card_mode, 'seen', seen, 'claimed', claimed) order by seen desc), '[]'::json)
                   from deal_by_strip),
      'by_photo', (select coalesce(json_agg(json_build_object(
                     'value', has_photo, 'seen', seen, 'claimed', claimed) order by has_photo desc), '[]'::json)
                   from deal_by_photo),
      'return', (select json_build_object(
                   'with_deal', met_deal, 'with_deal_returned', met_deal_terug,
                   'without_deal', zonder_deal, 'without_deal_returned', zonder_deal_terug)
                 from deal_return)
    ),
    'versions', (select coalesce(json_agg(json_build_object(
                   'version', version, 'users', users, 'sessions', sessions,
                   'first_seen', first_seen, 'last_seen', last_seen) order by first_seen desc), '[]'::json)
                 from versies),
    'planner', json_build_object(
      'daily', (select coalesce(json_agg(json_build_object(
                  'day', day, 'opened', opened, 'results', results,
                  'fallbacks', fallbacks, 'reminders_set', reminders_set) order by day), '[]'::json)
                from planner_daily),
      'opened',        (select count(distinct user_id)::int from win where name = 'planner_open'),
      'results',       (select count(distinct user_id)::int from win where name = 'planner_result'),
      'reminders_set', (select count(distinct user_id)::int from win where name = 'planner_reminder_set'),
      -- Verstuurd komt uit de tabel en niet uit een event: alleen daar staat
      -- wat de server echt de deur uit heeft gedaan.
      'reminders_sent', (select count(*)::int from public.reminders
                          where sent_at is not null and sent_at >= start_day::timestamptz),
      'reminders_failed', (select count(*)::int from public.reminders
                            where failed_at is not null and failed_at >= start_day::timestamptz),
      'reminders_open', (select count(*)::int from public.reminders
                          where sent_at is null and failed_at is null)
    ),
    'routing', (select json_build_object(
      'limit', 2000,
      'today', json_build_object(
        'hits', coalesce(u.hits, 0), 'ors', coalesce(u.ors, 0), 'estimates', coalesce(u.estimates, 0)),
      'cached_routes', (select count(*)::int from public.routing_cache),
      'days', (select coalesce(json_agg(json_build_object(
                 'day', day, 'hits', hits, 'ors', ors, 'estimates', estimates) order by day), '[]'::json)
               from public.routing_usage
               where day >= (now() at time zone 'Europe/Amsterdam')::date - 13)
    ) from (select * from public.routing_usage
             where day = (now() at time zone 'Europe/Amsterdam')::date) u
    -- Zonder rij van vandaag valt de subquery weg; dan bouwen we hem leeg op.
    union all
    select json_build_object(
      'limit', 2000,
      'today', json_build_object('hits', 0, 'ors', 0, 'estimates', 0),
      'cached_routes', (select count(*)::int from public.routing_cache),
      'days', (select coalesce(json_agg(json_build_object(
                 'day', day, 'hits', hits, 'ors', ors, 'estimates', estimates) order by day), '[]'::json)
               from public.routing_usage
               where day >= (now() at time zone 'Europe/Amsterdam')::date - 13)
    )
    where not exists (select 1 from public.routing_usage
                       where day = (now() at time zone 'Europe/Amsterdam')::date)
    limit 1),
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

-- ---- Nog één keer met de hand -----------------------------------------------
--
-- De cron staat niet in dit bestand omdat er een secret in moet, en dat hoort
-- niet in git. Draai het onderstaande apart in de SQL-editor, met jouw eigen
-- CRON_SECRET (dezelfde die in Vercel staat) op de plek van <<CRON_SECRET>>.
--
-- pg_cron plant alleen SQL en kan zelf geen HTTP; het aanroepen van onze
-- endpoint gaat via pg_net. Vandaar allebei de extensies.
--
--   create extension if not exists pg_net;
--   create extension if not exists pg_cron;
--
--   select cron.schedule(
--     'ijhop-herinneringen',
--     '* * * * *',
--     $cron$
--       select net.http_get(
--         url := 'https://ijhop.app/api/reminder-check',
--         headers := jsonb_build_object('Authorization', 'Bearer <<CRON_SECRET>>'),
--         timeout_milliseconds := 20000
--       );
--     $cron$
--   );
--
-- De secret gaat in de Authorization-header en niet in de URL: een URL met een
-- secret erin komt in cron.job_run_details te staan en in elke log ertussen.
--
-- Controleren of hij loopt:
--   select jobname, schedule, active from cron.job;
--   select status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 10;
--
-- Weghalen of opnieuw zetten (unschedule eerst; schedule met dezelfde naam
-- vervangt niet, die maakt een tweede job):
--   select cron.unschedule('ijhop-herinneringen');
