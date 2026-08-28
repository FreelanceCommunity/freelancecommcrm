-- Payment methods
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  stripe_payment_method_id text not null,
  type text default 'card',
  last4 text,
  exp_month integer,
  exp_year integer,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(12,2) not null,
  currency text default 'USD',
  status text not null default 'Pending', -- Pending, Succeeded, Failed, Refunded
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  stripe_payment_intent_id text,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;

-- Setup RLS Policies
create policy "Org view payment_methods" on public.payment_methods for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage payment_methods" on public.payment_methods for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

create policy "Org view payments" on public.payments for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage payments" on public.payments for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

create trigger set_payments_updated_at
  before update on public.payments
  for each row execute procedure public.set_current_timestamp_updated_at();
