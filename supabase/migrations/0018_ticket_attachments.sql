-- Add attachment URL to ticket messages
alter table public.ticket_messages add column attachment_url text;

-- Add attachment URL to bug reports
alter table public.bug_reports add column attachment_url text;
