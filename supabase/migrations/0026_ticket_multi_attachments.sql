-- 0026_ticket_multi_attachments.sql
-- Add multi-file attachment arrays and app_location for tickets

-- 1. Add app_location to tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS app_location text;

-- 2. Add attachments array to tickets for multi-file upload (up to 10 files)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS attachments text[] DEFAULT '{}'::text[];

-- 3. Add attachments array to ticket_messages to support multiple images in replies
ALTER TABLE public.ticket_messages ADD COLUMN IF NOT EXISTS attachments text[] DEFAULT '{}'::text[];

-- Note: we keep the existing single attachment_url in ticket_messages for backwards compatibility
