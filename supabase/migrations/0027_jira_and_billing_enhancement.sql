-- 0027_jira_and_billing_enhancement.sql
-- Adds Jira issue tracking fields to tickets and advanced billing template fields to invoices

-- 1. Jira fields on tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS issue_type text DEFAULT 'Task';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS steps_to_reproduce text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS expected_result text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS actual_result text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS resolution text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS environment text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS estimate_points integer DEFAULT 1;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS component text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

-- 2. Enhanced invoice fields from billingsystem
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS template text DEFAULT 'modern';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS po_number text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_terms text DEFAULT 'Due on receipt';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS shipping numeric(12,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_rate numeric(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_rate numeric(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_name text DEFAULT 'Freelancecomm';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_email text DEFAULT 'billing@freelancecomm.site';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_address text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_phone text;

-- 3. Add index on tickets issue_type and component for fast Jira queries
CREATE INDEX IF NOT EXISTS idx_tickets_issue_type ON public.tickets(issue_type);
CREATE INDEX IF NOT EXISTS idx_tickets_component ON public.tickets(component);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON public.invoices(subscription_id);
