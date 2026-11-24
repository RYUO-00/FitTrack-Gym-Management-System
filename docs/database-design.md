# FitTrack database design and normalization

## Relational model

FitTrack stores each kind of fact once and links records through keys. `subscriptions` is the association between a member, a plan, and an optional trainer. `payments` and `attendance` each refer to a subscription, so renewals retain their own payment and check-in history.

| Relation | Primary key | Main foreign keys | Important dependencies |
| --- | --- | --- | --- |
| `admins` | `admin_id` | nullable `gym_id` | `admin_id → email, password_hash, display_name` |
| `members` | `member_id` | required `gym_id` | `member_id → member_name, email, phone, join_date`; email and phone are alternate unique keys |
| `trainers` | `trainer_id` | required `gym_id` | `trainer_id → trainer_name, email, phone, specialization`; email is an alternate unique key |
| `gyms` | `gym_id` | — | `gym_id → branch_name, address, city, contact_number, email, status`; branch name is unique |
| `membership_plans` (weak) | `(gym_id, plan_no)` | `gym_id → gyms` | `(gym_id, plan_no) → plan_name, duration_months, price, description, is_active`; `(gym_id, plan_name)` is an alternate key |
| `subscriptions` | `subscription_id` | `member_id`, `(gym_id, plan_no)`, nullable `trainer_id` | `subscription_id → member_id, gym_id, plan_no, trainer_id, start_date, end_date, status` |
| `payments` | `payment_id` | `subscription_id` | `payment_id → subscription_id, amount, payment_date, payment_method, payment_status` |
| `attendance` | `attendance_id` | `subscription_id` | `attendance_id → subscription_id, check_in_at, check_out_at` |
| `payment_audit` | `audit_id` | required `payment_id`, nullable `changed_by` | `audit_id → payment_id, operation, old_values, new_values, changed_at, changed_by` |

Foreign keys use `RESTRICT` for referenced members, plans and subscriptions, and for payments that have audit records. Each audit row belongs to exactly one payment; a payment can have many audit rows (1:N). The payment trigger automatically creates an INSERT snapshot and subsequent UPDATE snapshots. The administrator-to-audit relationship remains 1:N with optional attribution because `changed_by` is nullable. Trainer deletion and audit actor deletion use `SET NULL`. Database checks constrain dates, durations, amounts, statuses, and payment methods. Indexes support joins and the date/status filters used by the API.

Existing databases apply `database/migrations/001_payment_audit_payment_fk.sql`. It checks for NULL and orphan payment references before adding the required, validated payment FK in one transaction. Invalid legacy records cause an error and rollback; no audit history is removed or inferred from JSON. New installations receive the same constraint directly from `01_schema.sql`.

## Weak entity: gym-owned membership plans

GYM is a strong entity identified by `gym_id`. MEMBERSHIP_PLANS is a weak entity whose partial key is `plan_no`. A plan cannot be identified independently of its owning gym: `(gym_id, plan_no)` is its composite primary key. The same plan number and name may occur in different gyms; neither component alone identifies a plan globally. `UNIQUE(gym_id, plan_name)` is a second branch-scoped candidate key.

The identifying OFFERS relationship is GYM (1) to MEMBERSHIP_PLANS (N), with total participation on the plan side. Chen notation uses a double rectangle, double diamond, and dashed underline for `plan_no`. A required gym FK enforces existence dependence; `ON DELETE RESTRICT` protects branches with plans. Subscriptions reference both components together in one composite FK, preventing a number from being paired with the wrong gym. Members and trainers each belong to one gym; subscriptions enforce the same branch through member/trainer composite FKs. Administrator gym_id is nullable: NULL grants all branches, otherwise exactly one. The API refreshes scope from PostgreSQL and filters every branch-owned read and write.

