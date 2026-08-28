-- Create the client-documents bucket
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

-- Enable RLS for storage.objects
alter table storage.objects enable row level security;

-- Create policies for storage.objects
create policy "Allow authenticated users to view documents"
on storage.objects for select
to authenticated
using ( bucket_id = 'client-documents' );

create policy "Allow authenticated users to upload documents"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'client-documents' );

create policy "Allow authenticated users to delete documents"
on storage.objects for delete
to authenticated
using ( bucket_id = 'client-documents' );
