# FitTrack PostgreSQL files

Run scripts with `psql` in this order from the project root:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/01_schema.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/02_constraints_and_indexes.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_payment_audit_payment_fk.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/09_functions.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/10_procedures.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/11_triggers.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/08_views.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/03_seed_data.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/13_test_queries.sql
```

`04`–`07` are a commented query workbook, `12_transactions.sql` demonstrates transaction boundaries, and `14_normalization.sql` recreates the lossless join example. Seed data is fictional and idempotent for members, trainers, plans, and dated subscriptions. Payment inserts intentionally produce payment audit rows.

The query workbook contains more than 25 individually commented examples across selection, DML, joins, nested/correlated queries, `EXISTS`, date conditions, grouping, aggregates, and a CTE. The smoke-test file checks routines and triggers with rollback so tests leave the seeded domain records intact.

## Existing installations

Run `migrations/001_payment_audit_payment_fk.sql` as the owner of both `public.payments` and `public.payment_audit`, against the existing FitTrack database. The script checks for NULL and orphan payment references, sets `payment_audit.payment_id NOT NULL`, adds and validates the `ON DELETE RESTRICT` foreign key, and commits atomically. It is safe to rerun. If invalid legacy references or a conflicting constraint exist, it aborts without modifying data; resolve those references with the data owner before retrying. Never delete audit history to make the migration pass. Lock acquisition times out after ten seconds so an active workload cannot block setup indefinitely.

For the local Windows installation, enter the owner password only at the secure psql prompt:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -W -X -h localhost -p 5432 -U postgres -d fittrack -v ON_ERROR_STOP=1 -f database/migrations/001_payment_audit_payment_fk.sql
```

`CREATE TABLE IF NOT EXISTS` alone does not upgrade an existing table. The schema file defines the new relationship for fresh installations; the migration upgrades existing ones. The existing composite audit index already begins with `payment_id`, so no duplicate index is needed. Payment inserts and updates continue to create audit snapshots; payments with audit records cannot be deleted. Administrator attribution remains optional through `changed_by` with `ON DELETE SET NULL`.

Run `npm run test:db` for fresh-schema, legacy upgrade, idempotency, invalid-data rollback and trigger/constraint checks in isolated disposable schemas on the configured server. Run `npm run test:db:live` after applying the migration to verify the permanent `fittrack` database through the application pool. Its fixture writes are rolled back and all nine tables are compared before and after. PostgreSQL identity sequences may advance during rolled-back tests, creating harmless gaps.

## Branch-owned weak plans (migration 002)

