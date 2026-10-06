-- Auth is separate from the immutable editor whitelist. No membership mutation
-- is available to browser roles, including owners.
create schema if not exists magic_bag_private;
revoke all on schema magic_bag_private from public;
grant usage on schema magic_bag_private to authenticated, service_role;

create table public.editor_users (
  id uuid primary key references auth.users(id) on delete cascade,
  approved_email text not null unique
    check (approved_email = lower(btrim(approved_email)) and approved_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  role text not null check (role in ('owner', 'admin')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  -- Auth user confirmation alone is insufficient after a revoked user returns.
  setup_required boolean not null default false,
  setup_password_fingerprint text,
  sessions_valid_after timestamptz not null default '-infinity',
  admin_action_token uuid,
  admin_action_expires_at timestamptz
);

create function magic_bag_private.protect_editor_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.approved_email is distinct from old.approved_email then
    raise exception 'Approved editor identity is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger editor_identity_immutable before update on public.editor_users
for each row execute function magic_bag_private.protect_editor_identity();

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 2 and 120),
  city text not null check (city = btrim(city) and char_length(city) between 2 and 120),
  official_code text not null default '' check (official_code = btrim(official_code) and char_length(official_code) <= 30)
);
create unique index schools_official_code_unique on public.schools(official_code) where official_code <> '';

create table public.class_packs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  school_year text not null check (school_year = btrim(school_year) and char_length(school_year) between 4 and 20),
  grade text not null check (grade = btrim(grade) and char_length(grade) between 1 and 20),
  class_section text not null check (class_section = btrim(class_section) and char_length(class_section) between 1 and 20),
  title text not null check (title = btrim(title) and char_length(title) between 2 and 120),
  status text not null default 'draft' check (status = 'draft'),
  updated_at timestamptz not null default now(),
  unique (school_id, school_year, grade, class_section)
);

create function magic_bag_private.touch_class_pack()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger class_pack_updated_at before update on public.class_packs
for each row execute function magic_bag_private.touch_class_pack();

-- Compare session creation, not JWT issue time: a refreshed pre-revocation
-- session must never become valid again when the whitelist is re-enabled.
create function magic_bag_private.session_is_current(editor_id uuid, valid_after timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() = editor_id and exists (
    select 1 from auth.sessions s
    where s.user_id = editor_id
      and s.id::text = (auth.jwt() ->> 'session_id')
      and s.created_at >= valid_after
      and (s.not_after is null or s.not_after > now())
  );
$$;

create function public.current_editor()
returns table(id uuid, email text, approved_email text, role text, enabled boolean, verified boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.id, u.email::text, e.approved_email, e.role, e.enabled,
    (u.email_confirmed_at is not null and not e.setup_required and (u.banned_until is null or u.banned_until <= now())), e.created_at
  from public.editor_users e join auth.users u on u.id = e.id
  where e.id = auth.uid()
    and lower(btrim(u.email)) = e.approved_email
    and magic_bag_private.session_is_current(e.id, e.sessions_valid_after);
$$;

create function magic_bag_private.is_editor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.current_editor() e where e.enabled and e.verified);
$$;
create function magic_bag_private.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.current_editor() e where e.enabled and e.verified and e.role = 'owner');
$$;

