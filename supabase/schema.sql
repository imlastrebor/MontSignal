-- Supabase schema for MontSignal. Run in Supabase SQL editor or supabase-cli.

-- Extensions required for UUID generation.
create extension if not exists "pgcrypto";

-- avalanche_bulletins: one row per source/massif/day.
create table if not exists public.avalanche_bulletins (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  massif text not null,
  valid_date date not null,
  issued_at timestamptz not null,
  danger_level_min int,
  danger_level_max int,
  danger_level_by_altitude jsonb,
  danger_aspects jsonb,
  french_text text,
  english_text text,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint avalanche_bulletins_unique unique (source, massif, valid_date)
);

create index if not exists avalanche_bulletins_valid_date_idx
  on public.avalanche_bulletins (valid_date desc);

-- weather_snapshots: dedupe by source/day/location.
create table if not exists public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  timestamp timestamptz not null,
  valid_date date not null,
  location text not null,
  data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weather_snapshots_unique unique (source, valid_date, location)
);

create index if not exists weather_snapshots_valid_date_idx
  on public.weather_snapshots (valid_date desc, location);

-- text_sources: narrative text per source/day.
create table if not exists public.text_sources (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  valid_date date not null,
  french_text text,
  english_text text,
  raw_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint text_sources_unique unique (source, valid_date)
);

create index if not exists text_sources_valid_date_idx
  on public.text_sources (valid_date desc);

-- Row Level Security: allow public read, service role writes.
alter table public.avalanche_bulletins enable row level security;
alter table public.weather_snapshots enable row level security;
alter table public.text_sources enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'avalanche_bulletins' and policyname = 'Public read'
  ) then
    create policy "Public read" on public.avalanche_bulletins
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'weather_snapshots' and policyname = 'Public read'
  ) then
    create policy "Public read" on public.weather_snapshots
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'text_sources' and policyname = 'Public read'
  ) then
    create policy "Public read" on public.text_sources
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'avalanche_bulletins' and policyname = 'Service role write'
  ) then
    create policy "Service role write" on public.avalanche_bulletins
      for insert to service_role
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'weather_snapshots' and policyname = 'Service role write'
  ) then
    create policy "Service role write" on public.weather_snapshots
      for insert to service_role
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'text_sources' and policyname = 'Service role write'
  ) then
    create policy "Service role write" on public.text_sources
      for insert to service_role
      with check (true);
  end if;
end $$;
