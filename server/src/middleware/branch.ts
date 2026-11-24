import type { Request,Response,NextFunction } from 'express';
import { query } from '../database/pool';
import { HttpError } from '../utils/errors';
import { parseId } from '../validators';

export async function requireBranch(req:Request,_res:Response,next:NextFunction){
 try{
  const requested=req.header('X-Gym-Id') ?? req.query.gymId ?? req.body?.gymId;
  let id:number;
  if(requested===undefined){
    id=req.admin?.gymId ?? (await query('SELECT gym_id FROM gyms ORDER BY gym_id LIMIT 1')).rows[0]?.gym_id;
    if(!id)throw new HttpError(409,'Create a gym branch first.');
  }else id=parseId(String(requested));
  if(req.admin?.gymId!=null && req.admin.gymId!==id)throw new HttpError(403,'You are not authorized for this branch.');
  const gym=(await query('SELECT gym_id,status FROM gyms WHERE gym_id=$1',[id])).rows[0];
  if(!gym)throw new HttpError(404,'Branch not found.');
  for(const value of [req.query.gymId,req.body?.gymId]){
    if(value!==undefined && parseId(String(value))!==id)throw new HttpError(403,'The requested record belongs to a different branch.');
  }
  req.gymId=id;req.gymStatus=gym.status;next();
 }catch(e){next(e);}
}

export function assertBranch(req:Request,id:number){
 if(req.gymId!==id)throw new HttpError(403,'The requested record belongs to a different branch.');
}
export function requireActiveBranch(req:Request){
 if(req.gymStatus!=='ACTIVE')throw new HttpError(409,'This branch is inactive. Activate it before adding records.');
}
