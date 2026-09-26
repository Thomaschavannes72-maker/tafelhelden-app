-- Tafelhelden cloud schema. Run this in Supabase SQL Editor after creating a project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_-]{2,20}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 32),
  join_code text not null unique default upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6)),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Add classroom codes when upgrading an existing project.
alter table public.pools add column if not exists join_code text;
update public.pools set join_code = upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6)) where join_code is null;
create unique index if not exists pools_join_code_unique on public.pools(join_code);
alter table public.pools alter column join_code set default upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6));
alter table public.pools alter column join_code set not null;

create table if not exists public.pool_members (
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  points integer not null default 0 check (points >= 0),
  joined_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);

create table if not exists public.pool_invites (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index if not exists pool_invites_one_pending
  on public.pool_invites(pool_id, invitee_id) where status = 'pending';

alter table public.profiles enable row level security;
alter table public.pools enable row level security;
alter table public.pool_members enable row level security;
alter table public.pool_invites enable row level security;

drop policy if exists profile_select_self on public.profiles;
create policy profile_select_self on public.profiles for select to authenticated
  using (id = auth.uid());
drop policy if exists profile_insert_self on public.profiles;
create policy profile_insert_self on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists profile_update_self on public.profiles;
create policy profile_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.is_pool_member(p_pool_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.pool_members m where m.pool_id = p_pool_id and m.user_id = auth.uid()) $$;

drop policy if exists pool_select_member on public.pools;
create policy pool_select_member on public.pools for select to authenticated
  using (public.is_pool_member(id));
drop policy if exists pool_delete_owner on public.pools;
create policy pool_delete_owner on public.pools for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists member_select_poolmates on public.pool_members;
create policy member_select_poolmates on public.pool_members for select to authenticated
  using (public.is_pool_member(pool_id));
drop policy if exists member_leave_self on public.pool_members;
create policy member_leave_self on public.pool_members for delete to authenticated
  using (user_id = auth.uid() and role = 'member');

drop policy if exists invite_select_participant on public.pool_invites;
create policy invite_select_participant on public.pool_invites for select to authenticated
  using (inviter_id = auth.uid() or invitee_id = auth.uid());

create or replace function public.create_pool(p_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_pool_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 32 then raise exception 'Pool name must be 2 to 32 characters'; end if;
  insert into public.pools(name, owner_id) values (trim(p_name), auth.uid()) returning id into v_pool_id;
  insert into public.pool_members(pool_id, user_id, role) values (v_pool_id, auth.uid(), 'owner');
  return v_pool_id;
end;
$$;

create or replace function public.invite_to_pool(p_pool_id uuid, p_username text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_invitee uuid; v_invite_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not public.is_pool_member(p_pool_id) then raise exception 'Join the pool before inviting players'; end if;
  select id into v_invitee from public.profiles where username = lower(trim(p_username));
  if v_invitee is null then raise exception 'No player has that username'; end if;
  if v_invitee = auth.uid() then raise exception 'You are already in this pool'; end if;
  if exists(select 1 from public.pool_members where pool_id = p_pool_id and user_id = v_invitee) then raise exception 'Player is already in this pool'; end if;
  insert into public.pool_invites(pool_id, inviter_id, invitee_id)
    values (p_pool_id, auth.uid(), v_invitee) returning id into v_invite_id;
  return v_invite_id;
end;
$$;

create or replace function public.respond_to_invitation(p_invite_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare v_pool_id uuid;
begin
  update public.pool_invites set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
    where id = p_invite_id and invitee_id = auth.uid() and status = 'pending' returning pool_id into v_pool_id;
  if v_pool_id is null then raise exception 'Invitation not found'; end if;
  if p_accept then
    insert into public.pool_members(pool_id, user_id, role) values (v_pool_id, auth.uid(), 'member') on conflict do nothing;
  end if;
end;
$$;

create or replace function public.get_my_pools()
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'join_code', p.join_code, 'owner_id', p.owner_id,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'username', pr.username, 'role', m.role, 'points', m.points) order by m.points desc, pr.username), '[]'::jsonb)
      from public.pool_members m join public.profiles pr on pr.id = m.user_id where m.pool_id = p.id)
  ) order by p.created_at desc), '[]'::jsonb)
  from public.pool_members mine join public.pools p on p.id = mine.pool_id where mine.user_id = auth.uid();
$$;

create or replace function public.join_pool_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_pool_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_code !~ '^[A-F0-9]{6}$' then raise exception 'Invalid classroom code'; end if;
  select id into v_pool_id from public.pools where join_code = upper(trim(p_code));
  if v_pool_id is null then raise exception 'Classroom code not found'; end if;
  insert into public.pool_members(pool_id, user_id, role) values (v_pool_id, auth.uid(), 'member') on conflict do nothing;
  return v_pool_id;
end;
$$;

create or replace function public.get_my_invites()
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'pool_id', i.pool_id, 'pool_name', p.name, 'inviter_id', i.inviter_id,
    'inviter_username', inviter.username, 'invitee_id', i.invitee_id, 'invitee_username', invitee.username,
    'status', i.status, 'created_at', i.created_at
  ) order by i.created_at desc), '[]'::jsonb)
  from public.pool_invites i join public.pools p on p.id = i.pool_id
  join public.profiles inviter on inviter.id = i.inviter_id
  join public.profiles invitee on invitee.id = i.invitee_id
  where i.inviter_id = auth.uid() or i.invitee_id = auth.uid();
$$;

create or replace function public.record_pool_points(p_points integer)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_points < 0 or p_points > 100 then raise exception 'Invalid points amount'; end if;
  update public.pool_members set points = points + p_points where user_id = auth.uid();
end;
$$;

revoke all on function public.create_pool(text) from public;
revoke all on function public.invite_to_pool(uuid, text) from public;
revoke all on function public.respond_to_invitation(uuid, boolean) from public;
revoke all on function public.get_my_pools() from public;
revoke all on function public.join_pool_by_code(text) from public;
revoke all on function public.get_my_invites() from public;
revoke all on function public.record_pool_points(integer) from public;
grant execute on function public.create_pool(text) to authenticated;
grant execute on function public.invite_to_pool(uuid, text) to authenticated;
grant execute on function public.respond_to_invitation(uuid, boolean) to authenticated;
grant execute on function public.get_my_pools() to authenticated;
grant execute on function public.join_pool_by_code(text) to authenticated;
grant execute on function public.get_my_invites() to authenticated;
grant execute on function public.record_pool_points(integer) to authenticated;
grant execute on function public.is_pool_member(uuid) to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, delete on public.pools to authenticated;
grant select, delete on public.pool_members to authenticated;
grant select on public.pool_invites to authenticated;
