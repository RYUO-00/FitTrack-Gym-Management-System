import { query } from '../database/pool';
import { HttpError } from '../utils/errors';

type Resource = 'members' | 'trainers';
const definitions = {
  members: { table: 'members', key: 'member_id', fields: { memberName: 'member_name', email: 'email', phone: 'phone', joinDate: 'join_date' } },
  trainers: { table: 'trainers', key: 'trainer_id', fields: { trainerName: 'trainer_name', email: 'email', phone: 'phone', specialization: 'specialization' } },

} as const;

export async function listResource(resource: Resource, params: URLSearchParams, gymId: number) {
  const { table } = definitions[resource];
  const search = params.get('search')?.trim() ?? '';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? 10) || 10));
  const alias = resource==='trainers'?'t':'members';
  const values: unknown[]=[gymId];
  const conditions=[`${alias}.gym_id=$1`];
  if(search){values.push(`%${search}%`);conditions.push(resource==='members'?'(member_name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2)':'(trainer_name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2 OR specialization ILIKE $2)');}
  const where='WHERE '+conditions.join(' AND ');
  const count = await query<{ count: string }>(`SELECT COUNT(*)::TEXT AS count FROM ${table} ${resource==='trainers'?'t':''} ${where}`, values);
  const offsetIndex = values.length + 1;
  const extras = resource === 'trainers'
    ? `, (SELECT COUNT(DISTINCT s.member_id)::INTEGER FROM subscriptions s WHERE s.trainer_id=t.trainer_id) AS assigned_member_count`
    : '';
  const rows = await query(
    `SELECT ${alias}.*${extras} FROM ${table} ${resource === 'trainers' ? 't' : ''} ${where}
     ORDER BY ${resource === 'members' ? 'member_name' : resource === 'trainers' ? 't.trainer_name' : 't.trainer_name'}
     LIMIT $${offsetIndex} OFFSET $${offsetIndex + 1}`,
    [...values, pageSize, (page - 1) * pageSize],
  );
  return { rows: rows.rows, pagination: { page, pageSize, total: Number(count.rows[0]?.count ?? 0), totalPages: Math.ceil(Number(count.rows[0]?.count ?? 0) / pageSize) } };
}

export async function getResource(resource: Resource, id: number, gymId: number) {
  const { table, key } = definitions[resource];
  const result = resource === 'trainers'
    ? await query(`SELECT t.*, (SELECT COUNT(DISTINCT s.member_id)::INTEGER FROM subscriptions s WHERE s.trainer_id=t.trainer_id) AS assigned_member_count FROM trainers t WHERE t.trainer_id=$1 AND t.gym_id=$2`, [id,gymId])
    : await query(`SELECT * FROM ${table} WHERE ${key}=$1 AND gym_id=$2`, [id,gymId]);
  if (!result.rowCount) throw new HttpError(404, 'Record not found.');
  return result.rows[0];
}

export async function createResource(resource: Resource, body: Record<string, unknown>, gymId: number) {
  const { table, fields } = definitions[resource];
  const entries = Object.entries(fields).filter(([key]) => body[key] !== undefined && !(key === 'joinDate' && !body[key]));
  const columns = ['gym_id',...entries.map(([, column]) => column)];
  const values = [gymId,...entries.map(([key]) => body[key])];
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const result = await query(
    `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`, values,
  );
  return result.rows[0];
}

export async function updateResource(resource: Resource, id: number, body: Record<string, unknown>, gymId: number) {
  const { table, key, fields } = definitions[resource];
  const entries = Object.entries(fields).filter(([field]) => body[field] !== undefined && !(field === 'joinDate' && !body[field]));
  if (!entries.length) throw new HttpError(400, 'No update fields were supplied.');
  const setters = entries.map(([, column], index) => `${column}=$${index + 1}`);
  const values = entries.map(([field]) => body[field]);
  const result = await query(`UPDATE ${table} SET ${setters.join(',')} WHERE ${key}=$${values.length + 1} AND gym_id=$${values.length+2} RETURNING *`, [...values,id,gymId]);
  if (!result.rowCount) throw new HttpError(404, 'Record not found.');
  return result.rows[0];
}

export async function deleteResource(resource: Resource, id: number, gymId: number): Promise<void> {
  const { table, key } = definitions[resource];
  const result = await query(`DELETE FROM ${table} WHERE ${key}=$1 AND gym_id=$2`, [id,gymId]);
  if (!result.rowCount) throw new HttpError(404, 'Record not found.');
}
