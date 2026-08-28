-- ============================================================
-- Migration 0014: Client-user link, feature requests, meetings
-- ============================================================

-- 1. Add client_id to organization_members
-- This links a CLIENT_ADMIN or CLIENT_USER to their specific client record
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_org_members_client_id ON public.organization_members(client_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON public.organization_members(role);

-- 2. Helper function: get authenticated user's client_id (for client users)
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT client_id
  FROM organization_members
  WHERE user_id = auth.uid()
    AND role IN ('CLIENT_ADMIN', 'CLIENT_USER')
    AND client_id IS NOT NULL
  LIMIT 1;
$$;

-- 3. Helper function: get user profile with role info
CREATE OR REPLACE FUNCTION public.get_user_profile_with_role()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'profile', row_to_json(p),
    'memberships', (
      SELECT json_agg(json_build_object(
        'organization_id', om.organization_id,
        'role', om.role,
        'client_id', om.client_id,
        'organization_name', o.name
      ))
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
    )
  ) INTO result
  FROM profiles p
  WHERE p.id = auth.uid();

  RETURN result;
END;
$$;

-- 4. Feature Requests table
CREATE TABLE IF NOT EXISTS public.feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  business_reason text,
  priority text NOT NULL DEFAULT 'Normal',
  status text NOT NULL DEFAULT 'Submitted',  -- Submitted, Under Review, Approved, Rejected, Planned, In Progress, Completed
  admin_notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view feature_requests" ON public.feature_requests
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Org manage feature_requests" ON public.feature_requests
  FOR ALL USING (
    public.has_role_in_organization(organization_id, ARRAY['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER', 'SUPPORT_AGENT', 'CLIENT_ADMIN', 'CLIENT_USER']::public.user_role[])
  );

CREATE TRIGGER set_feature_requests_updated_at
  BEFORE UPDATE ON public.feature_requests
  FOR EACH ROW EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- 5. Meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  organizer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  timezone text DEFAULT 'UTC',
  status text NOT NULL DEFAULT 'Scheduled',  -- Scheduled, In Progress, Completed, Cancelled, No Show
  jitsi_room_name text,
  meeting_url text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Meeting Participants
CREATE TABLE IF NOT EXISTS public.meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'Invited',  -- Invited, Accepted, Declined, Attended
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (meeting_id, user_id)
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view meetings" ON public.meetings
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Org manage meetings" ON public.meetings
  FOR ALL USING (
    public.has_role_in_organization(organization_id, ARRAY['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[])
  );

CREATE POLICY "Users view own meeting participation" ON public.meeting_participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR meeting_id IN (
      SELECT id FROM public.meetings WHERE organization_id IN (SELECT public.get_user_organizations())
    )
  );

CREATE TRIGGER set_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- 6. Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON public.clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON public.subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON public.subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON public.tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_meetings_client_id ON public.meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON public.meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_feature_requests_client_id ON public.feature_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_client_id ON public.bug_reports(client_id);
