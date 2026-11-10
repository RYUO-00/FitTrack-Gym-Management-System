# FitTrack PostgreSQL files

Run scripts with `psql` in this order from the project root:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/01_schema.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/02_constraints_and_indexes.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/09_functions.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/10_procedures.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/11_triggers.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/08_views.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/03_seed_data.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/13_test_queries.sql
```

`04`–`07` are a commented query workbook, `12_transactions.sql` demonstrates transaction boundaries, and `14_normalization.sql` recreates the lossless join example. Seed data is fictional and idempotent for members, trainers, plans, and dated subscriptions. Payment inserts intentionally produce payment audit rows.

The query workbook contains more than 25 individually commented examples across selection, DML, joins, nested/correlated queries, `EXISTS`, date conditions, grouping, aggregates, and a CTE. The smoke-test file checks routines and triggers with rollback so tests leave the seeded domain records intact.
