// Local backend without Docker:  npm run dev:api
//   • PGlite (in-memory Postgres) with all migrations + seed
//   • a minimal PostgREST stand-in for  POST /rest/v1/rpc/<fn>   (role = anon, or service_role with the dev service key)
//   • the REAL Edge Functions run under Deno and proxied at /functions/v1/<name>
//   • a PATCH /rest/v1/<table>?col=eq.val stand-in (service_role only) for the SMS worker / webhook
//   • SMS: send-sms runs in DRY_RUN unless you export SMS_DRY_RUN=false + SMSETHIOPIA_API_KEY.
//     pg_net / pg_cron don't exist in PGlite, so this script kicks the worker after each booking call
//     and runs reminders + the worker tick every 30 s. Inspect the outbox at GET /dev/sms.
// Data is reset on every start.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const PORT = 54321;
export const DEV_ANON_KEY = 'dev-anon-key';
export const DEV_SERVICE_KEY = 'dev-service-role-key';
const FUNCTIONS = { 'create-booking': 54331, 'manage-booking': 54332, 'send-sms': 54333, 'sms-delivery-webhook': 54334 };
const DEV_WORKER_SECRET = 'dev-worker-secret';
const DEV_WEBHOOK_SECRET = 'dev-webhook-secret';
const SMS_DRY_RUN = process.env.SMS_DRY_RUN ?? 'true';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(join(root, ...p), 'utf8');

// ---- database ----------------------------------------------------------------
const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
await db.exec(read('scripts/pglite/supabase-stub.sql'));
for (const f of readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(read('supabase/migrations', f));
}
await db.exec(read('supabase/seed.sql'));
await db.exec(`update public.settings set public_site_url = 'http://localhost:5173'`); // SMS {manage_link} → local site
console.log('✓ database ready (migrations + seed)');

const fnMeta = new Map(); // name → { retset, scalar }
async function meta(name) {
  if (!fnMeta.has(name)) {
    const r = await db.query(
      `select p.proretset, t.typtype from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       join pg_type t on t.oid = p.prorettype where n.nspname = 'public' and p.proname = $1 limit 1`,
      [name],
    );
    fnMeta.set(name, r.rows[0] ? { retset: r.rows[0].proretset, composite: r.rows[0].typtype === 'c' || r.rows[0].proretset } : null);
  }
  return fnMeta.get(name);
}

let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

async function rpc(name, args, role) {
  const m = await meta(name);
  if (!m) return { status: 404, body: { code: 'PGRST202', message: `function ${name} not found` } };
  const keys = Object.keys(args);
  if (keys.some((k) => !/^[a-z_][a-z0-9_]*$/.test(k))) return { status: 400, body: { message: 'bad arg name' } };
  const call = `public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`;
  const sql = m.composite ? `select * from ${call}` : `select ${call} as result`;
  return serial(async () => {
    try {
      const rows = await db.transaction(async (tx) => {
        await tx.exec(`set local role ${role}`);
        return (await tx.query(sql, keys.map((k) => args[k]))).rows;
      });
      return { status: 200, body: m.composite ? rows : rows[0]?.result ?? null };
    } catch (e) {
      const status = e.code === 'P0001' ? 400 : e.code === '42501' ? 401 : 400;
      return { status, body: { code: e.code, message: e.message, details: null, hint: null } };
    }
  });
}

// ---- Edge Functions under Deno -----------------------------------------------------
const denoBin = join(root, 'node_modules/.bin', process.platform === 'win32' ? 'deno.cmd' : 'deno');
for (const [name, port] of Object.entries(FUNCTIONS)) {
  const child = spawn(denoBin, ['run', '--allow-net', '--allow-env', '--allow-read', 'index.ts'], {
    cwd: join(root, 'supabase/functions', name),
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DENO_SERVE_ADDRESS: `tcp:127.0.0.1:${port}`,
      SUPABASE_URL: `http://127.0.0.1:${PORT}`,
      SUPABASE_SERVICE_ROLE_KEY: DEV_SERVICE_KEY,
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY ?? '1x0000000000000000000000000000000AA',
      ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173',
      PUBLIC_SITE_URL: 'http://localhost:5173',
      SMS_DRY_RUN,
      SMS_WORKER_SECRET: DEV_WORKER_SECRET,
      SMS_WEBHOOK_SECRET: DEV_WEBHOOK_SECRET,
      SMSETHIOPIA_API_KEY: process.env.SMSETHIOPIA_API_KEY ?? '',
      SMSETHIOPIA_BASE_URL: process.env.SMSETHIOPIA_BASE_URL ?? 'https://smsethiopia.com',
    },
  });
  child.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  process.on('exit', () => child.kill());
}

