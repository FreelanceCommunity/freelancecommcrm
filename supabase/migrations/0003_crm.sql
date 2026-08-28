-- Deals pipeline and stages
create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references public.pipelines(id) on delete cascade not null,
  name text not null,
  probability integer default 0,
  order_index integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Deals
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete set null,
  pipeline_id uuid references public.pipelines(id) on delete cascade not null,
  stage_id uuid references public.stages(id) on delete cascade not null,
  name text not null,
  value numeric(12,2) default 0,
  currency text default 'USD',
  expected_close_date date,
  source text,
  status text default 'Open', -- Open, Won, Lost
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Activities
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  deal_id uuid references public.deals(id) on delete cascade,
  type text not null, -- Note, Call, Email, Meeting
  title text not null,
  description text,
  activity_date timestamp with time zone default timezone('utc'::text, now()),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.pipelines enable row level security;
alter table public.stages enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;

-- Setup RLS Policies
create policy "Org view pipelines" on public.pipelines for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage pipelines" on public.pipelines for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

create policy "Org view stages" on public.stages for select using (pipeline_id in (select id from public.pipelines where organization_id in (select public.get_user_organizations())));
create policy "Org manage stages" on public.stages for all using (pipeline_id in (select id from public.pipelines where public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[])));

create policy "Org view deals" on public.deals for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage deals" on public.deals for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

create policy "Org view activities" on public.activities for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage activities" on public.activities for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER', 'SUPPORT_AGENT']::public.user_role[]));
