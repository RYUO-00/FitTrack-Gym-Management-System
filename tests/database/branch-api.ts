import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { pool } from '../../server/src/database/pool';

// Actual HTTP workflows against the configured database. Only uniquely tagged fixtures
// are removed; fingerprints verify that every original row is preserved.
async function main() {
  const port = 4107;
  const server = spawn(process.execPath,['--import','tsx','server/src/index.ts'], {
    env: {...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true,
  });
  let cookie=''; let gymId: number|undefined; let memberId: number|undefined;
  const tag=randomUUID();
  const tables=['gyms','members','trainers','membership_plans','subscriptions','payments','attendance','admins','payment_audit'];
  const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,(await pool.query(`SELECT
    md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]')) AS fingerprint FROM ${t} x`)).rows[0].fingerprint])));
  const call=async(path:string,method='GET',body?:unknown,status=200)=>{
    const r=await fetch(`http://localhost:${port}/api${path}`, {method,headers:{'Content-Type':'application/json',Cookie:cookie,...(gymId?{'X-Gym-Id':String(gymId)}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    if(path==='/auth/login') cookie=(r.headers.get('set-cookie')??'').split(';')[0];
    assert.equal(r.status,status,`${method} ${path}: ${await r.clone().text()}`);
    return r.status===204?undefined:r.json();
  };
  let before: Record<string,any>|undefined;
  try {
    for(let n=0;n<100;n++) {
      try { const r=await fetch(`http://localhost:${port}/api/health`); if(r.ok)break; } catch {}
      await new Promise(r=>setTimeout(r,100));
    }
    before=await snapshot();
    await call('/plans','GET',undefined,401);
    await call('/auth/login','POST',{email:process.env.FITTRACK_ADMIN_EMAIL,password:process.env.FITTRACK_ADMIN_PASSWORD});
    gymId=(await call('/gyms','POST',{branchName:`API Branch ${tag}`,address:'API test address',city:'Mangaluru',contactNumber:'9000012345',email:`branch.${tag}@example.test`},201)).gymId;
    await call(`/gyms/${gymId}`);
    await call(`/gyms/${gymId}`,'PUT',{branchName:`API Branch ${tag}`,address:'Updated test address',city:'Mangaluru',contactNumber:'9000012345',email:`branch.${tag}@example.test`});
    const plan={gymId,planNo:1,planName:'API Branch Monthly',durationMonths:1,price:100,description:'Disposable verification fixture',isActive:true};
    await call('/plans','POST',plan,201);
    await call('/plans','POST',plan,409);
    assert.equal((await call(`/plans/${gymId}/1`)).gymId,gymId);
    await call(`/plans/${gymId}/1`,'PUT',{...plan,price:120});
    await call(`/plans/${gymId}/1`,'PUT',{...plan,planNo:2},400);
    await call(`/plans/${gymId}/1`,'DELETE',undefined,204);
    await call(`/plans/${gymId}/1`,'GET',undefined,404);
    await call('/plans','POST',plan,201);
    assert.equal((await call(`/plans?gymId=${gymId}&search=API&pageSize=1`)).pagination.total,1);
    assert.equal((await call('/plans?search=missing_'+tag)).pagination.total,0);
    memberId=(await call('/members','POST',{memberName:`API Member ${tag}`,email:`member.${tag}@example.test`,phone:tag.slice(0,25),joinDate:'2026-11-10'},201)).memberId;
    assert.equal((await call(`/members/${memberId}`)).joinDate,'2026-11-10');
    const today=(await pool.query('SELECT CURRENT_DATE::text AS date')).rows[0].date;
    await call(`/plans/${gymId}/1`,'PUT',{...plan,isActive:false});
    await call('/subscriptions','POST',{memberId,gymId,planNo:1,startDate:today},409);
    await call(`/plans/${gymId}/1`,'PUT',{...plan,isActive:true});
    const sub=await call('/subscriptions','POST',{memberId,gymId,planNo:1,startDate:today,amount:120,paymentMethod:'UPI'},201);
    assert.equal(sub.gymId,gymId); assert.equal(sub.planNo,1); assert.equal(sub.branchName,`API Branch ${tag}`);
    const renewed=await call(`/subscriptions/${sub.subscriptionId}/renew`,'POST',{gymId,planNo:1,startDate:today},201);
    assert.notEqual(renewed.subscriptionId,sub.subscriptionId);
    assert.ok(renewed.startDate>sub.endDate);
    await call('/subscriptions','POST',{memberId,gymId,planNo:99,startDate:today},409);
    const payment=await call('/payments','POST',{subscriptionId:sub.subscriptionId,amount:10,paymentMethod:'CASH',paymentStatus:'PENDING'},201);
    await call(`/payments/${payment.paymentId}/status`,'PATCH',{paymentStatus:'PAID'});
    assert.equal(Number((await pool.query('SELECT count(*) FROM payment_audit WHERE payment_id=$1',[payment.paymentId])).rows[0].count),2);
    const visit=await call('/attendance','POST',{subscriptionId:sub.subscriptionId},201);
    await call(`/attendance/${visit.attendanceId}/checkout`,'PATCH',{});
    for(const path of ['/dashboard','/reports?from=2026-01-01&to=2027-12-31',`/members/${memberId}/history`,'/attendance','/payments','/subscriptions?pageSize=1']) await call(path);
    await call(`/plans/${gymId}/1`,'DELETE',undefined,409);
    await call(`/gyms/${gymId}`,'DELETE',undefined,409);
    await call('/reports?from=invalid','GET',undefined,400);
    await call('/auth/logout','POST',{});
    cookie=''; await call('/dashboard','GET',undefined,401);
    console.log('PASS real HTTP login/logout, gym/plan CRUD, composite-key validation, plan search/pagination/empty state, member calendar date, subscription + initial payment, renewal history, payment update/audit, attendance, dashboard, reports, histories and delete restrictions');
  } finally {
    // All IDs are returned from this test's own tagged records, never existing data.
    const c=await pool.connect();
    try {
      await c.query('BEGIN');
      if(memberId) {
        await c.query('DELETE FROM payment_audit WHERE payment_id IN(SELECT payment_id FROM payments WHERE subscription_id IN(SELECT subscription_id FROM subscriptions WHERE member_id=$1))',[memberId]);
        await c.query('DELETE FROM attendance WHERE subscription_id IN(SELECT subscription_id FROM subscriptions WHERE member_id=$1)',[memberId]);
        await c.query('DELETE FROM payments WHERE subscription_id IN(SELECT subscription_id FROM subscriptions WHERE member_id=$1)',[memberId]);
        await c.query('DELETE FROM subscriptions WHERE member_id=$1',[memberId]);
        await c.query('DELETE FROM members WHERE member_id=$1 AND email=$2',[memberId,`member.${tag}@example.test`]);
      }
      if(gymId) {
        await c.query('DELETE FROM membership_plans WHERE gym_id=$1',[gymId]);
        await c.query('DELETE FROM gyms WHERE gym_id=$1 AND branch_name=$2',[gymId,`API Branch ${tag}`]);
      }
      await c.query('COMMIT');
    } catch(e) {await c.query('ROLLBACK');throw e;} finally {c.release();server.kill();}
    if(before) { assert.deepEqual(await snapshot(),before);console.log('PASS HTTP fixtures cleaned up; all nine original table fingerprints unchanged'); }
    await pool.end();
  }
}
main().catch(e=>{console.error(`API verification failed: ${e.message}`);process.exitCode=1;});
