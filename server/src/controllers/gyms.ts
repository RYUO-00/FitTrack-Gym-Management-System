import { query } from '../database/pool';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/errors';
import { parseId } from '../validators';
import { toCamel } from '../utils/format';
import type { Request } from 'express';
function canAccess(req:Request,id:number){
 if(req.admin?.gymId!=null && req.admin.gymId!==id)throw new HttpError(403,'You are not authorized for this branch.');
}
export const list=asyncHandler(async(req,res)=>{
 const page=Math.max(1,Math.floor(Number(req.query.page)||1));
 const pageSize=Math.min(100,Math.max(1,Math.floor(Number(req.query.pageSize)||100)));
 const args=[req.admin?.gymId??null,`%${String(req.query.search??'').trim()}%`];
 const where='WHERE ($1::int IS NULL OR gym_id=$1) AND (branch_name ILIKE $2 OR city ILIKE $2 OR address ILIKE $2)';
 const total=Number((await query(`SELECT count(*) FROM gyms ${where}`,args)).rows[0].count);
 const rows=await query(`SELECT * FROM gyms ${where} ORDER BY branch_name LIMIT $3 OFFSET $4`,[...args,pageSize,(page-1)*pageSize]);
 res.json(toCamel({rows:rows.rows,pagination:{page,pageSize,total,totalPages:Math.ceil(total/pageSize)}}));
});
export const getOne=asyncHandler(async(req,res)=>{
 const id=parseId(req.params.id);canAccess(req,id);
 const r=await query('SELECT * FROM gyms WHERE gym_id=$1',[id]);
 if(!r.rowCount)throw new HttpError(404,'Branch not found.');res.json(toCamel(r.rows[0]));
});
export const create=asyncHandler(async(req,res)=>{
 if(req.admin?.gymId!=null)throw new HttpError(403,'Only an administrator with all-branch access can add a branch.');
 const b=req.body;
 const r=await query(`INSERT INTO gyms(branch_name,address,city,contact_number,email,status)
 VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[b.branchName,b.address,b.city,b.contactNumber,b.email,b.status]);
 res.status(201).json(toCamel(r.rows[0]));
});
export const update=asyncHandler(async(req,res)=>{
 const id=parseId(req.params.id);canAccess(req,id);const b=req.body;
 const r=await query(`UPDATE gyms SET branch_name=$2,address=$3,city=$4,contact_number=$5,email=$6,status=$7
 WHERE gym_id=$1 RETURNING *`,[id,b.branchName,b.address,b.city,b.contactNumber,b.email,b.status]);
 if(!r.rowCount)throw new HttpError(404,'Branch not found.');res.json(toCamel(r.rows[0]));
});
export const remove=asyncHandler(async(req,res)=>{
 if(req.admin?.gymId!=null)throw new HttpError(403,'Only an administrator with all-branch access can remove a branch.');
 const r=await query('DELETE FROM gyms WHERE gym_id=$1',[parseId(req.params.id)]);
 if(!r.rowCount)throw new HttpError(404,'Branch not found.');res.status(204).end();
});
