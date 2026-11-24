import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pool } from '../../server/src/database/pool';
async function main(){
 const c=await pool.connect();const schema='fittrack_scope_test_'+randomUUID().replaceAll('-','');
 assert.match(schema,/^fittrack_scope_test_[a-f0-9]+$/);
 const old=readFileSync('tests/database/fixtures/pre-branch-isolation.sql','utf8');
 const migrate=()=>c.query(readFileSync('database/migrations/003_branch_isolation.sql','utf8').replace(/\bpublic\b/g,schema));
 const snapshot=async(upgraded:boolean)=>{
  const result:Record<string,unknown>={};
  for(const t of ['gyms','admins','members','trainers','membership_plans','subscriptions','payments','attendance','payment_audit']){
   let row='to_jsonb(t)';
   if(upgraded&&['admins','members','trainers'].includes(t))row+=" - 'gym_id'";
   if(upgraded&&t==='gyms')row="to_jsonb(t) - 'city' - 'status' - 'contact_number' || jsonb_build_object('phone',t.contact_number)";
   result[t]=(await c.query(`SELECT jsonb_agg(v ORDER BY v::text) AS records FROM (SELECT ${row} v FROM ${t} t)x`)).rows[0].records;
  }return result;
 };
 try{
  await c.query(`CREATE SCHEMA ${schema};SET search_path TO ${schema},pg_catalog`);
  await c.query(old);const before=await snapshot(false);await migrate();assert.deepEqual(await snapshot(true),before);
  await migrate();assert.deepEqual(await snapshot(true),before);
  assert.equal((await c.query('SELECT count(*)::int n FROM pg_tables WHERE schemaname=$1',[schema])).rows[0].n,9);
  for(const f of ['09_functions.sql','10_procedures.sql','11_triggers.sql','08_views.sql'])await c.query(readFileSync('database/'+f,'utf8'));
  assert.ok((await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='v_monthly_revenue' AND column_name='gym_id'",[schema])).rowCount);
  console.log('PASS migration 003: exactly nine tables, original records preserved, valid inferred branch ownership and idempotent rerun.');
  await c.query(readFileSync('database/16_branch_isolation_tests.sql','utf8'));
  assert.deepEqual(await snapshot(true),before);
  console.log('PASS same-branch member/trainer creation checks; composite plan references; active/inactive rules; renewal, payments/audit and attendance preserved.');
  await c.query(`DROP SCHEMA ${schema} CASCADE;CREATE SCHEMA ${schema};SET search_path TO ${schema},pg_catalog`);await c.query(old);
  await c.query(`WITH g AS (INSERT INTO gyms(branch_name,address,phone,email) VALUES('Ambiguous branch','Test','9000012345','test@example.test') RETURNING gym_id)
   INSERT INTO membership_plans(gym_id,plan_no,plan_name,duration_months,price) SELECT gym_id,1,'Test',1,100 FROM g`);
  await c.query(`INSERT INTO subscriptions(member_id,gym_id,plan_no,start_date,end_date)
   SELECT (SELECT min(member_id) FROM members),gym_id,1,CURRENT_DATE,CURRENT_DATE+30 FROM gyms WHERE branch_name='Ambiguous branch'`);
  const ambiguous=await snapshot(false);await assert.rejects(migrate());await c.query('ROLLBACK');assert.deepEqual(await snapshot(false),ambiguous);
  console.log('PASS ambiguous multi-branch legacy ownership aborts atomically without losing records.');
 }finally{await c.query('ROLLBACK');await c.query('SET search_path TO public,pg_catalog');await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);c.release();await pool.end();}
}
main().catch(e=>{console.error(`Branch isolation tests failed: ${e.code??e.name}: ${e.message}`);process.exitCode=1;});
