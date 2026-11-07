-- 0017 — "Must change password" moves from user_metadata (which users can edit themselves) to
-- app_metadata (only the service role can write it). From now on the admin-users function sets it
-- on new accounts and password resets, and clears it only together with a real password change
-- (action set_own_password). This carries over accounts that still have a temporary password.
-- Guarded: the local PGlite test stub's auth.users has no metadata columns.

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'auth' and table_name = 'users' and column_name = 'raw_app_meta_data') then
    execute $q$
      update auth.users
         set raw_app_meta_data  = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"must_change_password": true}'::jsonb,
             raw_user_meta_data = raw_user_meta_data - 'must_change_password'
       where raw_user_meta_data ->> 'must_change_password' = 'true'
    $q$;
    execute $q$
      update auth.users
         set raw_user_meta_data = raw_user_meta_data - 'must_change_password'
       where raw_user_meta_data ? 'must_change_password'
    $q$;
  end if;
end $$;
