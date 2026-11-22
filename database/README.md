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

Run `npm run test:db` for fresh-schema, legacy upgrade, idempotency, invalid-data rollback and trigger/constraint checks in isolated disposable schemas on the configured server. Run `npm run test:db:live` after applying the migration to verify the permanent `fittrack` database through the application pool. Its fixture writes are rolled back and all eight tables are compared before and after. PostgreSQL identity sequences may advance during rolled-back tests, creating harmless gaps.
