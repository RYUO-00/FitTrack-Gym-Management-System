# FitTrack

FitTrack is a PostgreSQL-backed gym operations system for administrators. It includes member and trainer records, configurable membership plans, append-only subscription renewal history, payments with an audit trigger, eligible attendance check-ins, and SQL-generated dashboard and report data.

## Stack and layout

- `client/`: React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, Recharts, Lucide icons, and shadcn-style primitives.
- `server/`: Express, TypeScript, Zod validation, `pg` parameterized SQL, bcrypt password hashing, signed HTTP-only cookie sessions.
- `database/`: executable PostgreSQL schema, seed, query workbook, views, PL/pgSQL functions/procedures, triggers, transactions, and smoke checks.
- `docs/database-design.md`: 1NF/2NF/3NF reasoning and lossless decomposition.

Express serves the Vite production build and the `/api` endpoints from one service. In development, Vite proxies `/api` to Express.

## Prerequisites

- Node.js 20 or newer (verified locally with Node 22).
- PostgreSQL 14 or newer (the included SQL uses identity columns and modern PL/pgSQL).
- `psql` available on `PATH` for database setup.

## Local setup

From this project directory, install dependencies and create the local database/user. Use a unique password of your choice:

```powershell
npm install
psql -U postgres -c "CREATE USER fittrack_app WITH PASSWORD 'choose-a-local-password';"
psql -U postgres -c "CREATE DATABASE fittrack OWNER fittrack_app;"
Copy-Item .env.example .env
```

Edit `.env` and set `DATABASE_URL` to the password you chose. Set `COOKIE_SECRET` to a random secret of at least 32 characters. Set `FITTRACK_ADMIN_EMAIL` and `FITTRACK_ADMIN_PASSWORD` to the initial admin login. The admin initializer hashes the password before storing it; passwords are never seeded in SQL.

PowerShell database initialization and seed order:

```powershell
$env:DATABASE_URL = 'postgresql://fittrack_app:change_me@localhost:5432/fittrack'
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/01_schema.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/02_constraints_and_indexes.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/migrations/001_payment_audit_payment_fk.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/09_functions.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/10_procedures.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/11_triggers.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/08_views.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/03_seed_data.sql
npm run admin:create
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/13_test_queries.sql
```

To start both development servers:

```powershell
npm run dev
```

Open `http://localhost:5173`. The Express health endpoint is `http://localhost:4000/api/health`.

## Commands

```powershell
npm run typecheck
npm run build
npm start
```

The application can be served on a single web service after `npm run build`; `npm start` serves `client/dist` and the API. Set `NODE_ENV=production`, `PORT`, `DATABASE_URL`, and a strong `COOKIE_SECRET` in the hosting provider. Set `PGSSL=true` when the managed PostgreSQL provider requires TLS. Configure `CLIENT_ORIGIN` to the deployed site origin if running a separately hosted frontend. Do not commit `.env` or real credentials.

### Managed PostgreSQL deployment

Create a managed PostgreSQL database (for example, Render PostgreSQL), copy its internal/appropriate connection URL into `DATABASE_URL`, and set `PGSSL=true` if the provider requires TLS. Run the schema/function/procedure/trigger/view/seed steps above against that URL, then deploy the project as a Node web service with `npm install`, `npm run build`, and `npm start`. Configure the environment variables in the service dashboard and create the initial administrator using `npm run admin:create` from a secure deployment shell or one-off job. The service exposes `/api/health` for health checks.

## Database evaluation

The query workbook contains 30 commented SQL examples, including DML, inner/left/right joins, nested and correlated subqueries, `EXISTS`/`NOT EXISTS`, date queries, aggregates, grouping, and a CTE. Two views, an expiry function, create/renew procedures, a payment audit trigger, an attendance eligibility trigger, and transaction examples are independently executable SQL. See [`docs/database-design.md`](docs/database-design.md) and [`database/README.md`](database/README.md).

## API overview

All routes except login, logout, and health require an authenticated admin cookie.

| Area | Routes |
| --- | --- |
| Authentication | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Dashboard | `GET /api/dashboard` |
| Members | `GET/POST /api/members`, `GET/PUT/DELETE /api/members/:id`, `GET /api/members/:id/history` |
| Trainers | `GET/POST /api/trainers`, `GET/PUT/DELETE /api/trainers/:id` |
| Plans | `GET/POST /api/plans`, `GET/PUT/DELETE /api/plans/:id` |
| Subscriptions | `GET/POST /api/subscriptions`, `GET /api/subscriptions/:id`, `POST /api/subscriptions/:id/renew`, `POST /api/subscriptions/:id/cancel` |
| Payments | `GET/POST /api/payments`, `PATCH /api/payments/:id/status` |
| Attendance | `GET/POST /api/attendance`, `PATCH /api/attendance/:id/checkout` |
| Reports | `GET /api/reports` with optional `from` and `to` date filters |

## Verification

The payment-audit relationship requires `payment_audit.payment_id NOT NULL REFERENCES payments(payment_id) ON DELETE RESTRICT`. Existing installations must run `database/migrations/001_payment_audit_payment_fk.sql` as the table owner; it rejects invalid legacy references without deleting or rewriting records. See `database/README.md` for the secure owner command and recovery guidance. Run `npm run test:db` for isolated schema and migration regression tests, and `npm run test:db:live` to verify the migrated permanent database. Both cover payment audit snapshots, NULL/orphan references and restricted payment deletion.

The implementation was verified locally against a fresh PostgreSQL 18 test cluster:

- `npm run typecheck` and `npm run build` passed; route-level code splitting keeps the initial client bundle below 270 kB before gzip.
- `npm audit` reported zero vulnerabilities after dependency updates.
- All schema, index, function, procedure, trigger, view, seed, transaction, query workbook, and normalization SQL files executed successfully. `database/13_test_queries.sql` validated seed counts, expiry calculation, views, both subscription procedures, payment auditing, attendance eligibility, uniqueness, positive prices, and rollback behavior.
- An HTTP smoke run verified admin login/logout and route protection; dashboard metrics; member, trainer, and plan CRUD/search; create/renew subscription history; payment insert/status update; check-in/check-out; reports; and foreign-key deletion protection.

The Windows browser automation helper could not establish the open Chrome tab URL, so I did not complete screenshot-based visual QA. The compiled React app and its API workflows were validated through the local build and HTTP checks. No deployment or third-party payment processing is included.
