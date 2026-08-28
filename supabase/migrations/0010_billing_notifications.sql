create or replace function public.process_recurring_billing_notifications()
returns void
language plpgsql
security definer
as $$
declare
  sub record;
begin
  for sub in 
    select s.id, s.organization_id, s.client_id, s.next_billing_date, c.name as client_name
    from subscriptions s
    join clients c on c.id = s.client_id
    where s.status = 'Active' 
      and s.next_billing_date is not null
      and s.next_billing_date = current_date + interval '7 days'
  loop
    -- Insert a notification for the organization owners/admins
    insert into notifications (organization_id, user_id, type, title, message, link_url)
    select 
      sub.organization_id, 
      om.user_id, 
      'billing_reminder', 
      'Upcoming Subscription Renewal', 
      'Subscription for ' || sub.client_name || ' will renew in 7 days (' || sub.next_billing_date || ').', 
      '/app/subscriptions'
    from organization_members om
    where om.organization_id = sub.organization_id and om.role in ('OWNER', 'ADMIN', 'ACCOUNT_MANAGER');
  end loop;
end;
$$;
