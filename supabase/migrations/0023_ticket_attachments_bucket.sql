-- ==============================================================================
-- Migration 0023: Ticket attachments bucket and cleanup
-- ==============================================================================

-- 1. Create a public bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket_attachments', 'ticket_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated users to upload and read from the bucket
CREATE POLICY "Authenticated users can upload ticket attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ticket_attachments');

CREATE POLICY "Authenticated users can read ticket attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ticket_attachments');

CREATE POLICY "Authenticated users can update ticket attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ticket_attachments');

CREATE POLICY "Authenticated users can delete ticket attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ticket_attachments');

-- 3. Create a function to delete old attachments (simulating the cron job)
-- This function can be called via pg_cron or Edge Functions
CREATE OR REPLACE FUNCTION public.cleanup_closed_ticket_attachments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket_id uuid;
  v_attachment_url text;
BEGIN
  -- Find messages in closed tickets that have attachments and were updated/closed over 2 days ago
  -- Note: We just nullify the attachment_url in the database to soft-delete it from UI.
  -- Hard-deleting from storage would require an Edge Function or http request.
  UPDATE public.ticket_messages
  SET attachment_url = NULL
  WHERE attachment_url IS NOT NULL
    AND ticket_id IN (
      SELECT id FROM public.tickets 
      WHERE status = 'Closed' 
        AND updated_at < now() - interval '2 days'
    );
END;
$$;
