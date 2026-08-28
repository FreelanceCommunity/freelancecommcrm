-- 0016_chat_messages.sql

CREATE TABLE IF NOT EXISTS public.client_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view messages" ON public.client_messages
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Org manage messages" ON public.client_messages
  FOR ALL USING (
    public.has_role_in_organization(organization_id, ARRAY['OWNER', 'ADMIN', 'STAFF', 'SUPPORT_AGENT', 'CLIENT_ADMIN', 'CLIENT_USER']::public.user_role[])
  );

-- Function to notify when a new chat message arrives
CREATE OR REPLACE FUNCTION public.trigger_chat_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sender_role text;
  v_client_name text;
BEGIN
  -- Get sender role
  SELECT role INTO sender_role FROM public.organization_members WHERE user_id = NEW.sender_id AND organization_id = NEW.organization_id LIMIT 1;

  IF sender_role IN ('CLIENT_ADMIN', 'CLIENT_USER') THEN
    SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
    -- Notify admins
    PERFORM public.notify_org_admins(
      NEW.organization_id,
      'new_message',
      'New Message from ' || COALESCE(v_client_name, 'Client'),
      substring(NEW.message from 1 for 100),
      '/app/messages/' || NEW.client_id
    );
  ELSE
    -- Notify client users
    INSERT INTO public.notifications (organization_id, user_id, type, title, message, link_url)
    SELECT NEW.organization_id, user_id, 'new_message', 'New Message from Team', substring(NEW.message from 1 for 100), '/portal/messages'
    FROM public.organization_members
    WHERE organization_id = NEW.organization_id
      AND client_id = NEW.client_id
      AND user_id != NEW.sender_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_chat_message ON public.client_messages;
CREATE TRIGGER on_new_chat_message
  AFTER INSERT ON public.client_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_chat_notification();
