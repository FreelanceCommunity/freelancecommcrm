-- SQL script to make existing user an OWNER and update their password
DO $$
DECLARE
  target_email TEXT := 'sjaisurya2005@gmail.com';
  target_user_id UUID;
  org_id UUID := '55bcf9c2-c1fa-4faf-a48c-9a05c68a9edc'; -- MYSTEL HQ
BEGIN
  -- Get user ID
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

  IF target_user_id IS NOT NULL THEN
    -- Update password
    UPDATE auth.users 
    SET encrypted_password = crypt('Jaisurya@@2026', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = target_user_id;

    -- Upsert to organization_members as OWNER
    INSERT INTO public.organization_members (
      organization_id,
      user_id,
      role
    ) VALUES (
      org_id,
      target_user_id,
      'OWNER'
    )
    ON CONFLICT (organization_id, user_id) 
    DO UPDATE SET role = 'OWNER';
  END IF;
END $$;
