-- Tickets
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  ticket_number text not null,
  title text not null,
  description text,
  status text not null default 'Open', -- Open, In Progress, Waiting for Client, Resolved, Closed
  priority text not null default 'Normal', -- Low, Normal, High, Urgent
  category text not null default 'General', -- Bug, Technical Support, Billing, Feature Request, General, Maintenance
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (organization_id, ticket_number)
);

-- Ticket Messages
create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  message text not null,
  is_internal boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Bug Reports
create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  title text not null,
  description text not null,
  project_id uuid, -- will reference projects later
  severity text not null default 'Medium',
  priority text not null default 'Normal',
  steps_to_reproduce text,
  expected_result text,
  actual_result text,
  browser text,
  device text,
  status text not null default 'Reported', -- Reported, Confirmed, In Progress, Testing, Resolved, Closed, Rejected
  assigned_developer uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.bug_reports enable row level security;

-- Set up basic standard RLS
create policy "Org view tickets" on public.tickets for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage tickets" on public.tickets for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'SUPPORT_AGENT', 'CLIENT_ADMIN', 'CLIENT_USER']::public.user_role[]));

create policy "Org view messages" on public.ticket_messages for select using (ticket_id in (select id from public.tickets where organization_id in (select public.get_user_organizations())));
-- Internal notes are restricted to internal staff
create policy "Restrict internal messages" on public.ticket_messages for select using (
  not is_internal or public.has_role_in_organization((select organization_id from public.tickets where id = ticket_id), array['OWNER', 'ADMIN', 'STAFF', 'SUPPORT_AGENT']::public.user_role[])
);

create trigger set_tickets_updated_at
  before update on public.tickets
  for each row execute procedure public.set_current_timestamp_updated_at();

create trigger set_bug_reports_updated_at
  before update on public.bug_reports
  for each row execute procedure public.set_current_timestamp_updated_at();
