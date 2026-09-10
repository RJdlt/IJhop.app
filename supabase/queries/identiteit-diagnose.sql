-- Diagnose: wisselt `user_id` per bezoek?
--
-- Plak dit blok voor blok in de Supabase SQL-editor (als eigenaar, dus RLS
-- speelt geen rol). Elk blok staat los; je kunt ze ook allemaal tegelijk
-- draaien, dan krijg je meerdere resultaattabbladen.
--
-- Waar je op let: is A hoog (veel gebruikers met precies één event) en zijn
-- de aantallen in B klein, dan krijgt bijna elk bezoek een vers id en meet
-- "retentie" niets anders dan hoe vaak opslag overleeft.

-- A. Hoeveel gebruikers hebben precies 1 event, 2-5, 6-20, meer?
with per_user as (
  select user_id, count(*) as n
  from analytics_events
  where session_id not like 'test-%'
  group by user_id
)
select case when n = 1 then '1 event'
            when n between 2 and 5 then '2-5 events'
            when n between 6 and 20 then '6-20 events'
            else '21+ events' end as bucket,
       count(*) as gebruikers,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from per_user
group by 1
order by min(n);

-- B. Hoeveel dagen zit er tussen het eerste en laatste event per gebruiker?
-- Een id dat langer dan een dag meegaat, heeft de opslag overleefd.
with per_user as (
  select user_id,
         max(created_at) - min(created_at) as span
  from analytics_events
  where session_id not like 'test-%'
  group by user_id
)
select case when span < interval '1 minute'  then 'onder 1 minuut'
            when span < interval '1 hour'    then 'onder 1 uur'
            when span < interval '1 day'     then 'onder 1 dag'
            when span < interval '7 days'    then '1-7 dagen'
            else '7 dagen of langer' end as levensduur,
       count(*) as gebruikers
from per_user
group by 1
order by min(span);

-- C. Sessies zonder session_start. Die ontstaan als de eerste insert
-- mislukte of als de sessie al liep voor de meting begon; ze tellen wel
-- gewoon mee in "sessies per gebruiker" (dat telt sessie-ids met minstens
-- één event, niet alleen sessies met een session_start).
with per_session as (
  select session_id,
         bool_or(name = 'session_start') as heeft_start,
         count(*) as n
  from analytics_events
  where session_id not like 'test-%'
  group by session_id
)
select count(*) filter (where not heeft_start) as zonder_session_start,
       count(*)                                as sessies_totaal,
       round(100.0 * count(*) filter (where not heeft_start) / nullif(count(*), 0), 1) as pct
from per_session;

-- D. Gebruikers per sessie-aantal: hoeveel mensen kwamen ooit in meer dan
-- één sessie terug? Dit is retentie zonder datumvenster.
with per_user as (
  select user_id, count(distinct session_id) as sessies
  from analytics_events
  where session_id not like 'test-%'
  group by user_id
)
select sessies, count(*) as gebruikers
from per_user
group by 1
order by 1
limit 20;

-- E. Hoeveel van het verkeer komt uit een geïnstalleerde PWA? Die groep
-- valt buiten Safari's opruiming van opslag, dus daar hoort het id wel te
-- blijven staan.
select props->>'standalone' as geinstalleerd,
       count(distinct user_id) as gebruikers,
       count(*) as sessies
from analytics_events
where name = 'session_start' and session_id not like 'test-%'
group by 1 order by 2 desc;
