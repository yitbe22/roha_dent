-- Tiny subset of pgTAP so the same test files run under PGlite (no pgTAP build available).
-- Functions are SECURITY INVOKER so test SQL runs as the role the test switched to.
create schema if not exists tap;
grant usage on schema tap to public;

create function public.plan(n int) returns text language sql as $$ select '1..' || n $$;
create function public.finish() returns setof text language sql as $$ select null::text where false $$;

create function public.ok(cond boolean, descr text default '') returns text language sql as $$
  select case when cond then 'ok - ' else 'not ok - ' end || coalesce(descr, '')
$$;

create function public.is(have anyelement, want anyelement, descr text default '') returns text
language sql as $$
  select case when have is not distinct from want then 'ok - ' || coalesce(descr, '')
              else 'not ok - ' || coalesce(descr, '') || ' (have: ' || coalesce(have::text, 'NULL')
                   || ', want: ' || coalesce(want::text, 'NULL') || ')' end
$$;

create function public.isnt(have anyelement, want anyelement, descr text default '') returns text
language sql as $$
  select case when have is distinct from want then 'ok - ' || coalesce(descr, '')
              else 'not ok - ' || coalesce(descr, '') || ' (both: ' || coalesce(have::text, 'NULL') || ')' end
$$;

create function public.lives_ok(sql text, descr text default '') returns text language plpgsql as $$
begin
  execute sql;
  return 'ok - ' || coalesce(descr, '');
exception when others then
  return 'not ok - ' || coalesce(descr, '') || ' (died: ' || sqlstate || ' ' || sqlerrm || ')';
end $$;

create function public.throws_ok(sql text, errcode text, errmsg text, descr text) returns text
language plpgsql as $$
begin
  execute sql;
  return 'not ok - ' || coalesce(descr, '') || ' (no exception thrown)';
exception when others then
  if (errcode is null or sqlstate = errcode) and (errmsg is null or sqlerrm = errmsg) then
    return 'ok - ' || coalesce(descr, '');
  end if;
  return 'not ok - ' || coalesce(descr, '') || ' (got: ' || sqlstate || ' ' || sqlerrm
         || ', want: ' || coalesce(errcode, '*') || ' ' || coalesce(errmsg, '*') || ')';
end $$;

grant execute on function public.plan(int), public.finish(), public.ok(boolean, text), public.is(anyelement, anyelement, text), public.isnt(anyelement, anyelement, text), public.lives_ok(text, text), public.throws_ok(text, text, text, text) to public;