create function public.list_editor_users()
returns table(id uuid, email text, approved_email text, role text, enabled boolean, verified boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not magic_bag_private.is_owner() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  return query
    select e.id, u.email::text, e.approved_email, e.role, e.enabled,
      (u.email_confirmed_at is not null and not e.setup_required and lower(btrim(u.email)) = e.approved_email and (u.banned_until is null or u.banned_until <= now())), e.created_at
    from public.editor_users e join auth.users u on u.id = e.id
    order by e.created_at, e.id;
end;
$$;

-- Called only after native invite/recovery sign-in and Auth updateUser(password).
-- A session alone cannot complete setup: the Auth password must have changed
-- since the owner prepared this invitation, and the session must be new.
create function public.complete_editor_setup()
returns void language plpgsql security definer set search_path = '' as $$
declare
  member public.editor_users%rowtype;
  auth_user auth.users%rowtype;
begin
  select * into member from public.editor_users where id = auth.uid() for update;
  if not found or not member.enabled or not member.setup_required
    or member.admin_action_token is not null
    or not magic_bag_private.session_is_current(member.id, member.sessions_valid_after) then
    raise exception 'No active invitation for this session' using errcode = '42501';
  end if;
  select * into auth_user from auth.users where id = member.id;
  if auth_user.email_confirmed_at is null or lower(btrim(auth_user.email)) <> member.approved_email
    or (auth_user.banned_until is not null and auth_user.banned_until > now())
    or member.setup_password_fingerprint is null
    or md5(auth_user.encrypted_password) = member.setup_password_fingerprint
    or auth_user.encrypted_password is null or auth_user.encrypted_password = '' then
    raise exception 'Confirm your invitation and set a new password first' using errcode = '42501';
  end if;
  update public.editor_users set setup_required = false, setup_password_fingerprint = null where id = member.id;
end;
$$;

-- The following three functions are service-role-only. They serialize the
-- nontransactional Auth/email calls; a crashed worker's lock expires in 2 min.
create function public.editor_begin_admin_action(target_id uuid, requested_action text, allow_revoked boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  member public.editor_users%rowtype;
  action_token uuid := gen_random_uuid();
begin
  select * into member from public.editor_users where id = target_id for update;
  if not found or member.role <> 'admin' then
    raise exception 'Only admin memberships can be managed here' using errcode = '22023';
  end if;
  if member.admin_action_token is not null and member.admin_action_expires_at > now() then
    raise exception 'An invitation operation is in progress; retry shortly' using errcode = '55000';
  end if;
  if requested_action = 'invite' then
    if not member.enabled and not allow_revoked then
      raise exception 'This editor was revoked; explicit approval is required' using errcode = '22023';
    end if;
    if member.enabled and not member.setup_required then
      raise exception 'This editor is already active' using errcode = '22023';
    end if;
  elsif requested_action = 'resend' then
    if not member.enabled or not member.setup_required then
      raise exception 'Only pending invitations can be resent' using errcode = '22023';
    end if;
  elsif requested_action = 'revoke' then
    -- Withdraw access before any fallible Auth call.
    update public.editor_users set enabled = false, setup_required = true,
      setup_password_fingerprint = null, sessions_valid_after = clock_timestamp() where id = target_id;
  else
    raise exception 'Unknown invitation action' using errcode = '22023';
  end if;
  update public.editor_users set admin_action_token = action_token,
    admin_action_expires_at = clock_timestamp() + interval '2 minutes' where id = target_id;
  return action_token;
end;
$$;

create function public.editor_prepare_invitation(target_id uuid, action_token uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  member public.editor_users%rowtype;
  auth_user auth.users%rowtype;
begin
  select * into member from public.editor_users where id = target_id for update;
  if not found or member.role <> 'admin' or member.admin_action_token is distinct from action_token
    or member.admin_action_expires_at <= now() then
    raise exception 'Invitation operation expired; retry' using errcode = '55000';
  end if;
  select * into auth_user from auth.users where id = target_id;
  if lower(btrim(auth_user.email)) <> member.approved_email or auth_user.encrypted_password is null or auth_user.encrypted_password = '' then
    raise exception 'Auth identity does not match approved membership' using errcode = '22023';
  end if;
  update public.editor_users set enabled = true, setup_required = true,
    setup_password_fingerprint = md5(auth_user.encrypted_password),
    sessions_valid_after = clock_timestamp() where id = target_id;
end;
$$;

create function public.editor_finish_admin_action(target_id uuid, action_token uuid)
returns void language sql security definer set search_path = '' as $$
  update public.editor_users set admin_action_token = null, admin_action_expires_at = null
  where id = target_id and admin_action_token = action_token;
$$;

alter table public.editor_users enable row level security;
alter table public.schools enable row level security;
alter table public.class_packs enable row level security;
-- editor_users intentionally has no policies; only narrow RPC results are public.
create policy schools_read on public.schools for select to authenticated using ((select magic_bag_private.is_editor()));
create policy schools_insert on public.schools for insert to authenticated with check ((select magic_bag_private.is_editor()));
create policy schools_update on public.schools for update to authenticated using ((select magic_bag_private.is_editor())) with check ((select magic_bag_private.is_editor()));
create policy schools_delete on public.schools for delete to authenticated using ((select magic_bag_private.is_owner()));
create policy class_packs_read on public.class_packs for select to authenticated using ((select magic_bag_private.is_editor()));
create policy class_packs_insert on public.class_packs for insert to authenticated with check ((select magic_bag_private.is_editor()));
create policy class_packs_update on public.class_packs for update to authenticated using ((select magic_bag_private.is_editor())) with check ((select magic_bag_private.is_editor()));
create policy class_packs_delete on public.class_packs for delete to authenticated using ((select magic_bag_private.is_editor()));

revoke all on public.editor_users, public.schools, public.class_packs from anon, authenticated;
grant select, insert, update, delete on public.schools, public.class_packs to authenticated;
grant all on public.editor_users, public.schools, public.class_packs to service_role;

revoke all on all functions in schema magic_bag_private from public, anon, authenticated;
grant execute on function magic_bag_private.is_editor(), magic_bag_private.is_owner() to authenticated;
revoke all on function public.current_editor(), public.list_editor_users(), public.complete_editor_setup() from public, anon;
grant execute on function public.current_editor(), public.list_editor_users(), public.complete_editor_setup() to authenticated;
revoke all on function public.editor_begin_admin_action(uuid, text, boolean), public.editor_prepare_invitation(uuid, uuid), public.editor_finish_admin_action(uuid, uuid) from public, anon, authenticated;
grant execute on function public.editor_begin_admin_action(uuid, text, boolean), public.editor_prepare_invitation(uuid, uuid), public.editor_finish_admin_action(uuid, uuid) to service_role;
