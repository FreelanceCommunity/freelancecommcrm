do $$
declare
  org_id uuid;
  green_sports_id uuid;
  davida_id uuid;
  cogial_id uuid;
  groundworks_id uuid;
begin
  -- Get or create main org
  select id into org_id from organizations order by created_at asc limit 1;
  if org_id is null then
    insert into organizations (name) values ('MYSTEL HQ') returning id into org_id;
  end if;

  -- 1. Green Sports
  insert into clients (organization_id, name, country, state, status, notes)
  values (org_id, 'Green Sports', 'Australia', 'Queensland', 'Active', 'Mobile app and website development support and maintenance.')
  returning id into green_sports_id;

  insert into contacts (client_id, organization_id, first_name, last_name, phone, is_primary)
  values (green_sports_id, org_id, 'Jon', 'Green', '+61 433 509 919', true);

  insert into services (organization_id, client_id, name)
  values (org_id, green_sports_id, 'Mobile App'), (org_id, green_sports_id, 'Website');

  insert into subscriptions (organization_id, client_id, amount, currency, interval, start_date, status)
  values (org_id, green_sports_id, 40, 'USD', 'Monthly', current_date, 'Active');

  -- 2. Davida
  insert into clients (organization_id, name, country, state, status, notes)
  values (org_id, 'Davida', 'USA', 'New York', 'Active', 'SCOMS SIP and Talk')
  returning id into davida_id;

  insert into contacts (client_id, organization_id, first_name, last_name, phone, is_primary)
  values (davida_id, org_id, 'Not', 'provided', '+1 (272) 332-2690', true);

  insert into services (organization_id, client_id, name)
  values (org_id, davida_id, 'Complete development support'), (org_id, davida_id, 'IT support');

  insert into projects (organization_id, client_id, name, status)
  values (org_id, davida_id, 'SCOMS SIP and Talk', 'Active');

  insert into subscriptions (organization_id, client_id, amount, currency, interval, start_date, status)
  values (org_id, davida_id, 150, 'USD', 'Monthly', current_date, 'Active');

  -- 3. Cogial
  insert into clients (organization_id, name, country, status)
  values (org_id, 'Cogial', 'UK', 'Active')
  returning id into cogial_id;

  insert into contacts (client_id, organization_id, first_name, last_name, phone, is_primary)
  values (cogial_id, org_id, 'Not', 'provided', '+44 7445 027215', true);

  insert into services (organization_id, client_id, name)
  values (org_id, cogial_id, 'Cogial Website'), (org_id, cogial_id, 'Cogial Academy'), (org_id, cogial_id, 'Complete development support'), (org_id, cogial_id, 'Maintenance');

  insert into subscriptions (organization_id, client_id, amount, currency, interval, start_date, status)
  values (org_id, cogial_id, 80, 'USD', 'Monthly', current_date, 'Active');

  -- 4. Groundworks
  insert into clients (organization_id, name, country, status)
  values (org_id, 'Groundworks', 'UK', 'Active')
  returning id into groundworks_id;

  insert into contacts (client_id, organization_id, first_name, last_name, phone, is_primary)
  values (groundworks_id, org_id, 'Not', 'provided', '+44 7385 802270', true);

  insert into services (organization_id, client_id, name)
  values (org_id, groundworks_id, 'Website development'), (org_id, groundworks_id, 'Website support');

  insert into subscriptions (organization_id, client_id, amount, currency, interval, start_date, status)
  values (org_id, groundworks_id, 80, 'USD', 'Monthly', current_date, 'Active');

end;
$$;
