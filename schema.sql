-- Run this entire file in Supabase SQL Editor.
-- This app uses Supabase Auth + Postgres. Create two Auth users in
-- Authentication > Users, one for Miyu and one for Partner.

create table if not exists public.fluid_records (
  id uuid primary key default gen_random_uuid(),
  record_date date not null,
  amount_ml numeric not null check (amount_ml >= 0),
  performed_time time,
  performed_by text not null check (performed_by in ('Miyu','Partner')),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vet_visits (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null,
  weight_kg numeric check (weight_kg >= 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blood_tests (
  id uuid primary key default gen_random_uuid(),
  test_date date not null,
  crea numeric check (crea >= 0),
  bun numeric check (bun >= 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  next_vet_date date,
  next_blood_date date,
  weight_change_threshold numeric default 0.2,
  crea_change_threshold numeric default 0.5,
  bun_change_threshold numeric default 10,
  fluid_change_threshold numeric default 30,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.app_settings(id) values (1) on conflict do nothing;

alter table public.fluid_records enable row level security;
alter table public.vet_visits enable row level security;
alter table public.blood_tests enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "authenticated users can read fluid" on public.fluid_records;
drop policy if exists "authenticated users can write fluid" on public.fluid_records;
create policy "authenticated users can read fluid" on public.fluid_records for select to authenticated using (true);
create policy "authenticated users can write fluid" on public.fluid_records for all to authenticated using (true) with check (true);

drop policy if exists "authenticated users can read visits" on public.vet_visits;
drop policy if exists "authenticated users can write visits" on public.vet_visits;
create policy "authenticated users can read visits" on public.vet_visits for select to authenticated using (true);
create policy "authenticated users can write visits" on public.vet_visits for all to authenticated using (true) with check (true);

drop policy if exists "authenticated users can read blood" on public.blood_tests;
drop policy if exists "authenticated users can write blood" on public.blood_tests;
create policy "authenticated users can read blood" on public.blood_tests for select to authenticated using (true);
create policy "authenticated users can write blood" on public.blood_tests for all to authenticated using (true) with check (true);

drop policy if exists "authenticated users can read settings" on public.app_settings;
drop policy if exists "authenticated users can write settings" on public.app_settings;
create policy "authenticated users can read settings" on public.app_settings for select to authenticated using (true);
create policy "authenticated users can write settings" on public.app_settings for all to authenticated using (true) with check (true);

-- Optional: keep updated_at current.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists fluid_updated_at on public.fluid_records;
create trigger fluid_updated_at before update on public.fluid_records for each row execute function public.set_updated_at();
drop trigger if exists visits_updated_at on public.vet_visits;
create trigger visits_updated_at before update on public.vet_visits for each row execute function public.set_updated_at();
drop trigger if exists blood_updated_at on public.blood_tests;
create trigger blood_updated_at before update on public.blood_tests for each row execute function public.set_updated_at();