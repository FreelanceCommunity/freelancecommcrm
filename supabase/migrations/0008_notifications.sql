create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text,
  is_read boolean default false,
  link_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.notifications enable row level security;

create policy "Users can view own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "Users can update own notifications" on public.notifications for update using (user_id = auth.uid());