For 2NF, every non-key plan attribute depends on the full `(gym_id, plan_no)` key (and the alternate `(gym_id, plan_name)` key), not on `gym_id` or `plan_no` alone. Branch address and contacts belong in `gyms`, eliminating a partial dependency on `gym_id` from the weak relation. Consequently a composite key does not by itself violate 2NF or 3NF.

Existing installations run `database/migrations/002_gym_owned_membership_plans.sql` as the table owner. It preserves old plan IDs as branch-local plan numbers, assigns all existing plans and subscriptions to FitTrack Main Branch, replaces only the known dependent view/routine definitions atomically, checks for invalid references, and never uses CASCADE. Failure rolls back the entire upgrade. Stop the app during migration and restart the updated backend afterward. Run `npm run test:db`, `npm run test:db:live`, and `npm run test:api` to verify fresh installs, upgrades, real workflows, and preservation.

## First Normal Form (1NF)

1NF requires each row-column intersection to contain one value of the column's type, with no repeating groups. A spreadsheet-style member record can violate 1NF:

```text
member_id | name       | phones                         | subscriptions
41        | Maya Kapoor| [+91-90000-10001, +91-...10002] | [Quarterly, Yearly]
```

The `phones` and `subscriptions` cells are lists. FitTrack keeps one atomic phone in `members.phone`; each membership period becomes a separate row in `subscriptions`. If the product later needs several phone numbers per person, those values belong in a child relation such as `member_phones(member_id, phone)`, one phone per row. The current application deliberately has a single unique contact phone per member.

## Second Normal Form (2NF)

2NF requires 1NF and requires every non-key attribute to depend on the whole candidate key, not a proper subset. Consider the legacy enrollment relation:

```text
Enrollment(member_id, gym_id, plan_no, start_date, member_name, email,
           plan_name, duration_months, price, end_date)
```

For this enrollment example, assume `(member_id, gym_id, plan_no, start_date)` is the candidate key. The functional dependencies include:

```text
member_id                         → member_name, email
(gym_id, plan_no)                 → plan_name, duration_months, price
(member_id, gym_id, plan_no, start_date)  → end_date
```

Member attributes depend on only `member_id`, and plan attributes depend on only `(gym_id, plan_no)`. Both are partial dependencies on proper subsets of the composite key, so keeping them on every enrollment row would violate 2NF. FitTrack places member facts in `members`, plan facts in `membership_plans`, and the enrollment itself in `subscriptions`, whose generated `subscription_id` identifies one subscription row. The foreign keys retain the relationships without repeating those descriptive facts.

## Third Normal Form (3NF)

3NF requires 2NF and no non-key attribute to depend transitively on a candidate key through another non-key attribute. In the unnormalized enrollment report, the following chain exists:

```text
subscription_id → (gym_id, plan_no) → plan_name, duration_months, price
subscription_id → trainer_id → trainer_name, specialization
subscription_id → member_id → member_name, email, phone
```

If plan names, trainer details, or member contact details were copied into `subscriptions`, they would be transitively dependent on its key and could disagree after an edit. FitTrack stores each description in its determinant relation and references it from `subscriptions`. The same reasoning separates payment and attendance events into their own relations. Within each table, descriptive non-key attributes describe that table's key; the intentional JSONB old/new snapshots in `payment_audit` are immutable audit evidence, not a second live payment source.

`subscriptions.status` stores the administrative cancellation/record state; active, expired, and upcoming display status is evaluated against dates in SQL at read time. The system does not rely on a trigger firing when time passes.

## Lossless decomposition

Start with this one-row-per-subscription report relation:

```text
R(subscription_id, member_id, member_name, email,
  gym_id, plan_no, plan_name, duration_months, price,
  trainer_id, trainer_name, start_date, end_date, status)
```

Its candidate key is `subscription_id`, with the dependencies shown above. Decompose into:

