create or replace function public.get_dashboard_metrics(org_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  total_clients int;
  active_mrr numeric;
  outstanding_invoices numeric;
  active_projects int;
begin
  -- Check permission
  if not public.has_role_in_organization(org_id, array['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER']::public.user_role[]) then
    raise exception 'Unauthorized';
  end if;

  select count(*) into total_clients
  from clients where organization_id = org_id;

  -- Add yearly subscriptions divided by 12, etc. for better MRR accuracy if needed
  -- Simple MRR logic for now: sum of active monthly subscriptions
  select coalesce(sum(amount), 0) into active_mrr
  from subscriptions
  where organization_id = org_id and status = 'Active' and interval = 'monthly';

  select coalesce(sum(total - amount_paid), 0) into outstanding_invoices
  from invoices
  where organization_id = org_id and status not in ('Paid', 'Void', 'Draft');

  select count(*) into active_projects
  from projects
  where organization_id = org_id and status = 'Active';

  return json_build_object(
    'total_clients', total_clients,
    'mrr', active_mrr,
    'outstanding_invoices', outstanding_invoices,
    'active_projects', active_projects
  );
end;
$$;
