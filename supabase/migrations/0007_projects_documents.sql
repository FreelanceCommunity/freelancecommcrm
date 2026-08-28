-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  name text not null,
  description text,
  start_date date,
  target_date date,
  status text not null default 'Planning', -- Planning, Active, On Hold, Completed, Cancelled
  budget numeric(12,2),
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Project Members
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'Member',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  priority text default 'Normal',
  status text default 'Todo', -- Todo, In Progress, Review, Completed
  due_date date,
  estimated_hours numeric(6,2),
  actual_hours numeric(6,2),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  file_path text not null,
  file_type text,
  file_size integer,
  bucket_name text not null default 'client-documents',
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;

-- Setup basic standard RLS
create policy "Org view projects" on public.projects for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage projects" on public.projects for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

create policy "Org view tasks" on public.tasks for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage tasks" on public.tasks for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]));

create policy "Org view documents" on public.documents for select using (organization_id in (select public.get_user_organizations()));
create policy "Org manage documents" on public.documents for all using (public.has_role_in_organization(organization_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER', 'CLIENT_ADMIN', 'CLIENT_USER']::public.user_role[]));

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_current_timestamp_updated_at();

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_current_timestamp_updated_at();
