-- 0028_billing_customization.sql
-- Ensure all invoice customization columns exist, remove hardcoded billing@freelancecomm.site, and add footer_note

-- 1. Ensure all company & template columns exist on invoices first (idempotent)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_name text DEFAULT 'Freelancecomm';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_email text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_address text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_phone text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS footer_note text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS template text DEFAULT 'modern';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS po_number text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_terms text DEFAULT 'Due on receipt';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS shipping numeric(12,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_rate numeric(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_rate numeric(10,2) DEFAULT 0;

-- 2. Remove default billing@freelancecomm.site constraint from company_email column if present
DO $$
BEGIN
  ALTER TABLE public.invoices ALTER COLUMN company_email DROP DEFAULT;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignore if no default existed
END $$;

-- 3. Clean up any existing invoices where company_email was automatically set to billing@freelancecomm.site
UPDATE public.invoices 
SET company_email = NULL 
WHERE company_email = 'billing@freelancecomm.site';

-- 4. Set a pleasant default footer note on existing invoices that don't have one
UPDATE public.invoices
SET footer_note = 'Thank you for choosing ' || COALESCE(company_name, 'Freelancecomm') || '.'
WHERE footer_note IS NULL;
