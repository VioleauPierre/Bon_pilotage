begin;

create table if not exists public.bon_pilotage_admin_invitations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_digest text not null check (token_digest ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  claim_id uuid,
  claim_until timestamptz,
  activated_at timestamptz,
  check ((claim_id is null) = (claim_until is null))
);

alter table public.bon_pilotage_admin_invitations enable row level security;
revoke all on public.bon_pilotage_admin_invitations from public, anon, authenticated;
grant select, insert, update on public.bon_pilotage_admin_invitations to service_role;

create or replace function public.bp_admin_claim_invitation(p_user uuid, p_digest text, p_claim uuid)
returns boolean language sql security definer set search_path = '' as $$
  with claimed as (
    update public.bon_pilotage_admin_invitations as invitation
    set claim_id = p_claim, claim_until = now() + interval '2 minutes'
    where invitation.user_id = p_user
      and invitation.token_digest = p_digest
      and invitation.expires_at > now()
      and invitation.activated_at is null
      and (invitation.claim_until is null or invitation.claim_until <= now())
      and exists (
        select 1 from auth.users as account
        where account.id = invitation.user_id and coalesce(account.encrypted_password, '') = ''
      )
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.bp_admin_claim_invitation(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.bp_admin_claim_invitation(uuid, text, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
