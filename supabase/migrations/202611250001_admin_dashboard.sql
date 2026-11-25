begin;

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
set local search_path = public, extensions, pg_catalog;

-- Garder les anciennes lignes et l'absence de champs historiques telle quelle.
alter table public.bon_pilotage_submissions
  add column if not exists pilot_names jsonb not null default '[]'::jsonb,
  add column if not exists end_date date,
  add column if not exists end_time text,
  add column if not exists viewed_at timestamptz,
  add column if not exists invoiced boolean not null default false,
  add column if not exists generated_at timestamptz,
  add column if not exists pdf_template_version smallint not null default 1,
  add column if not exists submission_fingerprint text,
  add column if not exists search_text text generated always as (
    coalesce(bon_number, '') || ' ' ||
    coalesce(pilot_name, '') || ' ' || coalesce(pilot_names::text, '') || ' ' ||
    coalesce(transporter, '') || ' ' || coalesce(driver_name, '') || ' ' ||
    coalesce(vehicle_registration, '') || ' ' ||
    coalesce(departure_city, '') || ' ' || coalesce(arrival_city, '')
  ) stored;

-- Le numéro historique est calculé à la minute et peut avoir été réutilisé.
-- Les anciennes empreintes restent nulles. Un index UNIQUE accepte ces valeurs.
do $$
begin
  if exists (
    select 1 from public.bon_pilotage_submissions
    where submission_fingerprint is not null
    group by submission_fingerprint having count(*) > 1
  ) then
    raise exception 'Vérifier les empreintes en double avant de poursuivre la migration';
  end if;
end $$;

create unique index if not exists bp_submissions_fingerprint_uidx
  on public.bon_pilotage_submissions (submission_fingerprint);
create index if not exists bp_submissions_list_idx
  on public.bon_pilotage_submissions (created_at desc, id desc);
create index if not exists bp_submissions_pickup_idx
  on public.bon_pilotage_submissions (pickup_date);
create index if not exists bp_submissions_unread_idx
  on public.bon_pilotage_submissions (created_at desc, id desc) where viewed_at is null;
create index if not exists bp_submissions_search_idx
  on public.bon_pilotage_submissions using gin (search_text gin_trgm_ops);

-- Certaines installations n’ont initialisé que la table des bons.
create table if not exists public.bon_pilotage_memory_values (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  field text not null,
  value text not null,
  value_key text not null,
  unique (field, value_key)
);
create index if not exists bp_memory_field_updated_idx
  on public.bon_pilotage_memory_values (field, updated_at desc);

create table if not exists public.bon_pilotage_pilot_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pilot_name text not null,
  pilot_key text not null unique,
  transporter text not null default '',
  vehicle_registration text not null default '',
  convoy_category text not null default '',
  driver_name text not null default '',
  driver_signature text not null default '',
  departure_city text not null default '',
  arrival_city text not null default ''
);

create table if not exists public.bon_pilotage_admin_settings (
  id boolean primary key default true check (id),
  send_email boolean not null default true
);
insert into public.bon_pilotage_admin_settings (id) values (true) on conflict do nothing;

create table if not exists public.bon_pilotage_login_attempts (
  bucket text primary key,
  attempts integer not null,
  started_at timestamptz not null
);

-- Les quatre fonctionnalités publiques passent par les routes serveur, qui
-- sélectionnent et valident les champs. Aucun accès direct anonyme ou connecté.
alter table public.bon_pilotage_submissions enable row level security;
alter table public.bon_pilotage_memory_values enable row level security;
alter table public.bon_pilotage_pilot_profiles enable row level security;
alter table public.bon_pilotage_admin_settings enable row level security;
alter table public.bon_pilotage_login_attempts enable row level security;
revoke all on table public.bon_pilotage_submissions, public.bon_pilotage_memory_values,
  public.bon_pilotage_pilot_profiles, public.bon_pilotage_admin_settings,
  public.bon_pilotage_login_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.bon_pilotage_submissions,
  public.bon_pilotage_memory_values, public.bon_pilotage_pilot_profiles,
  public.bon_pilotage_admin_settings, public.bon_pilotage_login_attempts to service_role;

create or replace function public.bp_admin_session_active(p_user uuid, p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions where id = p_session and user_id = p_user
      and (not_after is null or not_after > now())
  );
$$;

create or replace function public.bp_admin_allow_login(p_bucket text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  attempt_count integer;
  attempt_at timestamptz := now();
begin
  delete from public.bon_pilotage_login_attempts where started_at < attempt_at - interval '1 day';
  insert into public.bon_pilotage_login_attempts as existing (bucket, attempts, started_at)
  values (p_bucket, 1, attempt_at)
  on conflict (bucket) do update set
    attempts = case when existing.started_at <= attempt_at - interval '15 minutes'
      then 1 else least(existing.attempts + 1, 9) end,
    started_at = case when existing.started_at <= attempt_at - interval '15 minutes'
      then attempt_at else existing.started_at end
  returning attempts into attempt_count;
  return attempt_count <= 8;
end;
$$;

create or replace function public.bp_admin_metrics(
  p_month_start date, p_month_end date, p_start date, p_end date
)
returns table (total bigint, unread bigint, month_total bigint, period_km bigint)
language sql stable security invoker set search_path = '' as $$
  select count(*), count(*) filter (where viewed_at is null),
    count(*) filter (where pickup_date >= p_month_start and pickup_date < p_month_end),
    coalesce(sum(total_km) filter (
      where (p_start is null or pickup_date >= p_start)
        and (p_end is null or pickup_date <= p_end)
    ), 0)
  from public.bon_pilotage_submissions;
$$;

revoke all on function public.bp_admin_session_active(uuid, uuid),
  public.bp_admin_allow_login(text), public.bp_admin_metrics(date, date, date, date)
  from public, anon, authenticated;
grant execute on function public.bp_admin_session_active(uuid, uuid),
  public.bp_admin_allow_login(text), public.bp_admin_metrics(date, date, date, date)
  to service_role;

notify pgrst, 'reload schema';
commit;
