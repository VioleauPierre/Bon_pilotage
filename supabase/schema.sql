create extension if not exists pgcrypto;

create table if not exists public.bon_pilotage_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz,
  status text not null default 'queued',
  bon_number text not null,
  pilot_name text not null,
  transporter text not null,
  vehicle_registration text not null default '',
  convoy_category text not null,
  decree_number text not null default '',
  driver_name text not null,
  driver_signature text not null default '',
  pickup_date date not null,
  pickup_time text not null,
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

create index if not exists bon_pilotage_submissions_created_at_idx
  on public.bon_pilotage_submissions (created_at desc);
