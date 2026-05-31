create extension if not exists pgcrypto;

create table if not exists public.bon_pilotage_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz,
  status text not null default 'queued',
  bon_number text not null,
  pilot_name text not null,
  pilot_names jsonb not null default '[]'::jsonb,
  transporter text not null,
  vehicle_registration text not null default '',
  convoy_category text not null,
  decree_number text not null default '',
  driver_name text not null,
  driver_signature text not null default '',
  pickup_date date not null,
  pickup_time text not null,
  end_date date not null,
  end_time text not null,
  departure_city text not null,
  arrival_city text not null,
  total_km integer not null default 0,
  observations text not null default '',
  recipient_email text not null,
  pdf_file_name text,
  email_provider_id text,
  email_error text,
  itinerary jsonb not null default '[]'::jsonb
);

alter table public.bon_pilotage_submissions
  add column if not exists pilot_names jsonb not null default '[]'::jsonb;

alter table public.bon_pilotage_submissions
  add column if not exists end_date date;

update public.bon_pilotage_submissions
  set end_date = pickup_date
  where end_date is null;

alter table public.bon_pilotage_submissions
  alter column end_date set not null;

alter table public.bon_pilotage_submissions
  add column if not exists end_time text not null default '';

create index if not exists bon_pilotage_submissions_created_at_idx
  on public.bon_pilotage_submissions (created_at desc);

create table if not exists public.bon_pilotage_memory_values (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  field text not null,
  value text not null,
  value_key text not null,
  constraint bon_pilotage_memory_values_field_value_key_unique
    unique (field, value_key)
);

create index if not exists bon_pilotage_memory_values_updated_at_idx
  on public.bon_pilotage_memory_values (updated_at desc);

create table if not exists public.bon_pilotage_pilot_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  pilot_name text not null,
  pilot_key text not null,
  transporter text not null default '',
  vehicle_registration text not null default '',
  convoy_category text not null default '',
  driver_name text not null default '',
  driver_signature text not null default '',
  departure_city text not null default '',
  arrival_city text not null default '',
  constraint bon_pilotage_pilot_profiles_pilot_key_unique
    unique (pilot_key)
);

create index if not exists bon_pilotage_pilot_profiles_updated_at_idx
  on public.bon_pilotage_pilot_profiles (updated_at desc);
