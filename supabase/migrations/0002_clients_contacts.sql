-- Clients table
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  country text,
  state text,
  address text,
  website text,
  tax_number text,
  status text default 'Active',
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Contacts table
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  position text,
  is_primary boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.clients enable row level security;
alter table public.contacts enable row level security;

-- Policies for clients
create policy "Users can view clients in their organizations"
  on public.clients
  for select
  using (organization_id in (select public.get_user_organizations()));

create policy "Admins/Staff can manage clients"
  on public.clients
  for all
  using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

-- Policies for contacts
create policy "Users can view contacts in their organizations"
  on public.contacts
  for select
  using (organization_id in (select public.get_user_organizations()));

create policy "Admins/Staff can manage contacts"
  on public.contacts
  for all
  using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

-- Triggers for updated_at
create trigger set_clients_updated_at
  before update on public.clients
  for each row execute procedure public.set_current_timestamp_updated_at();

create trigger set_contacts_updated_at
  before update on public.contacts
  for each row execute procedure public.set_current_timestamp_updated_at();
