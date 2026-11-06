-- Minimal stand-in for what a Supabase project provides before user migrations run.
-- Used ONLY by scripts/verify-db.mjs (PGlite). Real deployments use the real platform.
create role anon          nologin noinherit;
create role authenticated nologin noinherit;
create role service_role  nologin noinherit bypassrls;

create schema if not exists auth;
create schema if not exists extensions;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;

create table auth.users (
  id         uuid primary key,
  email      text,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to public;

-- Supabase grants these by default on objects created in public
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
