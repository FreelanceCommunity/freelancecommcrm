-- ==============================================================================
-- Migration 0022: Fix client_messages insert policy
-- ==============================================================================

-- Add a specific INSERT policy for client_messages to ensure clients can send messages
CREATE POLICY "Users can insert messages"
  ON public.client_messages
  FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT public.get_user_organizations())
    AND sender_id = auth.uid()
  );
