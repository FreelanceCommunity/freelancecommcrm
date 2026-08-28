-- Leads table
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  status text not null default 'New', -- New, Contacted, Qualified, Proposal, Lost, Converted
  source text default 'Website', -- Website, Referral, Cold Call, Advertisement
  estimated_value numeric(12,2) default 0,
  notes text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.leads enable row level security;

-- Policies for leads
create policy "Users can view leads in their organizations"
  on public.leads
  for select
  using (organization_id in (select public.get_user_organizations()));

create policy "Admins/Staff can manage leads"
  on public.leads
  for all
  using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

-- Trigger for updated_at
create trigger set_leads_updated_at
  before update on public.leads
  for each row execute procedure public.set_current_timestamp_updated_at();
