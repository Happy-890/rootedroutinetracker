# Rooted

**Build what matters, daily.** Rooted is a mobile-first habit tracker and installable web app for Faith, Family, Fitness, and Finance, with private gratitude and journal entries.

- [Live app](https://rootedroutinetracker.lovable.app)
- [Lovable project](https://lovable.dev/projects/601f52f6-a142-479d-a94d-4ad23813b0cc)

This README describes the code on `main` and the live application's `public` database schema inspected on **October 26, 2026**. The inspection covered all nine application tables, columns, constraints, indexes, RLS policies, table grants, public functions, and public triggers. It did not export user records, journal text, device credentials, or signing keys. Managed Auth internals, the scheduler configuration, and the migration ledger were not independently verified through the available database interface.

## App behavior

| Area         | Implemented behavior                                                                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home         | Four pillar cards, a compact today/period stats strip with a Day–Week–Month dropdown, and a taller chart. All-time points stay in the header. Six Faith/Family/Fitness habits toggle directly; Finance opens Learn or Plan.                                                          |
| Finance      | Learn saves a written entry. Plan awards its activity after two review attestations. No banking or calendar integration.                                                                                                                                                             |
| Gratitude    | Three required items, saved as an entry.                                                                                                                                                                                                                                             |
| Journal      | Free-Flow, Re-Frame with nine guided questions, and Devotional; drafts survive navigation and refresh.                                                                                                                                                                               |
| History      | Date/type filtering, activity history, and entry viewing/editing.                                                                                                                                                                                                                    |
| Settings     | Circular icon-only Light/Dark/Device menu, profile name/timezone auto-save on blur, account controls, expandable iOS-style reminder banners using the same icon as Web Push, automatic setup confirmation and device notification instructions, and JSON export. Server delivery logging continues; its Settings panel is hidden. |
| Accounts     | Supabase email/password authentication, password reset, managed Lovable social sign-in, and device-only guest mode.                                                                                                                                                                  |
| Installation | PWA manifest, app icons, Safari Add to Home Screen guidance, offline shell, and Web Push worker.                                                                                                                                                                                     |

Community features, chat, payments, bank connections, and AI coaching are outside the current app.

## Stack and code map

React 19, TypeScript, TanStack Start/Router, Vite, Tailwind CSS, shadcn/ui, Supabase Auth/PostgreSQL, Drizzle SQL migrations, Vitest, and generated Workbox caching. Lovable manages the connected project and hosting workflow.

| Path                                    | Responsibility                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/routes/`                           | Home, Finance, Gratitude, Journal, History, Settings, password reset, and reminder job route. |
| `src/components/rooted/`                | Shared shell, authentication UI, and reminder settings.                                       |
| `src/lib/rooted/logic.ts`               | Pure scoring, streaks, chart aggregation, calendar math, and validation helpers.              |
| `src/lib/rooted/store.tsx`              | Shared account/guest state, save status, drafts, and focus/day rollover.                      |
| `src/lib/rooted/repo.ts`                | Cloud and local repositories, paginated reads, and guest import.                              |
| `src/lib/rooted/reminders.functions.ts` | Authenticated reminder CRUD, device registration, setup confirmation, and event-log reads.                 |
| `src/lib/rooted/push.server.ts`         | Encrypted VAPID configuration and push delivery.                                              |
| `src/integrations/supabase/`            | Browser/server clients, generated database types, and auth/cron helpers.                      |
| `drizzle/migrations/`                   | Versioned SQL schema, constraints, policies, triggers, and RPCs.                              |
| `public/rooted-push-worker.js`          | Notification display and click handling.                                                      |
| `src/test/`                             | Scoring, calendar cutoff, reminders, push-worker, and routing tests.                          |

## Database inventory

All nine tables below are in `public` and have row-level security enabled. RLS is not forced on table owners; the server service role bypasses RLS. Unless indicated otherwise, columns are non-null. Timestamps are `timestamptz`.

| Table                      | Columns                                                                                                                                                                | Keys and purpose                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                 | `id uuid`, `display_name text`, `timezone text`, `created_at`, `updated_at`                                                                                            | PK `id`; FK to `auth.users(id) ON DELETE CASCADE`. Name defaults to empty and timezone to `America/Chicago`.                                                                 |
| `activity_records`         | `user_id uuid`, `local_date date`, `activity text`, `created_at`                                                                                                       | Composite PK `(user_id, local_date, activity)`. Each row represents one earned point.                                                                                        |
| `entries`                  | `id uuid`, `user_id uuid`, `kind text`, nullable `subtype text`, `content jsonb`, `local_date date`, `created_at`, `updated_at`, `archived_import boolean`             | PK `id`, supplied by the client. Writing and historical guest imports. `archived_import` defaults to false.                                                                  |
| `daily_reminders`          | `id uuid`, `user_id uuid`, `title text`, `message text`, `delivery_time text`, `timezone text`, `enabled boolean`, `legacy_source boolean`, `created_at`, `updated_at` | Generated UUID PK. Multiple separately titled reminders per owner. Defaults: `Daily Check-In`, `Build what matters, daily.`, `20:00`, `America/Chicago`, enabled, nonlegacy. |
| `reminder_preferences`     | `user_id uuid`, `enabled boolean`, `delivery_time text`, `timezone text`, `message text`, `updated_at`                                                                 | PK `user_id`; legacy single-reminder settings, retained for compatibility. Defaults match reminder time/message/timezone; disabled by default.                               |
| `push_devices`             | `id uuid`, `user_id uuid`, `endpoint text`, `p256dh text`, `auth text`, nullable `last_sent_date date`, nullable `last_test_at`, `created_at`                          | Generated UUID PK; globally unique endpoint. Device subscription and setup confirmation throttling; `last_sent_date` supports legacy delivery.                                             |
| `reminder_delivery_claims` | `reminder_id uuid`, `device_id uuid`, `local_date date`, `created_at`                                                                                                  | Composite PK `(reminder_id, device_id, local_date)`; FKs to reminders/devices with cascading deletion. Prevents duplicate daily claims.                                      |
| `push_signing_config`      | `id boolean`, `public_key text`, `encrypted_private_key text`, `iv text`                                                                                               | Boolean PK, normally `true`; server-managed VAPID material. Private component is encrypted.                                                                                  |
| `app_event_logs`           | `id uuid`, nullable `user_id uuid`, `event text`, `level text`, nullable `detail text`, `created_at`                                                                   | Generated UUID PK. Levels: `info`, `warning`, `error`. Null owner is used for system events.                                                                                 |

### Relationships and indexes

Only `profiles.id` has an explicit FK to `auth.users`. Other `user_id` columns are logical ownership links enforced by RLS, not cascading auth-user foreign keys. Account deletion must therefore explicitly handle dependent data; deleting an auth user only guarantees deletion of its profile through the existing FK.

Additional indexes support:

- Entry history: `entries_user_date (user_id, local_date DESC)`.
- Reminder listing: `daily_reminders_owner (user_id, created_at)`.
- Legacy compatibility: unique `daily_reminders_legacy (user_id) WHERE legacy_source`.
- Device lookup: `push_devices_user (user_id)` and unique `endpoint`.
- Event history: `app_event_logs_user_created (user_id, created_at DESC)`.

Primary keys also create their corresponding unique indexes. There are no separate persisted points, streak, or chart summary tables.

### Entry content

| Kind / subtype                         | JSON content written by the app                                              |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `learn` / null                         | `{ "text": "..." }`                                                          |
| `gratitude` / null                     | `{ "items": ["...", "...", "..."] }`                                         |
| `journal` / `freeflow` or `devotional` | `{ "text": "..." }`                                                          |
| `journal` / `reframe`                  | `{ "answers": [{ "q": "...", "a": "..." }] }` with nine prompt/answer pairs. |

The database restricts `entries.kind` to `learn`, `gratitude`, or `journal`. It does not constrain subtype or validate the JSON structure/answer completeness; those checks live in the app. Editing updates the content and subtype while preserving the original owner, kind, earned date, creation timestamp, and archive status.

### Database functions and triggers

| Function                        | Invocation / role                                                                                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handle_new_user()`             | The checked-in `on_auth_user_created` Auth trigger creates a profile from signup metadata/email. The public function exists live; the Auth-schema trigger could not be independently inspected. |
| `rooted_scoring_date()`         | Central calendar date from the database clock.                                                                                                                                                  |
| `guard_rooted_activity_date()`  | Activity insert/update/delete guard via `rooted_activity_date_guard`.                                                                                                                           |
| `guard_rooted_entry_date()`     | Entry insert guard via `rooted_entry_date_guard`.                                                                                                                                               |
| `entries_guard_update()`        | Preserves immutable entry fields via `entries_guard`.                                                                                                                                           |
| `award_entry_activity()`        | After-insert entry award trigger.                                                                                                                                                               |
| `validate_rooted_reminder()`    | Before-insert/update validation on both reminder tables; updates their modification timestamps.                                                                                                 |
| `sync_legacy_rooted_reminder()` | After-insert/update legacy preference synchronization.                                                                                                                                          |
| `claim_rooted_reminders()`      | Original service-role delivery RPC retained for compatibility.                                                                                                                                  |
| `claim_rooted_reminders_v2()`   | Current service-role RPC for per-reminder/device/day claims.                                                                                                                                    |

## Scoring and calendar rules

The allowed activities are `bible`, `prayer`, `marriage`, `relationship`, `exercise`, `nutrition`, `learn`, `plan`, `gratitude`, and `journal`. Their unique daily records cap earnings at **10 points per user per scoring day**.

- `rooted_scoring_date()` uses the database clock in **America/Chicago**. The app's matching scoring helper uses Central time too. Editing a profile timezone does not change scoring boundaries.
- `rooted_activity_date_guard` runs before activity insert/update/delete. Inserts and deletes are allowed only for today's Central date; updates are rejected. Historical scores cannot be reopened by changing a device date or timezone.
- `rooted_entry_date_guard` rejects future entries and ordinary entries for closed days. Historical entries are accepted only as archived imports. Insert timestamps are assigned by the database.
- `award_entry_activity` runs after an entry insert and inserts its activity in the same transaction, ignoring duplicate daily awards. Archived imports do not award points. Do not add a second client-side award write.
- `entries_guard` preserves immutable entry fields on update and refreshes `updated_at`. Editing does not award another point.
- Current-day toggles can be undone/rechecked without inflating the total. Multiple writing entries of the same kind/day still earn one activity point.
- Totals count unique activity records. A streak counts consecutive qualifying dates; if today is empty, yesterday's streak remains active until today's end.
- Daily charts show the current Monday–Sunday week; Weekly shows eight weeks; Monthly shows six months. Period totals describe the displayed bars.

Guest mode applies matching rules on the device, but is not an authoritative server security boundary. Guest import keeps today's activity records and nonfuture writing, ignores duplicate IDs/activities, and marks older writing `archived_import=true`. The import uses multiple requests, not one transaction; retries rely on deduplication.

## Access control and data handling

| Table / operation                            | RLS behavior for signed-in users                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Profiles                                     | Own row SELECT/INSERT/UPDATE, matched by `auth.uid() = id`; no DELETE policy.               |
| Activities                                   | Own rows SELECT/INSERT/DELETE; no UPDATE policy, with additional date guards.               |
| Entries                                      | Own rows SELECT/INSERT/UPDATE/DELETE, with insert/update triggers.                          |
| Daily reminders, legacy preferences, devices | Own rows for all row operations, matched by `auth.uid() = user_id`.                         |
| Event logs                                   | Own rows SELECT only; no user write policy. Null-owner system events are not user-readable. |
| Signing configuration and delivery claims    | No client RLS policies; server access only for row operations.                              |

The reminder server functions revalidate bearer tokens with Supabase Auth, then query with the user's token so RLS still applies. Trusted delivery/configuration/logging operations use the server service-role client. Never expose its key, the signing seed, or cron secrets through `VITE_*` variables.

The service-role-only execution restrictions on `claim_rooted_reminders()` and `claim_rooted_reminders_v2()` were verified. RLS policies and grants should both be rechecked after schema changes; enabling RLS alone is not a complete permission audit.

## Notification lifecycle

1. A signed-in user enables a browser subscription. `push_devices` stores its owner, endpoint, and Web Push keys. Server validation allows only supported push-service hosts; delivery does not follow redirects.
2. Reminder CRUD uses `daily_reminders`. Each row currently stores its own valid IANA timezone and `HH:MM` delivery time. Titles are 1–80 trimmed characters; messages are 1–200, with additional trigger validation.
3. Legacy preference inserts/updates call `sync_legacy_rooted_reminder()` to upsert one `legacy_source=true` reminder per owner. This synchronization is one-way. Editing an individual reminder through the app clears its legacy flag.
4. The scheduler must POST to `/api/public/jobs/reminders` with the managed cron bearer secret. The handler accepts the current secret or its previous rotation value and invokes `claim_rooted_reminders_v2()` using the service role.
5. The RPC matches the current minute in each reminder's saved timezone, then atomically claims each reminder/device/local-day combination. Concurrent callbacks cannot claim the same combination twice. Legacy reminders also check `last_sent_date`.
6. The server sends the claimed notifications, removes expired devices, and writes delivery events. Test notifications use saved reminder text and a per-device one-minute throttle.

Claims are recorded **before** delivery. A failed send is not automatically retried that day; a missed scheduled minute is not caught up by the current exact-minute query. A scheduler firing every minute is therefore required for normal coverage. Scheduler configuration and actual delivery success were not verified by the schema inspection.

VAPID keys are generated lazily and retained in `push_signing_config`; the private component is encrypted with AES-GCM using a key derived from `ROOTED_PUSH_SIGNING_SEED`. Keep the seed stable across deployments. Logging deliberately avoids journal/reminder bodies, subscription endpoints, and key material. No retention cleanup job for logs or claims is defined in the checked-in migrations.

On iPhone, notifications require installing Rooted to the Home Screen and granting notification permission.

## Local storage, offline use, and backup

- Guest data uses `rooted:guest:v1`; the mode flag is `rooted:mode`. Guest data is device-only.
- Drafts use `rooted:draft:<account-or-guest-namespace>:<key>`; appearance uses `rooted:appearance` and is device-local.
- The cloud repository reads activities/entries in ordered pages of 1,000 and rejects writes when the browser reports offline. It does not provide an offline account write queue.
- Workbox handles shell/assets, while the separate push worker handles messages. Auth/API/private account responses must not be cached when changing the caching configuration.
- Settings exports the loaded profile, activity records, and writing as JSON. It is a personal export, not a complete database backup: reminders, subscriptions, event logs, claims, and signing configuration are not included. No backup-import UI is implemented.

## Migrations

| Migration                                         | Database change                                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `0000_migration.sql`                              | Profiles, signup profile trigger, activities, entries, indexes, RLS, and immutable entry fields.                             |
| `0001_award_entry_activity_atomically.sql`        | Entry inserts award activities transactionally.                                                                              |
| `0002_central_midnight_and_private_reminders.sql` | Central scoring guards, archived imports, legacy reminder preferences, devices, reminder validation, and original claim RPC. |
| `0003_private_push_signing_config.sql`            | Encrypted server signing configuration.                                                                                      |
| `0004_app_event_logs.sql`                         | Owner-readable server event logs.                                                                                            |
| `0005_multiple_titled_daily_reminders.sql`        | Multiple reminders, legacy backfill/synchronization, delivery claims, and v2 claim RPC.                                      |
| `0006_isolate_reminder_delivery_claims.sql`       | Revokes client claim-table access and adds legacy duplicate protection to the v2 RPC.                                        |

The inspected live public objects reflect the features in migrations `0000`–`0006`; this is structural verification, not verification of migration-ledger entries. The compact UI update uses the existing schema and reminder APIs without a migration. Reminder timezone controls remain in each expanded editor; changing the profile timezone sets the default for new reminders and does not reschedule existing ones. A master timezone for all reminders is deferred until its database behavior can be deployed and verified.

Use the managed deployment/migration workflow to apply new versioned SQL in order. `drizzle.config.ts` reads the server-only `LOVABLE_DB_MIGRATION_URL`. `drizzle/schema.ts` and migration snapshots are intentionally empty/generated scaffolding; they are not a complete declarative representation of this database. Do not use schema push to reconstruct production from that empty file. Keep generated Supabase types aligned with actual schema changes.

## Development

Use a recent Node.js version compatible with the checked-in Vite dependencies (Node 22.12+ or 24 is a practical baseline). Bun is also supported and `bun.lock` is committed; `bunfig.toml` defines install policy.

```sh
git clone https://github.com/Happy-890/rootedroutinetracker.git
cd rootedroutinetracker
npm install
npm run dev
```

Configure environment variables for the intended development backend before running account or notification flows. Guest data stays local, but Supabase client configuration is still required to initialize the app.

| Variable                                                       | Purpose / exposure                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`           | Browser-visible Supabase connection settings; access is constrained by RLS. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`                     | Server connection and user-token validation.                                |
| `SUPABASE_SERVICE_ROLE_KEY`                                    | Server-only administrative operations; bypasses RLS.                        |
| `ROOTED_PUSH_SIGNING_SEED`                                     | Server-only encryption seed for persistent push signing material.           |
| `LOVABLE_CRON_SECRET`, optional `LOVABLE_CRON_SECRET_PREVIOUS` | Server-only scheduled callback authentication and rotation.                 |
| `LOVABLE_DB_MIGRATION_URL`                                     | Server/tooling-only PostgreSQL migration connection.                        |

Do not paste real secret values into documentation or commits.

```sh
npm test
npx tsc --noEmit
npm run build
npm run lint
```

These are application checks, not a substitute for testing SQL migrations, real RLS behavior, cross-account access, and push delivery against an isolated test backend. UI tests do not establish database security.

Changes pushed to the Lovable-connected branch sync into the editor. Preserve published history: do not force-push or rewrite commits already synchronized with Lovable.

Scheduled reminders use the timezone in Profile & account. Migration `0007_profile_reminder_timezone` makes that profile value authoritative at delivery time; existing reminder times and delivery claims are preserved.

## Reminder reliability and backups

The production build generates one root-scope worker at `/rooted-push-worker.js` for Web Push and public asset caching. `/sw.js` is a compatibility entry for older clients. API, authentication and private account responses are never cached; offline navigation shows a public reconnect page.

Reminder deliveries use private leases, bounded retry attempts with backoff, and a short expiry window. Existing delivery claims are preserved during migration. Notification setup checks that the current account owns the device subscription; logout disconnects that device's notifications.

Account exports include profile settings, activity, writing and reminders from one database snapshot. New exports are signed by the server and can be restored only into the account that created them. Restore merges missing records and keeps existing writing and reminders; profile settings come from the backup. Restore is atomic and verifies the signature before allowing the server to restore previously recorded historical activity. Ordinary clients cannot backdate scoring.

Keep backup files private. Only newly exported, verified backups are supported by Restore backup; older unsigned files remain readable JSON exports. The current file-size limit is 10 MB. Signing uses `ROOTED_BACKUP_SIGNING_SECRET` when configured, otherwise the existing server-only `ROOTED_PUSH_SIGNING_SEED`; retain the signing secret to preserve backup verification. Device subscriptions and private signing keys are intentionally excluded from exports.

## Weekly review, priorities and habit commitments

History includes a Monday–Sunday weekly review with separate pillar completion totals, a comparison to the previous recorded week, three reflection prompts and one commitment for the following week. Current-week totals are explicitly partial. Reviews do not earn points.

Finance → Plan supports up to three daily priorities, each with an optional pillar and an action cue. Save after editing or checking off priorities. Each Central-time day starts fresh, and saved past priorities appear in daily History. The previous week's review commitment appears in Plan. The existing ten-point scoring system is unchanged.

Settings → My habit commitments stores a personal reason and optional definitions for the eight pillar habits. Home's pillar info buttons show saved definitions or clearly editable example commitments. Text drafts survive navigation and failed saves and are isolated by account.

Migration `0011_growth_tools` adds owner-scoped `growth_records`. Authenticated users can read only their own rows; validated RPCs handle writes and merge-only guest imports. Direct client writes and TRUNCATE are revoked. New account backups include reviews, priorities and commitments in one owned snapshot; verified restore merges missing records without overwriting existing ones. Older signed backups remain supported. Guest exports include local growth data.
