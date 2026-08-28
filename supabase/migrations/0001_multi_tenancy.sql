-- Create role enum
create type public.user_role as enum (
  'OWNER',
  'ADMIN',
  'STAFF',
  'ACCOUNT_MANAGER',
  'SUPPORT_AGENT',
  'CLIENT_ADMIN',
  'CLIENT_USER'
);

-- Organizations table
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Organization Members table
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role public.user_role not null default 'CLIENT_USER',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (organization_id, user_id)
);

-- Enable RLS
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- Setup RLS helper functions for checking user's organizations
create or replace function public.get_user_organizations()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id
  from organization_members
  where user_id = auth.uid();
$$;

-- Setup RLS helper function for checking user's roles
create or replace function public.has_role_in_organization(org_id uuid, required_roles public.user_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from organization_members
    where user_id = auth.uid()
      and organization_id = org_id
      and role = any(required_roles)
  );
$$;

-- Policies for organizations
create policy "Users can view their own organizations"
  on public.organizations
  for select
  using (id in (select public.get_user_organizations()));

create policy "Admins/Owners can update their organizations"
  on public.organizations
  for update
  using (public.has_role_in_organization(id, array['OWNER', 'ADMIN', 'CLIENT_ADMIN']::public.user_role[]));

-- Policies for organization_members
create policy "Users can view members of their organizations"
  on public.organization_members
  for select
  using (organization_id in (select public.get_user_organizations()));

create policy "Admins/Owners can manage members"
  on public.organization_members
  for all
  using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'CLIENT_ADMIN']::public.user_role[]));

-- Trigger for updating `updated_at` on organizations and members
create trigger set_organizations_updated_at
  before update on public.organizations
  for each row execute procedure public.set_current_timestamp_updated_at();

create trigger set_organization_members_updated_at
  before update on public.organization_members
  for each row execute procedure public.set_current_timestamp_updated_at();
