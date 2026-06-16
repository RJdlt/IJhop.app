-- Hardening + uitbreiding van de arcade-ranglijst.
-- Draai dit ná 0001 in de Supabase SQL-editor.
-- Vereist dat "Anonymous sign-ins" aanstaat (Auth → Providers) — dat gebruikt
-- de app al voor presence/duel.

-- Optionele "kamer" voor latere per-overtocht-ranglijsten (bijv. lijn + vertrektijd).
alter table public.arcade_scores add column if not exists room text;
create index if not exists arcade_scores_room_idx
  on public.arcade_scores (game_id, room, score desc);

-- Inserts koppelen aan de (anonieme) sessie: user_id moet je eigen uid zijn,
-- zodat scores niet onder andermans naam/zonder sessie ingestuurd kunnen worden.
drop policy if exists arcade_scores_insert_all on public.arcade_scores;
drop policy if exists arcade_scores_insert_own on public.arcade_scores;
create policy arcade_scores_insert_own
  on public.arcade_scores
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and char_length(name) between 1 and 24
    and score >= 0
    and score < 1000000
  );

-- Lezen blijft openbaar.
drop policy if exists arcade_scores_select_all on public.arcade_scores;
create policy arcade_scores_select_all
  on public.arcade_scores
  for select
  using (true);

-- Realtime aanzetten zodat nieuwe scores live binnenkomen.
do $$
begin
  begin
    alter publication supabase_realtime add table public.arcade_scores;
  exception
    when duplicate_object then null;
  end;
end $$;
