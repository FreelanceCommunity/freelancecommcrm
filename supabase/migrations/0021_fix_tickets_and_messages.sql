-- ==============================================================================
-- Migration 0021: Fix ticket_messages insert policy & add client_messages features
-- ==============================================================================

-- 1. Add INSERT policy for ticket_messages
create policy "Users can insert messages on their org tickets"
  on public.ticket_messages
  for insert
  with check (
    ticket_id in (select id from public.tickets where organization_id in (select public.get_user_organizations()))
    and user_id = auth.uid()
  );

-- 2. Add columns to client_messages for WhatsApp-style features
ALTER TABLE public.client_messages
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_client_messages_read_at ON public.client_messages(read_at);
CREATE INDEX IF NOT EXISTS idx_client_messages_deleted_at ON public.client_messages(deleted_at);

-- 3. Add UPDATE policy for client_messages so users can mark as read or delete their own messages
create policy "Users can update their own org messages"
  on public.client_messages
  for update
  using (organization_id in (select public.get_user_organizations()));
