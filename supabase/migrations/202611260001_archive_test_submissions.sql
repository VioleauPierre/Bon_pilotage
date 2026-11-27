begin;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bon_pilotage_submissions'
      and column_name = 'archived_at'
  ) then
    alter table public.bon_pilotage_submissions add column archived_at timestamptz;

    update public.bon_pilotage_submissions
    set archived_at = now()
    where pickup_date < date '2026-06-07';
  end if;
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
  from public.bon_pilotage_submissions
  where archived_at is null;
$$;

notify pgrst, 'reload schema';
commit;