```text
Subscriptions(subscription_id PK, member_id FK, (gym_id, plan_no) composite FK, trainer_id FK,
              start_date, end_date, status)
Members(member_id PK, member_name, email UNIQUE, ...)
MembershipPlans((gym_id, plan_no) PK, UNIQUE(gym_id, plan_name), duration_months, price, ...)
Trainers(trainer_id PK, trainer_name, ...)
```

For the first binary split, `R1 = (subscription_id, member_id, gym_id, plan_no, trainer_id, start_date, end_date, status)` and `R2 = (member_id, member_name, email)`. Their common attribute is `member_id`, which is a key of `R2` and therefore functionally determines every attribute in `R2`. The next split uses the complete `(gym_id, plan_no)` as the key of the plan relation; the trainer split uses `trainer_id` as the key of the trainer relation. `subscription_id` remains the key of the subscription fact. These joins attach at most one member, one plan, and zero-or-one trainer to each subscription row.

**Lossless decomposition criterion:** For a binary decomposition of relation `R` into `R1` and `R2`, the decomposition is lossless when the common attributes functionally determine all attributes of at least one of the decomposed relations.

Reconstruction is the ordinary key-based join:

```sql
SELECT s.subscription_id, m.member_name, m.email, p.plan_name,
       p.duration_months, p.price, t.trainer_name,
       s.start_date, s.end_date, s.status
FROM subscriptions AS s
JOIN members AS m ON m.member_id = s.member_id
JOIN membership_plans AS p ON p.gym_id = s.gym_id AND p.plan_no = s.plan_no
LEFT JOIN trainers AS t ON t.trainer_id = s.trainer_id;
```

Because each referenced primary key matches at most one row and the subscription row is preserved by each join (with a left join for its optional trainer), reconstruction creates neither extra combinations nor missing subscription tuples. [`database/14_normalization.sql`](../database/14_normalization.sql) compares row counts and values for the original report and reconstructed join using the seeded data.

Losslessness is separate from **dependency preservation**. Losslessness says a join can recover the original relation without spurious tuples. Dependency preservation says constraints can be checked on the decomposed relations without joining them. Member, plan, trainer, and subscription dependencies are each enforced locally by primary/unique keys; cross-row business rules such as attendance eligibility are checked transactionally by the attendance trigger.

## Demonstration files

- [`database/01_schema.sql`](../database/01_schema.sql) and [`database/02_constraints_and_indexes.sql`](../database/02_constraints_and_indexes.sql): tables, integrity rules, and indexes.
- [`database/03_seed_data.sql`](../database/03_seed_data.sql): fictional, relationally consistent sample records.
- [`database/04_basic_queries.sql`](../database/04_basic_queries.sql) through [`database/07_aggregate_queries.sql`](../database/07_aggregate_queries.sql): 30 commented query examples.
- [`database/08_views.sql`](../database/08_views.sql) through [`database/11_triggers.sql`](../database/11_triggers.sql): views, PL/pgSQL routines, and trigger logic.
- [`database/12_transactions.sql`](../database/12_transactions.sql): commit and rollback examples plus an atomic renewal/payment template.
- [`database/13_test_queries.sql`](../database/13_test_queries.sql): executable database assertions and routine/trigger smoke tests.

## Branch consistency and normalization tradeoff

GYM stores each branch description once. Weak plans depend on the entire
(gym_id,plan_no) key. The subscription must store gym_id to reference that key.
The additional same-branch member/trainer constraints intentionally retain this
branch key in the subscription even though a globally unique member_id also
determines its home gym. This is controlled key redundancy for cross-branch
referential integrity, rather than a claim that the subscription relation is
strictly 3NF under that additional dependency. Branch names, addresses, contacts,
plan descriptions and member/trainer names are never copied into subscriptions.
No extra relation, denormalized branch lists or JSON authorization arrays were added.

Members/trainers cannot move to another branch while referenced history exists.
The scope model supports an organization administrator or one assigned branch,
not arbitrary branch subsets. These choices preserve the nine-table boundary.
