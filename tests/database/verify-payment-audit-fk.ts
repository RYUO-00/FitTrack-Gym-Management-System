import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pool } from '../../server/src/database/pool';

// Verifies the configured installation after its owner applies the migration.
// Fixture writes in 13_test_queries.sql are rolled back. Sequence gaps are normal.
async function main() {
  const client = await pool.connect();
  const tables = ['gyms', 'admins', 'members', 'trainers', 'membership_plans', 'subscriptions',
    'payments', 'attendance', 'payment_audit'];
  const snapshot = async () => {
    const values: Record<string, unknown> = {};
    for (const table of tables) {
      values[table] = (await client.query(`SELECT count(*)::int AS rows,
        md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]')) AS fingerprint
        FROM public.${table} AS t`)).rows[0];
    }
    return values;
  };
  try {
    const identity = (await client.query(`SELECT current_database() AS database,
      current_user AS role,inet_server_addr()::text AS host,
      inet_server_port() AS port,version() AS version`)).rows[0];
    console.log(JSON.stringify(identity));
    assert.equal(identity.database, 'fittrack', 'Expected permanent FitTrack database');
    assert.equal(identity.port, 5432);
    assert.match(identity.version, /^PostgreSQL 18\./);
    await client.query('SET search_path TO public, pg_catalog');
    const constraint = (await client.query(`SELECT a.attnotnull AS required,
      c.convalidated AS validated,c.confdeltype AS delete_action,
      pg_get_constraintdef(c.oid) AS definition
      FROM pg_attribute a JOIN pg_constraint c ON c.conrelid=a.attrelid
        AND c.conkey=ARRAY[a.attnum] AND c.contype='f'
      WHERE a.attrelid='public.payment_audit'::regclass AND a.attname='payment_id'
        AND c.confrelid='public.payments'::regclass`)).rows[0];
    assert.ok(constraint, 'Payment audit foreign key is missing; apply the owner migration first');
    assert.equal(constraint.required, true);
    assert.equal(constraint.validated, true);
    assert.equal(constraint.delete_action, 'r');
    console.log('PASS persistent schema: ' + constraint.definition + '; payment_id NOT NULL');
    const before = await snapshot();
    await client.query(readFileSync(resolve('database/13_test_queries.sql'), 'utf8'));
    await client.query(readFileSync(resolve('database/15_gym_weak_entity_tests.sql'), 'utf8'));
    await client.query(readFileSync(resolve('database/16_branch_isolation_tests.sql'),'utf8'));
    const after = await snapshot();
    assert.deepEqual(after, before, 'Existing table records changed during rollback tests');
    console.log('PASS persistent tests: audit INSERT/UPDATE snapshots, NULL/orphan rejection, RESTRICT deletion, routines and views');
    console.log('PASS all nine tables retain identical record counts and content fingerprints');
    console.log(JSON.stringify(Object.fromEntries(Object.entries(after).map(([key, value]: [string, any]) => [key, value.rows]))));
    console.log(JSON.stringify((await client.query(`SELECT
      (SELECT count(*)::int FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f') AS foreign_keys,
      (SELECT count(*)::int FROM payment_audit a LEFT JOIN payments p USING(payment_id)
        WHERE a.payment_id IS NULL OR p.payment_id IS NULL) AS invalid_audit_references`)).rows[0]));
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}
main().catch((error) => {
  console.error(`Persistent verification failed: ${error.code ?? error.name}: ${error.message}`);
  process.exitCode = 1;
});
