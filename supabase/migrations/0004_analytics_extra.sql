-- Extra analytics-RPC's voor het uitgebreide dashboard.
-- Draai dit ná 0003 in de Supabase SQL-editor.

-- Activiteit per uur van de dag (Amsterdamse tijd).
create or replace function public.analytics_hourly(days int default 7)
returns table(hour int, count bigint)
language sql stable security definer set search_path = public as $$
  select extract(hour from created_at at time zone 'Europe/Amsterdam')::int as hour,
         count(*)::bigint
  from analytics_events
  where public.is_admin() and created_at >= now() - (days || ' days')::interval
  group by 1 order by 1;
$$;

-- Activiteit per weekdag (1 = maandag .. 7 = zondag).
create or replace function public.analytics_dow(days int default 30)
returns table(dow int, count bigint)
language sql stable security definer set search_path = public as $$
  select extract(isodow from created_at at time zone 'Europe/Amsterdam')::int as dow,
         count(*)::bigint
  from analytics_events
  where public.is_admin() and created_at >= now() - (days || ' days')::interval
  group by 1 order by 1;
$$;

-- Recente events voor de live-feed.
create or replace function public.analytics_recent(lim int default 40)
returns table(name text, props jsonb, path text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select name, props, path, created_at
  from analytics_events
  where public.is_admin()
  order by created_at desc
  limit lim;
$$;

-- Generieke uitsplitsing: tel een prop-waarde voor een event (bijv. welke pont).
create or replace function public.analytics_prop(p_name text, p_key text, days int default 30)
returns table(value text, count bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(props->>p_key, '(leeg)') as value, count(*)::bigint
  from analytics_events
  where public.is_admin() and name = p_name
        and created_at >= now() - (days || ' days')::interval
  group by 1 order by count(*) desc limit 20;
$$;

-- Live: aantal unieke gebruikers met activiteit in de laatste 5 minuten.
create or replace function public.analytics_live()
returns int
language sql stable security definer set search_path = public as $$
  select case when public.is_admin()
    then (select count(distinct user_id)::int from analytics_events
          where created_at > now() - interval '5 minutes')
    else 0 end;
$$;

-- Funnel per sessie: bezoek -> arcade open -> spel gestart -> game over.
create or replace function public.analytics_funnel(days int default 30)
returns json
language plpgsql stable security definer set search_path = public as $$
declare r json; begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select json_build_object(
    'sessions', count(*),
    'snack',    count(*) filter (where so),
    'started',  count(*) filter (where gs),
    'finished', count(*) filter (where go)
  ) into r
  from (
    select session_id,
      bool_or(name = 'snack_open') so,
      bool_or(name = 'game_start') gs,
      bool_or(name = 'game_over')  go
    from analytics_events
    where created_at >= now() - (days || ' days')::interval
    group by session_id
  ) s;
  return r;
end; $$;

grant execute on function public.analytics_hourly(int) to anon, authenticated;
grant execute on function public.analytics_dow(int) to anon, authenticated;
grant execute on function public.analytics_recent(int) to anon, authenticated;
grant execute on function public.analytics_prop(text, text, int) to anon, authenticated;
grant execute on function public.analytics_live() to anon, authenticated;
grant execute on function public.analytics_funnel(int) to anon, authenticated;
