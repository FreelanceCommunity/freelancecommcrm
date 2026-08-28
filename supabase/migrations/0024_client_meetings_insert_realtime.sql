-- ==============================================================================
-- Migration 0024: Fix client meeting schedule and enable Realtime for chat
-- ==============================================================================

-- 1. Allow clients to insert meetings
CREATE POLICY "Clients can schedule meetings" ON public.meetings
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('CLIENT_ADMIN', 'CLIENT_USER')
    )
  );

-- 2. Add client_messages to realtime publication
-- Note: supabase_realtime publication may already exist, so we use a safe block
DO $$
BEGIN
  -- First check if the publication exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  
  -- Add the table to the publication, catching exception if it's already added
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_messages;
  EXCEPTION WHEN duplicate_object THEN
    -- do nothing if it's already there
  END;
END $$;