New databases use the current `01_schema.sql`; no upgrade migration is needed. Existing installations must apply migration 001 first if the payment-audit FK is missing, then run migration 002 **as the existing table owner**:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -W -X -h localhost -p 5432 -U postgres -d fittrack -v ON_ERROR_STOP=1 -f database/migrations/002_gym_owned_membership_plans.sql
```

Stop the application before upgrading. The migration runs in one transaction, locks the two affected tables, rejects orphan or nonpositive legacy plan identifiers, creates the default gym, renames existing plan IDs to `plan_no`, backfills `gym_id`, adds the composite keys, and recreates the project's procedures and active-subscription view. No records are removed. Unexpected dependencies abort without CASCADE; do not drop custom objects blindly. Default branch details are editable using the authenticated `/api/gyms/:id` endpoint. `plan_no` is entered explicitly and is unique only within a branch; creating duplicate keys returns HTTP 409. Plan key fields are immutable in the application.

Subscriptions now require `gymId` and `planNo`, and plan item routes are `/api/plans/:gymId/:planNo`. Gym CRUD uses `/api/gyms`. This intentionally replaces the old single-ID API. Members and trainers remain shared across branches. Branch deletion is restricted while any plans exist.

`npm run test:db` covers legacy migration, idempotency, invalid-data rollback and cross-branch key validation in disposable schemas. `npm run test:db:live` rolls back fixtures and fingerprints all nine tables. `npm run test:api` exercises authenticated HTTP workflows against the configured permanent server, removes only its uniquely tagged fixtures, and compares original table fingerprints. Identity sequences can acquire harmless gaps.

## Full multi-branch workspace (migration 003)

Current installations have exactly nine tables. Apply 001 (if needed), 002, then
`003_branch_isolation.sql` as the existing table/view owner. Fresh databases use
01, 02, 09, 10, 11, 08, 03 in dependency order. Do not rerun fresh setup blindly
against legacy data. Migration 002 skips its older routine definitions when 003
is already installed, so a later rerun cannot downgrade the business checks.

Migration 003 preserves every original tuple, renames gym phone to contact_number,
adds city/status, assigns each member/trainer a home gym from unambiguous existing
subscriptions (or Main Branch if no subscriptions), and adds nullable admins.gym_id.
Existing administrators retain all-branch access (NULL). The member/trainer
composite FKs prevent cross-branch subscription assignments; their identity PKs
remain unchanged. The plan PK and composite plan FK remain (gym_id,plan_no).
An ambiguous legacy person associated with more than one gym causes a full
transaction rollback, requiring explicit resolution; no records are duplicated,
deleted or guessed. The monthly revenue view now groups by gym as well as month.

### Backup and rollback

Before upgrading another installation, stop its app, take a full custom-format
backup with the installed pg_dump, and verify that the backup can be restored:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -W -h localhost -p 5432 -U postgres -d fittrack -Fc -f fittrack_before_multibranch.dump
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -W -X -h localhost -p 5432 -U postgres -d fittrack -v ON_ERROR_STOP=1 -f database/migrations/003_branch_isolation.sql
```

An error before COMMIT rolls back the entire migration (psql must stop on errors).
If needed in an interactive failed transaction, issue ROLLBACK. For a rollback
AFTER commit, restore the pre-upgrade backup into a separate verification database
using pg_restore, run the previous application against that restored copy, verify
its counts, and only then deliberately switch DATABASE_URL during maintenance.
Keep the current database intact. Do not drop live tables or attempt to flatten
branch-local plan numbers into global IDs after new multi-branch data exists.
The upgrade is rerunnable; it is not a destructive down-migration.

### Authorization and requests

NULL admins.gym_id means organization administrator; a positive value grants
one branch only. This is deliberately the only two access modes: arbitrary
subsets of branches would require an additional relation, outside this project's
nine-table limit. Set FITTRACK_ADMIN_GYM_ID to a branch ID or all when explicitly
creating/updating an admin with npm run admin:create. If omitted on an existing
account update, its current scope is preserved. No branch passwords are used.

Every administrative request refreshes the admin's scope from PostgreSQL.
X-Gym-Id selects the workspace; it grants no access by itself. Missing headers
use the restricted account's assigned branch or the first branch for all-branch
admins. Inconsistent header/body/query gym IDs are rejected. All resource-ID
reads and writes, histories, counts, dashboards and reports include scope checks.
Gyms list/detail/update enforce authorization independently of the selected gym.

Members and trainers belong to one home branch. The member/trainer composite
references deliberately enforce matching ownership in subscriptions. Transfers
with existing history are not implemented. Plan management can target any
ACTIVE authorized branch. Inactive branches keep read access to history and
financial maintenance, but cannot receive new members, trainers, plans,
subscriptions/renewals or attendance check-ins. Checkout and payment corrections
remain possible. Attendance derives its branch from the subscription.

The frontend remembers the selected workspace by administrator ID in localStorage.
A switch names both branches and requires confirmation, cancels old queries,
clears scoped cached data and reloads the workspace. This preference is not an
authorization credential; the backend always checks it. Form-local branch selectors
load only that branch's members/plans/trainers; changing a form branch does not
silently switch the surrounding workspace.

Run npm run test:db, npm run test:db:live and npm run test:api. The API suite covers
all-branch and restricted accounts, forged headers, direct-ID attacks, same plan
numbers across gyms, active/inactive behavior, exact dashboard/revenue isolation,
renewals, payments/audit and attendance. Tests remove only tagged fixtures and
fingerprint all nine original tables. Sequence gaps from tests are harmless.
