-- Online ranglijst voor de IJhop Arcade.
-- Draai dit eenmalig in de Supabase SQL-editor (of via `supabase db push`).

create table if not exists public.arcade_scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  name text not null check (char_length(name) between 1 and 24),
  score integer not null check (score >= 0 and score < 1000000),
  user_id uuid,
  created_at timestamptz not null default now()
);

-- Snel de toplijst per spel ophalen.
create index if not exists arcade_scores_game_score_idx
  on public.arcade_scores (game_id, score desc);

alter table public.arcade_scores enable row level security;

-- Iedereen mag de ranglijst lezen.
drop policy if exists arcade_scores_select_all on public.arcade_scores;
create policy arcade_scores_select_all
  on public.arcade_scores
  for select
  using (true);

-- Iedereen mag een score insturen, mits naam/score binnen de grenzen vallen.
drop policy if exists arcade_scores_insert_all on public.arcade_scores;
create policy arcade_scores_insert_all
  on public.arcade_scores
  for insert
  with check (
    char_length(name) between 1 and 24
    and score >= 0
    and score < 1000000
  );
