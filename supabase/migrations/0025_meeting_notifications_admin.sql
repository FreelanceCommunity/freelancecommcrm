-- 0025_meeting_notifications_admin.sql
-- Fix meeting trigger to notify BOTH org admins AND client users when a meeting is scheduled

CREATE OR REPLACE FUNCTION public.trigger_new_meeting_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_name text;
  v_start_formatted text;
BEGIN
  -- Format start time for display
  v_start_formatted := to_char(NEW.start_time AT TIME ZONE 'UTC', 'Mon DD, YYYY HH12:MI AM');

  -- Always notify org admins/owners/staff about new meetings
  PERFORM public.notify_org_admins(
    NEW.organization_id,
    'meeting_scheduled',
    'Meeting Scheduled: ' || NEW.title,
    'Scheduled for ' || v_start_formatted,
    '/app/meetings'
  );

  -- Additionally notify client users if meeting is associated with a client
  IF NEW.client_id IS NOT NULL THEN
    SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;

    INSERT INTO public.notifications (organization_id, user_id, type, title, message, link_url)
    SELECT 
      NEW.organization_id,
      om.user_id,
      'meeting_scheduled',
      'New Meeting Scheduled: ' || NEW.title,
      'Your meeting is scheduled for ' || v_start_formatted,
      '/portal/meetings'
    FROM public.organization_members om
    WHERE om.organization_id = NEW.organization_id
      AND om.client_id = NEW.client_id
      AND om.user_id != NEW.organizer_id; -- don't notify the organizer
  END IF;

  RETURN NEW;
END;
$$;

-- Re-create trigger (drop if exists)
DROP TRIGGER IF EXISTS on_meeting_scheduled ON public.meetings;
CREATE TRIGGER on_meeting_scheduled
  AFTER INSERT ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_new_meeting_notification();

-- Also add a trigger for meeting UPDATES (time changes, etc.)
CREATE OR REPLACE FUNCTION public.trigger_meeting_update_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only notify if start_time or title changed
  IF NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.title IS DISTINCT FROM OLD.title THEN
    PERFORM public.notify_org_admins(
      NEW.organization_id,
      'meeting_updated',
      'Meeting Updated: ' || NEW.title,
      'Meeting time or details have changed.',
      '/app/meetings'
    );

    IF NEW.client_id IS NOT NULL THEN
      INSERT INTO public.notifications (organization_id, user_id, type, title, message, link_url)
      SELECT 
        NEW.organization_id,
        om.user_id,
        'meeting_updated',
        'Meeting Updated: ' || NEW.title,
        'Your meeting details have been updated.',
        '/portal/meetings'
      FROM public.organization_members om
      WHERE om.organization_id = NEW.organization_id
        AND om.client_id = NEW.client_id
        AND om.user_id != auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_meeting_updated ON public.meetings;
CREATE TRIGGER on_meeting_updated
  AFTER UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_meeting_update_notification();
