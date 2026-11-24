import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../../server/src/database/pool';
async function main(){
 const port=4108;const tag=randomUUID();const gyms:number[]=[];const members:number[]=[];const trainers:number[]=[];let adminId:number|undefined;let cookie='';let scope:number|undefined;
 const server=spawn(process.execPath,['--import','tsx','server/src/index.ts'],{env:{...process.env,PORT:String(port)},stdio:'ignore',windowsHide:true});
 const tables=['gyms','admins','members','trainers','membership_plans','subscriptions','payments','attendance','payment_audit'];
 const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,(await pool.query(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]')) f FROM ${t} x`)).rows[0].f])));
 const call=async(path:string,method='GET',body?:any,expected=200)=>{
  const r=await fetch(`http://localhost:${port}/api${path}`,{method,headers:{'Content-Type':'application/json',Cookie:cookie,...(scope?{'X-Gym-Id':String(scope)}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  if(path==='/auth/login')cookie=(r.headers.get('set-cookie')??'').split(';')[0];
  assert.equal(r.status,expected,`${method} ${path} -> ${await r.clone().text()}`);return r.status===204?null:r.json();
 };
 let before:Record<string,unknown>|undefined;
 try{
  for(let n=0;n<100;n++){try{if((await fetch(`http://localhost:${port}/api/health`)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.equal(server.exitCode,null,'Test server exited; check the reserved port');before=await snapshot();
  await call('/auth/login','POST',{email:process.env.FITTRACK_ADMIN_EMAIL,password:process.env.FITTRACK_ADMIN_PASSWORD});
  const gymBody=(name:string)=>({branchName:`${name} ${tag}`,address:'Verification address',city:'Mangaluru',contactNumber:'9000012345',email:`${name.toLowerCase()}.${tag}@example.test`,status:'ACTIVE'});
  const ga=await call('/gyms','POST',gymBody('A'),201);gyms.push(ga.gymId);
  const gb=await call('/gyms','POST',gymBody('B'),201);gyms.push(gb.gymId);
  const fixture:any[]=[];
  for(const [i,g] of [ga,gb].entries()){
   scope=g.gymId;
   const m=await call('/members','POST',{memberName:`Scope ${i} ${tag}`,email:`m${i}.${tag}@example.test`,phone:`${i}${tag.slice(0,25)}`},201);members.push(m.memberId);
   const t=await call('/trainers','POST',{trainerName:`Scope trainer ${i}`,email:`t${i}.${tag}@example.test`,phone:'9000012346',specialization:'Strength'},201);trainers.push(t.trainerId);
   await call('/plans','POST',{gymId:g.gymId,planNo:1,planName:'Monthly',durationMonths:1,price:100*(i+1)},201);
   const date=(await pool.query('SELECT CURRENT_DATE::text d')).rows[0].d;
   const s=await call('/subscriptions','POST',{memberId:m.memberId,gymId:g.gymId,planNo:1,trainerId:t.trainerId,startDate:date,amount:100*(i+1)},201);
   fixture.push({m,t,s,g,date});
   const dash=await call('/dashboard');assert.equal(dash.stats.totalMembers,1);assert.equal(Number(dash.stats.monthlyRevenue),100*(i+1));
   assert.deepEqual((await call('/members')).rows.map((x:any)=>x.memberId),[m.memberId]);
   assert.deepEqual((await call('/trainers')).rows.map((x:any)=>x.trainerId),[t.trainerId]);
   assert.ok((await call('/subscriptions')).rows.every((x:any)=>x.gymId===g.gymId));
   assert.equal((await call('/payments')).length,1);
   const reports=await call('/reports?from=2026-01-01&to=2027-12-31');assert.ok(reports.plans.every((x:any)=>x.gymId===g.gymId));
   assert.equal(reports.revenue.reduce((n:number,x:any)=>n+Number(x.revenue),0),100*(i+1));
  }
  console.log('PASS two active branches, repeated partial plan keys, scoped members/trainers/plans/subscriptions/payments, exact dashboard and report totals.');
  const [a,b]=fixture;scope=ga.gymId;
  const renewed=await call(`/subscriptions/${a.s.subscriptionId}/renew`,'POST',{gymId:ga.gymId,planNo:1,startDate:a.date},201);assert.notEqual(renewed.subscriptionId,a.s.subscriptionId);
  const visit=await call('/attendance','POST',{subscriptionId:a.s.subscriptionId},201);
  const pay=(await call('/payments'))[0];await call(`/payments/${pay.paymentId}/status`,'PATCH',{paymentStatus:'PENDING'});
  assert.equal(Number((await pool.query('SELECT count(*) FROM payment_audit WHERE payment_id=$1',[pay.paymentId])).rows[0].count),2);
  scope=gb.gymId;
  for(const path of [`/members/${a.m.memberId}`,`/members/${a.m.memberId}/history`,`/trainers/${a.t.trainerId}`,`/subscriptions/${a.s.subscriptionId}`])await call(path,'GET',undefined,404);
  await call(`/members/${a.m.memberId}`,'PUT',{memberName:'Cannot edit',email:a.m.email,phone:a.m.phone},404);
  await call(`/trainers/${a.t.trainerId}`,'DELETE',undefined,404);
  await call(`/subscriptions/${a.s.subscriptionId}/cancel`,'POST',{},404);
  await call('/attendance','POST',{subscriptionId:a.s.subscriptionId},404);
  await call(`/attendance/${visit.attendanceId}/checkout`,'PATCH',{},404);
  await call('/payments','POST',{subscriptionId:a.s.subscriptionId,amount:1,paymentMethod:'CASH',paymentStatus:'PAID'},404);
  await call(`/payments/${pay.paymentId}/status`,'PATCH',{paymentStatus:'PAID'},404);
  await call('/subscriptions','POST',{memberId:a.m.memberId,gymId:gb.gymId,planNo:1,startDate:b.date},409);
  await call('/subscriptions','POST',{memberId:b.m.memberId,gymId:gb.gymId,planNo:1,trainerId:a.t.trainerId,startDate:b.date},409);
  await call('/subscriptions','POST',{memberId:b.m.memberId,gymId:gb.gymId,planNo:99,startDate:b.date},409);
  await call(`/plans/${ga.gymId}/1`,'GET',undefined,403);
  await call(`/plans?gymId=${ga.gymId}`,'GET',undefined,403);
  assert.equal((await call('/attendance')).length,0);
  console.log('PASS cross-branch direct record reads/writes/history, forged plan branch and foreign member/trainer requests rejected; renewal/payment audit/attendance remain intact.');
  await call(`/gyms/${gb.gymId}`,'PUT',{...gymBody('B'),status:'INACTIVE'});
  await call('/subscriptions','POST',{memberId:b.m.memberId,gymId:gb.gymId,planNo:1,startDate:b.date},409);
  await call('/members','POST',{memberName:'Blocked',email:`blocked.${tag}@example.test`,phone:'9000012349'},409);
  await call('/plans','POST',{gymId:gb.gymId,planNo:2,planName:'Blocked',durationMonths:1,price:100},409);
  await call('/attendance','POST',{subscriptionId:b.s.subscriptionId},409);await call('/dashboard');
  await call(`/gyms/${gb.gymId}`,'PUT',gymBody('B'));
  const password=randomUUID()+randomUUID();const email=`staff.${tag}@example.test`;
  adminId=(await pool.query('INSERT INTO admins(email,password_hash,display_name,gym_id) VALUES($1,$2,$3,$4) RETURNING admin_id',[email,await bcrypt.hash(password,10),'Branch test staff',gb.gymId])).rows[0].admin_id;
  await call('/auth/login','POST',{email,password});assert.deepEqual((await call('/gyms')).rows.map((x:any)=>x.gymId),[gb.gymId]);
  scope=ga.gymId;for(const path of ['/dashboard','/members','/trainers','/plans','/subscriptions','/payments','/attendance','/reports'])await call(path,'GET',undefined,403);
  await call(`/gyms/${ga.gymId}`,'GET',undefined,403);await call('/gyms','POST',gymBody('Forbidden'),403);
  scope=undefined;assert.equal((await call('/dashboard')).gymId,gb.gymId);
  await pool.query('UPDATE admins SET gym_id=$1 WHERE admin_id=$2',[ga.gymId,adminId]);scope=gb.gymId;await call('/dashboard','GET',undefined,403);
  await call('/auth/logout','POST',{});cookie='';await call('/dashboard','GET',undefined,401);
  console.log('PASS activation/deactivation, no extra branch login, restricted staff access, header tampering rejection and live authorization changes.');
 }finally{
  const c=await pool.connect();try{await c.query('BEGIN');
   if(members.length){await c.query('DELETE FROM payment_audit WHERE payment_id IN(SELECT payment_id FROM payments JOIN subscriptions USING(subscription_id) WHERE member_id=ANY($1::int[]))',[members]);await c.query('DELETE FROM attendance WHERE subscription_id IN(SELECT subscription_id FROM subscriptions WHERE member_id=ANY($1::int[]))',[members]);await c.query('DELETE FROM payments WHERE subscription_id IN(SELECT subscription_id FROM subscriptions WHERE member_id=ANY($1::int[]))',[members]);await c.query('DELETE FROM subscriptions WHERE member_id=ANY($1::int[])',[members]);await c.query('DELETE FROM members WHERE member_id=ANY($1::int[])',[members]);}
   if(trainers.length)await c.query('DELETE FROM trainers WHERE trainer_id=ANY($1::int[])',[trainers]);
   if(adminId)await c.query('DELETE FROM admins WHERE admin_id=$1',[adminId]);
   if(gyms.length){await c.query('DELETE FROM membership_plans WHERE gym_id=ANY($1::int[])',[gyms]);await c.query('DELETE FROM gyms WHERE gym_id=ANY($1::int[])',[gyms]);}
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();server.kill();}
  if(before){assert.deepEqual(await snapshot(),before);console.log('PASS all nine original table fingerprints unchanged; only tagged fixtures removed.');}await pool.end();
 }
}
main().catch(e=>{console.error(`Multi-branch API tests failed: ${e.message}`);process.exitCode=1;});
