import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pool } from '../../server/src/database/pool';

const sql = (f: string) => readFileSync(`database/${f}`, 'utf8');
const files = ['01_schema.sql','02_constraints_and_indexes.sql','09_functions.sql',
  '10_procedures.sql','11_triggers.sql','08_views.sql','03_seed_data.sql'];
const tables = ['members','trainers','membership_plans','subscriptions','payments','attendance','admins','payment_audit'];
async function main() {
  const c = await pool.connect();
  const schema = `fittrack_gym_test_${randomUUID().replaceAll('-','')}`;
  assert.match(schema,/^fittrack_gym_test_[a-f0-9]+$/);
  const migrate = () => c.query(sql('migrations/002_gym_owned_membership_plans.sql').replace(/\bpublic\b/g,schema));
  const snapshot = async (legacy: boolean) => {
    const result: Record<string,unknown> = {};
    for (const table of tables) {
      // Normalize the intentional key rename/addition; every other stored value must be identical.
      const row = table==='membership_plans' || table==='subscriptions'
        ? legacy ? "to_jsonb(t) - 'plan_id' || jsonb_build_object('plan_no',t.plan_id)"
          : "to_jsonb(t) - 'gym_id'" : 'to_jsonb(t)';
      result[table]=(await c.query(`SELECT jsonb_agg(v ORDER BY v::text) AS records FROM
        (SELECT ${row} AS v FROM ${table} t) x`)).rows[0].records;
    }
    return result;
  };
  try {
    console.log(JSON.stringify((await c.query('SELECT current_database() AS database,inet_server_port() AS port,version() AS version')).rows[0]));
    await c.query(`CREATE SCHEMA ${schema}`);
    await c.query(`SET search_path TO ${schema},pg_catalog`);
    for (const file of files) await c.query(sql(file));
    const expected: Record<string,number> = {members:18,trainers:5,membership_plans:4,subscriptions:24,payments:35};
    for (const [table,count] of Object.entries(expected)) assert.equal(Number((await c.query(`SELECT count(*) FROM ${table}`)).rows[0].count),count);
    await c.query(sql('15_gym_weak_entity_tests.sql'));
    await migrate(); await migrate();
    console.log('PASS fresh setup, seed counts, branch-scoped keys, composite FK, delete restrictions, routines, payments/audit, attendance, views; migration rerun');
    for (const file of ['04_basic_queries.sql','05_join_queries.sql','06_subqueries.sql','07_aggregate_queries.sql','12_transactions.sql','13_test_queries.sql','14_normalization.sql']) {
      const result: any = await c.query(sql(file));
      if (file==='14_normalization.sql') assert.equal(Number(result.rows[0].mismatched_or_missing_rows),0);
    }
    console.log('PASS all demonstration SQL, constraints, audit tests and lossless reconstruction');
    await c.query(`DROP SCHEMA ${schema} CASCADE; CREATE SCHEMA ${schema}; SET search_path TO ${schema},pg_catalog`);
    await c.query(readFileSync('tests/database/fixtures/pre-gym-schema.sql','utf8'));
    // Legacy installations can have gapped IDs; seeding must not assume 1..4.
    await c.query(`ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_plan_id_fkey;
      UPDATE membership_plans SET plan_id=plan_id+100;
      UPDATE subscriptions SET plan_id=plan_id+100;
      ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY(plan_id) REFERENCES membership_plans(plan_id) ON DELETE RESTRICT`);
    const before = await snapshot(true);
    // Check preflight rollback against an intentionally corrupt legacy fixture.
    await c.query('ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_plan_id_fkey');
    await c.query('UPDATE subscriptions SET plan_id=-2147483647 WHERE subscription_id=(SELECT min(subscription_id) FROM subscriptions)');
    const invalidBefore=await snapshot(true);
    await assert.rejects(migrate()); await c.query('ROLLBACK');
    assert.deepEqual(await snapshot(true),invalidBefore);
    console.log('PASS invalid legacy references abort migration atomically without deleting records');
    await c.query(`UPDATE subscriptions s SET plan_id=(x->>'plan_no')::int
      FROM jsonb_array_elements($1::jsonb) x WHERE s.subscription_id=(x->>'subscription_id')::int`, [JSON.stringify(before.subscriptions)]);
    await c.query('ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY(plan_id) REFERENCES membership_plans(plan_id) ON DELETE RESTRICT');
    await migrate();
    assert.deepEqual(await snapshot(false),before);
    const after=await snapshot(false); await migrate(); assert.deepEqual(await snapshot(false),after);
    await c.query(sql('migrations/003_branch_isolation.sql').replace(/\bpublic\b/g,schema));
    const scoped=await snapshot(false);
    await c.query(sql('03_seed_data.sql'));
    assert.deepEqual(await snapshot(false),scoped,'Reseeding a migrated/gapped plan catalog duplicated or changed records');
    await c.query(sql('15_gym_weak_entity_tests.sql'));
    console.log('PASS legacy migration preserves all eight original tables, assigns default branch, is idempotent, and supports every affected workflow');
  } finally {
    await c.query('ROLLBACK');
    await c.query('SET search_path TO public,pg_catalog');
    await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    c.release(); await pool.end();
  }
}
main().catch(e=>{console.error(`Branch tests failed: ${e.code??e.name}: ${e.message}`);process.exitCode=1;});
