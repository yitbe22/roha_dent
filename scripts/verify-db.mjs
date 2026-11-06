// Applies every migration + seed to an in-memory Postgres (PGlite) with a Supabase stand-in,
// then runs supabase/tests/database/*.test.sql. No Docker needed.
//   npm run db:verify
// The authoritative run is still `supabase test db` against the real local stack.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(join(root, ...p), 'utf8');
const sqlFiles = (dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.sql')).sort();

const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
await db.exec(read('scripts/pglite/supabase-stub.sql'));

async function apply(label, sql) {
  try {
    await db.exec(sql);
    console.log(`  ✓ ${label}`);
  } catch (e) {
    console.error(`  ✗ ${label}\n    ${e.message}${e.position ? ` (at char ${e.position})` : ''}`);
    process.exit(1);
  }
}

console.log('Migrations');
for (const f of sqlFiles('supabase/migrations')) await apply(f, read('supabase/migrations', f));
console.log('Seed');
await apply('seed.sql', read('supabase/seed.sql'));
await apply('pgtap shim', read('scripts/pglite/pgtap-shim.sql'));

let failed = 0;
let passed = 0;
console.log('Tests');
for (const f of sqlFiles('supabase/tests/database')) {
  let results;
  try {
    results = await db.exec(read('supabase/tests/database', f));
  } catch (e) {
    console.error(`  ✗ ${f} aborted: ${e.message}`);
    await db.exec('rollback').catch(() => {});
    failed++;
    continue;
  }
  const lines = results
    .flatMap((r) => r.rows.map((row) => Object.values(row)[0]))
    .filter((v) => typeof v === 'string' && /^(ok|not ok|1\.\.)/.test(v));
  const planned = Number((lines.find((l) => l.startsWith('1..')) ?? '1..0').slice(3));
  const tests = lines.filter((l) => !l.startsWith('1..'));
  const bad = tests.filter((l) => l.startsWith('not ok'));
  passed += tests.length - bad.length;
  failed += bad.length;
  console.log(`  ${bad.length ? '✗' : '✓'} ${f}: ${tests.length - bad.length}/${tests.length} passed`);
  bad.forEach((l) => console.log(`      ${l}`));
  if (planned !== tests.length) {
    console.log(`      plan mismatch: planned ${planned}, ran ${tests.length}`);
    failed++;
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
