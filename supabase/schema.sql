-- Discipline‑First Finance App — Supabase schema (MVP)
-- Stores the entire AppState JSON as a single row per user.

create table if not exists public.user_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_states_server_updated_at on public.user_states;
create trigger trg_user_states_server_updated_at
before update on public.user_states
for each row execute function public.set_server_updated_at();

alter table public.user_states enable row level security;

create policy "Read own state"
on public.user_states
for select
using (auth.uid() = user_id);

create policy "Insert own state"
on public.user_states
for insert
with check (auth.uid() = user_id);

create policy "Update own state"
on public.user_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Delete own state"
on public.user_states
for delete
using (auth.uid() = user_id);
