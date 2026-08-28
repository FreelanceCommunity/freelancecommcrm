-- Services
create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  name text not null,
  description text,
  status text default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Invitations
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  email text not null,
  role public.user_role not null default 'CLIENT_USER',
  token text not null unique,
  expires_at timestamp with time zone not null,
  status text default 'Pending', -- Pending, Accepted, Expired, Revoked
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Audit Logs
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.services enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_logs enable row level security;

create policy "Org view services" on public.services for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage services" on public.services for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

create policy "Org view invitations" on public.invitations for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage invitations" on public.invitations for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

create policy "Org view audit logs" on public.audit_logs for select using (organization_id in (select public.get_user_organizations()));
create policy "Org insert audit logs" on public.audit_logs for insert with check (organization_id in (select public.get_user_organizations()));
