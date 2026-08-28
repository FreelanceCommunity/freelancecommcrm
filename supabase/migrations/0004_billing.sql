-- Plans table
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  description text,
  amount numeric(12,2) not null,
  currency text default 'USD',
  interval text not null, -- Monthly, Quarterly, Yearly, Custom
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Subscriptions table
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  plan_id uuid references public.plans(id) on delete restrict,
  amount numeric(12,2) not null,
  currency text default 'USD',
  interval text not null,
  status text not null default 'Active', -- Trialing, Active, Past Due, Paused, Cancelled, Expired
  start_date date not null,
  next_billing_date date,
  trial_end_date date,
  cancellation_date date,
  cancellation_reason text,
  notes text,
  stripe_subscription_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Invoices table
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  invoice_number text not null,
  invoice_date date not null,
  due_date date,
  currency text default 'USD',
  subtotal numeric(12,2) default 0,
  tax_total numeric(12,2) default 0,
  discount_total numeric(12,2) default 0,
  total numeric(12,2) default 0,
  amount_paid numeric(12,2) default 0,
  status text not null default 'Draft', -- Draft, Sent, Viewed, Partially Paid, Paid, Overdue, Void, Cancelled
  notes text,
  terms text,
  stripe_invoice_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (organization_id, invoice_number)
);

-- Invoice items
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  description text not null,
  quantity numeric(12,2) default 1,
  unit_price numeric(12,2) default 0,
  tax_rate numeric(5,2) default 0,
  discount numeric(12,2) default 0,
  total numeric(12,2) default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

-- Setup RLS Policies
create policy "Org view plans" on public.plans for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage plans" on public.plans for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

create policy "Org view subscriptions" on public.subscriptions for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage subscriptions" on public.subscriptions for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

create policy "Org view invoices" on public.invoices for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage invoices" on public.invoices for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

create policy "Org view invoice_items" on public.invoice_items for select using (invoice_id in (select id from public.invoices where organization_id in (select public.get_user_organizations())));
create policy "Org manage invoice_items" on public.invoice_items for all using (invoice_id in (select id from public.invoices where public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[])));

-- Triggers for updated_at
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_current_timestamp_updated_at();

create trigger set_invoices_updated_at
  before update on public.invoices
  for each row execute procedure public.set_current_timestamp_updated_at();
