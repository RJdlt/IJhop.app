-- 0014: Web-push-abonnementen voor storingsmeldingen. Idempotent.
-- Draai dit ná 0013 in de Supabase SQL-editor.
--
-- Ontwerp:
-- * Abonnementen worden alleen door onze serverless functies gelezen en
--   geschreven (service-role sleutel); RLS staat aan zonder policies, dus
--   clients kunnen er nooit bij.
-- * push_sent onthoudt welke storing al verstuurd is (elke storing maximaal
--   één melding, geen spam bij elke controle-ronde).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- Favoriete lijnen van deze abonnee ('F4', ...); alleen daarvoor melden.
  lines text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_ok timestamptz
);

create table if not exists public.push_sent (
  alert_id text primary key,
  sent_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.push_sent enable row level security;
-- Bewust géén policies: alleen de service-role (serverless) mag erbij.