// ---- table PATCH (supabase-js .update().eq()) ------------------------------------
const ident = /^[a-z_][a-z0-9_]*$/;
async function patchTable(table, params, patch, prefer) {
  const filters = [...params].filter(([k]) => k !== 'select');
  const cols = Object.keys(patch ?? {});
  if (!ident.test(table) || !cols.length || cols.some((c) => !ident.test(c)) || !filters.length
      || filters.some(([k, v]) => !ident.test(k) || !v.startsWith('eq.'))) {
    return { status: 400, body: { message: 'dev-api PATCH supports only ?col=eq.value filters' } };
  }
  const vals = cols.map((c) => patch[c]);
  const set = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
  const where = filters.map(([k], i) => `${k} = $${cols.length + i + 1}`).join(' and ');
  const sql = `update public.${table} set ${set} where ${where} returning *`;
  return serial(async () => {
    try {
      const rows = await db.transaction(async (tx) => {
        await tx.exec('set local role service_role');
        return (await tx.query(sql, [...vals, ...filters.map(([, v]) => v.slice(3))])).rows;
      });
      const headers = /count=exact/.test(prefer) ? { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } : {};
      return /return=representation/.test(prefer) ? { status: 200, body: rows, headers } : { status: 204, body: null, headers };
    } catch (e) {
      return { status: 400, body: { code: e.code, message: e.message, details: null, hint: null } };
    }
  });
}

// ---- SMS worker kick (stands in for pg_net + pg_cron) ---------------------------
let kickTimer;
function kickWorker(delay = 300) {
  clearTimeout(kickTimer);
  kickTimer = setTimeout(async () => {
    try {
      const r = await fetch(`http://127.0.0.1:${FUNCTIONS['send-sms']}/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-worker-secret': DEV_WORKER_SECRET },
        body: '{}',
      });
      const out = await r.json().catch(() => ({}));
      if (out.sent || out.logged || out.failed || out.retrying) console.log('[sms-worker]', JSON.stringify(out));
    } catch { /* worker not up yet; the interval retries */ }
  }, delay);
}
setInterval(async () => {
  try {
    const due = await serial(async () => {
      await db.query('select public.enqueue_due_reminders()');
      return (await db.query('select public.sms_worker_tick() as due')).rows[0]?.due;
    });
    if (due) kickWorker(0);
  } catch (e) {
    console.error('[sms-tick]', e.message);
  }
}, 30_000);

// ---- HTTP ------------------------------------------------------------------------
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, prefer, content-profile',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');

  const fnMatch = /^\/functions\/v1\/([a-z-]+)$/.exec(url.pathname);
  if (fnMatch && FUNCTIONS[fnMatch[1]]) {
    try {
      const r = await fetch(`http://127.0.0.1:${FUNCTIONS[fnMatch[1]]}/${url.search}`, {
        method: req.method,
        headers: {
          'content-type': req.headers['content-type'] ?? 'application/json',
          origin: req.headers.origin ?? '',
          'x-forwarded-for': '127.0.0.1',
          ...(req.headers['x-worker-secret'] ? { 'x-worker-secret': req.headers['x-worker-secret'] } : {}),
        },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : raw,
      });
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      if (fnMatch[1] === 'create-booking' || fnMatch[1] === 'manage-booking') kickWorker();
    } catch {
      res.writeHead(502, cors).end(JSON.stringify({ error: { code: 'SERVER_ERROR', details: 'function not running yet' } }));
    }
    return;
  }

  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();

  if (url.pathname === '/dev/sms' && req.method === 'GET') {
    const rows = await serial(async () => (await db.query(
      `select created_at, type, to_phone, status, segments, encoding, attempts, error_code, error, body
       from public.sms_log order by created_at desc limit 50`)).rows);
    res.writeHead(200, { ...cors, 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(rows, null, 2));
  }

  const tableMatch = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
  if (tableMatch && req.method === 'PATCH') {
    const key = req.headers.apikey ?? (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (key !== DEV_SERVICE_KEY) return res.writeHead(401, cors).end(JSON.stringify({ message: 'service_role only in dev-api' }));
    let patch = {};
    try { patch = raw ? JSON.parse(raw) : {}; } catch { /* empty */ }
    const out = await patchTable(tableMatch[1], url.searchParams, patch, String(req.headers.prefer ?? ''));
    res.writeHead(out.status, { ...cors, 'content-type': 'application/json', ...(out.headers ?? {}) });
    return res.end(out.body === null ? undefined : JSON.stringify(out.body));
  }

  const rpcMatch = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
  if (rpcMatch && req.method === 'POST') {
    const key = req.headers.apikey ?? (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const role = key === DEV_SERVICE_KEY ? 'service_role' : 'anon';
    let args = {};
    try { args = raw ? JSON.parse(raw) : {}; } catch { /* empty */ }
    const out = await rpc(rpcMatch[1], args, role);
    let body = out.body;
    if (out.status === 200 && /vnd\.pgrst\.object/.test(req.headers.accept ?? '')) {
      if (!Array.isArray(body) || body.length !== 1) {
        return res.writeHead(406, { ...cors, 'content-type': 'application/json' })
          .end(JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }));
      }
      body = body[0];
    }
    res.writeHead(out.status, { ...cors, 'content-type': 'application/json' });
    return res.end(JSON.stringify(body));
  }

  res.writeHead(404, cors).end(JSON.stringify({ message: 'not found in dev-api' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`✓ dev API on http://127.0.0.1:${PORT}`);
  console.log(`  web app env: VITE_SUPABASE_URL=http://127.0.0.1:${PORT}  VITE_SUPABASE_ANON_KEY=${DEV_ANON_KEY}`);
  console.log(`  SMS: ${SMS_DRY_RUN === 'false' ? 'LIVE (SMS Ethiopia)' : 'dry run'} · outbox at http://127.0.0.1:${PORT}/dev/sms`);
});
