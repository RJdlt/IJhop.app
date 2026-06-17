-- Retentie / terugkerende bezoekers. Draai dit ná 0008 in de Supabase SQL-editor.

create or replace function public.analytics_retention(days int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  with win as (
    select user_id, created_at from public.analytics_events
    where created_at >= now() - (days || ' days')::interval
  ),
  ud as ( -- aantal actieve dagen per gebruiker binnen het venster
    select user_id, count(distinct (created_at at time zone 'Europe/Amsterdam')::date) d
    from win group by user_id
  ),
  firstseen as ( -- allereerste activiteit ooit per gebruiker
    select user_id, min(created_at) f from public.analytics_events group by user_id
  )
  select json_build_object(
    'users',           (select count(*) from ud),
    'returning_users', (select count(*) from ud where d >= 2),
    'returning_rate',  (select case when count(*) = 0 then 0
                                    else round(100.0 * count(*) filter (where d >= 2) / count(*)) end from ud),
    'new_today',       (select count(*) from firstseen where f >= date_trunc('day', now())),
    'returning_today', (select count(distinct e.user_id)
                         from public.analytics_events e
                         join firstseen fs on fs.user_id = e.user_id
                         where e.created_at >= date_trunc('day', now())
                           and fs.f < date_trunc('day', now())),
    'dau',             (select count(distinct user_id) from public.analytics_events where created_at >= date_trunc('day', now())),
    'mau',             (select count(distinct user_id) from public.analytics_events where created_at >= now() - interval '30 days')
  ) into result;
  return result;
end; $$;

grant execute on function public.analytics_retention(int) to authenticated;
