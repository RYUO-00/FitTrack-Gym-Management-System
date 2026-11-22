import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pool } from '../../server/src/database/pool';

// Uses isolated, uniquely named schemas on the configured PostgreSQL server.
// Does not initialize, seed, or migrate public tables. All fixtures are removed.
const sql = (file: string) => readFileSync(resolve('database', file), 'utf8');
const migration = sql('migrations/001_payment_audit_payment_fk.sql');
const files = ['01_schema.sql', '02_constraints_and_indexes.sql', '09_functions.sql',
  '10_procedures.sql', '11_triggers.sql', '08_views.sql', '03_seed_data.sql'];

async function main() {
  const client = await pool.connect();
  const schema = `fittrack_fk_test_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^fittrack_fk_test_[a-f0-9]+$/);
  let created = false;
  let passed = 0;
  const pass = (name: string) => { passed++; console.log(`PASS ${name}`); };
  const applyMigration = () => client.query(migration.replace(/\bpublic\b/g, schema));
  const columns = async () => (await client.query(`SELECT attnotnull FROM pg_attribute
    WHERE attrelid='${schema}.payment_audit'::regclass AND attname='payment_id'`)).rows[0];
  const audits = async () => (await client.query('SELECT * FROM payment_audit ORDER BY audit_id')).rows;
  try {
    console.log(JSON.stringify((await client.query(`SELECT current_database() AS database,
      inet_server_addr()::text AS host,inet_server_port() AS port,version() AS version`)).rows[0]));
    await client.query(`CREATE SCHEMA ${schema}`);
    created = true;
    await client.query(`SET search_path TO ${schema}, pg_catalog`);

    // Verify fresh installation, including trigger-generated audits and seed data.
    for (const file of files) await client.query(sql(file));
    assert.equal((await columns()).attnotnull, true);
    await client.query(sql('13_test_queries.sql'));
    pass('Fresh setup: required FK, INSERT/UPDATE audit snapshots, NULL/orphan rejection and payment delete restriction');

    // Reconstruct the pre-migration nullable, unconstrained payment reference.
    await client.query('ALTER TABLE payment_audit DROP CONSTRAINT payment_audit_payment_id_fkey');
    await client.query('ALTER TABLE payment_audit ALTER COLUMN payment_id DROP NOT NULL');
    const seedAudits = await audits();
    const invalidId = (await client.query(`INSERT INTO payment_audit(payment_id,operation,new_values)
      VALUES(NULL,'INSERT','{}') RETURNING audit_id`)).rows[0].audit_id;
    const beforeNull = await audits();
    await assert.rejects(applyMigration(), (error: any) => error.code === '23514');
    await client.query('ROLLBACK');
    assert.deepEqual(await audits(), beforeNull);
    assert.equal((await columns()).attnotnull, false);
    pass('Legacy NULL reference: migration fails atomically and preserves every audit row');

    await client.query('DELETE FROM payment_audit WHERE audit_id=$1', [invalidId]);
    const orphanId = (await client.query(`INSERT INTO payment_audit(payment_id,operation,new_values)
      VALUES(-2147483647,'INSERT','{}') RETURNING audit_id`)).rows[0].audit_id;
    const beforeOrphan = await audits();
    await assert.rejects(applyMigration(), (error: any) => error.code === '23514');
    await client.query('ROLLBACK');
    assert.deepEqual(await audits(), beforeOrphan);
    assert.equal((await columns()).attnotnull, false);
    pass('Legacy orphan reference: migration fails atomically and preserves every audit row');

    await client.query('DELETE FROM payment_audit WHERE audit_id=$1', [orphanId]);
    await applyMigration();
    assert.equal((await columns()).attnotnull, true);
    assert.deepEqual(await audits(), seedAudits);
    pass('Valid legacy upgrade: NOT NULL and validated RESTRICT foreign key added without data changes');
    await applyMigration();
    assert.deepEqual(await audits(), seedAudits);
    pass('Migration rerun is idempotent and leaves existing records unchanged');
    await client.query(sql('13_test_queries.sql'));
    assert.deepEqual(await audits(), seedAudits);
    pass('Migrated schema: audit triggers, constraints, routines, views and rollback checks pass');
    console.log(`${passed} database test groups passed.`);
  } finally {
    await client.query('ROLLBACK');
    await client.query('SET search_path TO public, pg_catalog');
    if (created) await client.query(`DROP SCHEMA ${schema} CASCADE`);
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  // Never print the connection string or error object that may contain credentials.
  console.error(`Database tests failed: ${error.code ?? error.name}: ${error.message}`);
  process.exitCode = 1;
});
