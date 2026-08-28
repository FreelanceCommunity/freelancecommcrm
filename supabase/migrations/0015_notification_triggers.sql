-- 0015_notification_triggers.sql

-- Helper function to notify admins/owners of an organization
CREATE OR REPLACE FUNCTION public.notify_org_admins(
  p_org_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_link_url text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (organization_id, user_id, type, title, message, link_url)
  SELECT p_org_id, user_id, p_type, p_title, p_message, p_link_url
  FROM public.organization_members
  WHERE organization_id = p_org_id
    AND role IN ('OWNER', 'ADMIN', 'STAFF', 'SUPPORT_AGENT');
END;
$$;

-- Trigger: New Ticket
CREATE OR REPLACE FUNCTION public.trigger_new_ticket_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_name text;
BEGIN
  -- Get client name for better notification
  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;

  -- Notify admins
  PERFORM public.notify_org_admins(
    NEW.organization_id,
    'ticket_created',
    'New Ticket: ' || NEW.ticket_number,
    'From ' || COALESCE(v_client_name, 'Unknown') || ': ' || NEW.title,
    '/app/support/' || NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ticket_created ON public.tickets;
CREATE TRIGGER on_ticket_created
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_new_ticket_notification();

-- Trigger: New Bug Report
CREATE OR REPLACE FUNCTION public.trigger_new_bug_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_name text;
BEGIN
  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  
  PERFORM public.notify_org_admins(
    NEW.organization_id,
    'bug_reported',
    'New Bug Report (' || NEW.severity || ')',
    'From ' || COALESCE(v_client_name, 'Unknown') || ': ' || NEW.title,
    '/app/support'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_bug_reported ON public.bug_reports;
CREATE TRIGGER on_bug_reported
  AFTER INSERT ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_new_bug_notification();

-- Trigger: New Meeting
CREATE OR REPLACE FUNCTION public.trigger_new_meeting_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We just notify admins right now, or if it has a client_id, we notify client users too.
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO public.notifications (organization_id, user_id, type, title, message, link_url)
    SELECT NEW.organization_id, user_id, 'meeting_scheduled', 'Meeting Scheduled: ' || NEW.title, 'Scheduled for ' || NEW.start_time, '/portal/meetings'
    FROM public.organization_members
    WHERE organization_id = NEW.organization_id
      AND client_id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_meeting_scheduled ON public.meetings;
CREATE TRIGGER on_meeting_scheduled
  AFTER INSERT ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_new_meeting_notification();
