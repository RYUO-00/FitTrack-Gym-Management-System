import { assertBranch,requireActiveBranch } from '../middleware/branch';
import { query } from '../database/pool';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/errors';
import { toCamel } from '../utils/format';
import { parseId } from '../validators';

const select = `SELECT p.*,g.branch_name FROM membership_plans p JOIN gyms g USING(gym_id)`;
const keys = (params: Record<string, any>) => [parseId(params.gymId), parseId(params.planNo)];

export const list = asyncHandler(async (req, res) => {
  const values: unknown[] = [req.gymId!];
  const conditions: string[] = ['p.gym_id=$1'];
  if (req.query.search) {
    values.push(`%${String(req.query.search).trim()}%`);
    conditions.push(`(p.plan_name ILIKE $${values.length} OR p.description ILIKE $${values.length} OR g.branch_name ILIKE $${values.length})`);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const total = Number((await query(`SELECT COUNT(*) AS count FROM membership_plans p JOIN gyms g USING(gym_id)${where}`, values)).rows[0].count);
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(req.query.pageSize) || 10)));
  values.push(pageSize,(page-1)*pageSize);
  const rows = await query(`${select}${where} ORDER BY g.branch_name,p.plan_no LIMIT $${values.length-1} OFFSET $${values.length}`, values);
  res.json(toCamel({ rows: rows.rows, pagination: { page,pageSize,total,totalPages: Math.ceil(total/pageSize) } }));
});

export const getOne = asyncHandler(async (req, res) => {
  assertBranch(req,parseId(req.params.gymId));
  const result = await query(`${select} WHERE p.gym_id=$1 AND p.plan_no=$2`, keys(req.params));
  if (!result.rowCount) throw new HttpError(404,'Plan not found in this branch.');
  res.json(toCamel(result.rows[0]));
});

export const create = asyncHandler(async (req, res) => {
  const b = req.body;assertBranch(req,b.gymId);requireActiveBranch(req);
  const result = await query(`INSERT INTO membership_plans(gym_id,plan_no,plan_name,duration_months,price,description,is_active)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [b.gymId,b.planNo,b.planName,b.durationMonths,b.price,b.description,b.isActive]);
  res.status(201).json(toCamel(result.rows[0]));
});

export const update = asyncHandler(async (req, res) => {
  const [gymId,planNo] = keys(req.params);assertBranch(req,gymId);
  const b = req.body;
  if (b.gymId !== gymId || b.planNo !== planNo) throw new HttpError(400,'A plan’s branch and number cannot be changed. Create a new plan instead.');
  const result = await query(`UPDATE membership_plans SET plan_name=$3,duration_months=$4,price=$5,description=$6,is_active=$7
    WHERE gym_id=$1 AND plan_no=$2 RETURNING *`, [gymId,planNo,b.planName,b.durationMonths,b.price,b.description,b.isActive]);
  if (!result.rowCount) throw new HttpError(404,'Plan not found in this branch.');
  res.json(toCamel(result.rows[0]));
});

export const remove = asyncHandler(async (req, res) => {
  assertBranch(req,parseId(req.params.gymId));
  const result = await query('DELETE FROM membership_plans WHERE gym_id=$1 AND plan_no=$2', keys(req.params));
  if (!result.rowCount) throw new HttpError(404,'Plan not found in this branch.');
  res.status(204).end();
});
