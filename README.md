# rohadent.com — Roha Speciality Dental Center

Public website, online booking, admin dashboard, and SMS notifications for Roha Speciality Dental Center (Addis Ababa and Gonder).

| Layer    | Tech |
|----------|------|
| Frontend | React + Vite + TypeScript, Tailwind, React Router, TanStack Query, React Hook Form + Zod, hosted on Cloudflare Pages |
| Backend  | Supabase (hosted): Postgres + RLS, Auth, Realtime, Edge Functions (Deno), pg_cron + pg_net |
| SMS      | [SMS Ethiopia](https://smsethiopia.com/#/landing/docs/api-v1) v2 API, called only from Edge Functions |

> Status: **Phases 1–3 (schema and RLS, public site, booking flow) done** and deployed to the hosted Supabase project. **Phase 4 (SMS) is built and tested locally**. Deploying it is covered in [SMS setup](#sms-setup-phase-4). Phases 5–6 (admin, hardening) are still to come.

**No Docker needed.** Everything below works with Node 20+ only. The Supabase CLI runs through `npx supabase@latest` and talks to the hosted project.

## Day-to-day

```bash
npm install
npm run dev        # http://localhost:5173, uses the Supabase project in apps/web/.env.local
npm test           # database tests (PGlite) + unit tests
npm run build      # type-check, client + SSR build, prerender to apps/web/dist/client
```

### Working offline or experimenting safely

```bash
npm run dev:api    # in-memory Postgres (PGlite) with all migrations and seed + the real Edge Functions under Deno
```

To use it, point `apps/web/.env.local` at it, then restart `npm run dev`:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=dev-anon-key
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```
The dev API resets on every start and uses Cloudflare's always-pass Turnstile test keys, so it needs an internet connection.

SMS runs in **dry-run** mode in the dev API. The worker runs after every booking or manage call, and every 30 s it also handles reminders and retries. Nothing is sent. To see the rendered messages, their segment counts and their statuses, open http://127.0.0.1:54321/dev/sms. To send real messages from your machine, which costs SMS credit, run `SMS_DRY_RUN=false SMSETHIOPIA_API_KEY=… npm run dev:api`.

## Tests

| Command | What it covers |
|---|---|
| `npm run db:verify` | All migrations and the seed in PGlite, then `supabase/tests/database/*.test.sql`: RLS, booking, double-booking, slots, workflow triggers, rate limiting |
| `npm run test:functions` | Deno: SMS Ethiopia adapter (request shape, error codes, retryable vs. final, status mapping) with a mocked `fetch` |
| `npm run test -w @roha/web` | Vitest: phone normalization, clinic timezone, slot grouping, SMS segment counting and template rendering |
| `npm test` | All of the above |

The `.test.sql` files are standard pgTAP. PGlite runs them through a small pgTAP shim (`scripts/pglite/`).

## Repo layout

```
apps/web/                React app: public site, booking, /admin (phase 5)
supabase/
  config.toml
  migrations/            Schema, RLS, RPCs, triggers, default config
  seed.sql               Locations, services, placeholder dentists, working hours
  tests/database/        pgTAP tests
  functions/
    _shared/             phone.ts, time.ts, schemas.ts, sms.ts are pure TS, also imported by the web app as @shared/*;
                         http.ts, db.ts, turnstile.ts are Deno-only
      providers/         smsethiopia.ts: the only file that knows the SMS provider's API
    _tests/              Deno tests for the provider adapter
    create-booking/      POST: Zod, phone check, rate limits, Turnstile, then book_appointment()
    manage-booking/      POST {action: get|cancel|reschedule, token}
    send-sms/            internal worker (x-worker-secret): sends queued sms_log rows, retries, polls delivery
    sms-delivery-webhook/  optional SMS Ethiopia delivery webhook (?secret=…)
scripts/
  dev-api.mjs            Local backend without Docker (PGlite + PostgREST stand-in + real functions)
  verify-db.mjs          Migrations + seed + tests in PGlite
docs/                    Launch checklist (phase 6)
```

## Data model

```
locations ─┬─< working_hours >── dentists ──< dentist_services >── services
           ├─< time_off (dentist_id null = whole clinic closed)
           ├─< appointments >── patients (1 per phone)
           │        ├── appointment_secrets (manage-link token, service_role only)
           │        └─< sms_log
           └─< profiles (staff → location, owner → all)
settings (1 row) · sms_templates (key × locale) · rate_limits · audit_log
```

Key rules:
- **No double-booking.** `appointments_no_overlap` is a btree_gist exclusion constraint on `(dentist_id, during)` that covers `pending` and `confirmed` appointments. It holds across both locations and for every write path, including direct SQL.
- **Slots** come from working hours (per dentist and location, on a 15-minute grid), minus time off, minus active appointments, and must start at least 2 hours from now and at most 60 days ahead. The slot length is the service duration. All of these values live in `settings`.
- **Online bookings** go through `book_appointment()`, which only `service_role` can execute (it is called from the `create-booking` Edge Function after Turnstile and rate-limit checks). With `dentist_id = null` ("any available"), the RPC picks the least-booked free dentist.
- **Manage links.** Each appointment gets a 256-bit random token, stored in `appointment_secrets`. Only Edge Functions can read it (they need it to put the link in SMS). Staff and anon have no access.
- **Phones** are stored in E.164 format. For now only `+2519XXXXXXXX` (Ethio Telecom) is accepted, because SMS Ethiopia only delivers to 2519 numbers.
- **Time** is stored as `timestamptz` (UTC). Clinic-local logic uses `Africa/Addis_Ababa` (`public.clinic_tz()`).

### Access (RLS)

| | anon | staff | owner |
|---|---|---|---|
| locations, services, dentists, working hours | read active | read all | read and write |
| slots (`get_available_slots`, `get_available_dates`, `get_booking_catalog`) | ✓ | ✓ | ✓ |
| appointments, patients, sms_log | — | own location | all |
| time_off, working_hours (write) | — | own location | all |
| settings, sms_templates | — | read | read and write |
| profiles | — | self | all |
| audit_log | — | — | read |
| appointment_secrets, rate_limits | — | — | — (service_role only) |

Staff can update only workflow columns on `appointments` (status, time, dentist, service, notes).

## Supabase project setup (hosted, no Docker)

Do the first two steps in a normal terminal, because login opens a browser:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref <project-ref>
```

Then:

```bash
npx supabase@latest db push --remote --include-seed    # migrations + seed (seed: first time only)
cp supabase/.env.example supabase/functions/.env       # fill in; never commit
npx supabase@latest secrets set --env-file supabase/functions/.env
npx supabase@latest functions deploy create-booking manage-booking send-sms sms-delivery-webhook --no-verify-jwt
```

In the dashboard:
- Enable the `pg_cron` and `pg_net` extensions.
- Turn off email sign-ups.

Set `apps/web/.env.local` to the project URL and the **publishable** (anon) key. Never use the service_role key in the web app.

### SMS setup (phase 4)

How it works: a change to an appointment fires a deferred trigger at commit. The trigger renders the template and adds rows to `sms_log` with status `queued`. pg_net then calls the `send-sms` Edge Function right away, and that function sends the messages through SMS Ethiopia. pg_cron covers anything the immediate call missed. It runs the worker tick every minute, which handles retries, stuck rows and delivery polling, and it runs reminders every 5 minutes (24 h and 2 h before the appointment). Because the rows come from the database itself, every path sends the right SMS: online booking, the patient's manage link, and dashboard edits. Every attempt is visible in `sms_log`.

1. **Extensions.** Enable `pg_cron` and `pg_net` in Dashboard → Database → Extensions *before* pushing migration `0008`, because the push is what creates the cron jobs. If they were enabled later, re-run the `do $$ … cron.schedule …` block at the end of `20261106000008_sms_outbox.sql` in the SQL editor.
2. **Push and deploy:**
   ```bash
   npx supabase@latest db push --remote
   npx supabase@latest functions deploy create-booking manage-booking send-sms sms-delivery-webhook --no-verify-jwt
   ```
3. **Secrets.** Generate two random strings, for example with `openssl rand -hex 32`. In `supabase/functions/.env`, set `SMS_WORKER_SECRET` and `SMS_WEBHOOK_SECRET` to them, keep `SMS_DRY_RUN=true` for now, then run `npx supabase@latest secrets set --env-file supabase/functions/.env`.
4. **Vault.** This is what pg_net uses to call the worker. In the SQL editor, run:
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<same value as SMS_WORKER_SECRET>', 'sms_worker_secret');
   ```
5. **Settings.** In `public.settings`, set `public_site_url` (used for `{manage_link}`), set `owner_alert_phones` (in `+2519…` format; these numbers get the new-booking alert), and set `sms_enabled` and `reminders_enabled`. Also set each location's `alert_phone`.
6. **Dry-run check.** Make a test booking. Within a few seconds `sms_log` should show rows with status `dry_run`. Check `select * from cron.job_run_details order by start_time desc limit 5;` and the `send-sms` function logs.
7. **Go live:**
   - In SMS Ethiopia, create a campaign and an API key, and top up the balance.
   - Apply for a **custom sender ID**, which Ethio Telecom has to approve, so it takes lead time. On the free Default campaign, messages go only to whitelisted numbers and include a test footer.
   - Set `SMSETHIOPIA_API_KEY`, change `SMS_DRY_RUN` to `false`, and run `secrets set` again.
   - Book with your own phone, then confirm that the row moves `accepted` → `delivered`.
8. **Webhook (optional).** The delivery-report add-on costs extra and is enabled through SMS Ethiopia support. Give support `https://<project-ref>.supabase.co/functions/v1/sms-delivery-webhook?secret=<SMS_WEBHOOK_SECRET>`. Without the webhook, the worker polls statuses for 24 hours.

Failures: provider error codes are stored in `sms_log.error_code`/`error`, for example 10005 (balance empty), 10006 (sender ID not approved) and 10007 (number not whitelisted). Network errors, 429 and 5xx are retried once after 60 s. Templates are in `sms_templates` and use the placeholders listed in `_shared/sms.ts`. An Amharic or other non-GSM character switches the message to 70-character segments, which costs more.

### First owner account

Go to **Authentication → Users → Add user**, then run this in the SQL editor:

```sql
insert into public.profiles (id, full_name, role)
select id, 'Clinic Owner', 'owner' from auth.users where email = 'owner@example.com';
```

Staff accounts are then created from the admin dashboard *(phase 5)*.

### Schema changes

1. Add a new file in `supabase/migrations/`.
2. Run `npm run db:verify`.
3. Run `npx supabase@latest db push --remote`.

Never edit a migration that has already been pushed.

## Environment variables

- `supabase/.env.example`: Edge Function secrets (SMS Ethiopia, Turnstile, site URL, allowed origins)
- `apps/web/.env.example`: public Vite variables (Supabase URL, publishable key, Turnstile site key)
