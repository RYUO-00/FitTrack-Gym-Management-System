import { requireActiveBranch } from '../middleware/branch';
import { asyncHandler } from '../utils/async-handler';
import { toCamel } from '../utils/format';
import { parseId } from '../validators';
import { createResource, deleteResource, getResource, listResource, updateResource } from '../services/catalog';

type Resource = 'members' | 'trainers';
export const list = (resource: Resource) => asyncHandler(async (req, res) => {
  const result = await listResource(resource, new URLSearchParams(req.query as Record<string, string>),req.gymId!);
  res.json(toCamel(result));
});
export const getOne = (resource: Resource) => asyncHandler(async (req, res) => { res.json(toCamel(await getResource(resource, parseId(req.params.id),req.gymId!))); });
export const create = (resource: Resource) => asyncHandler(async (req, res) => { requireActiveBranch(req);res.status(201).json(toCamel(await createResource(resource, req.body,req.gymId!))); });
export const update = (resource: Resource) => asyncHandler(async (req, res) => { res.json(toCamel(await updateResource(resource, parseId(req.params.id), req.body,req.gymId!))); });
export const remove = (resource: Resource) => asyncHandler(async (req, res) => { await deleteResource(resource, parseId(req.params.id),req.gymId!); res.status(204).end(); });

export const memberHistory = asyncHandler(async (req, res) => {
  const memberId = parseId(req.params.id);
  const [member, subscriptions, payments] = await Promise.all([
    getResource('members', memberId,req.gymId!),
    import('../database/pool').then(({ query }) => query(
      `SELECT s.subscription_id,s.start_date,s.end_date,s.status,p.plan_name,p.duration_months,p.price,t.trainer_name,
        CASE WHEN s.status='CANCELLED' THEN 'CANCELLED' WHEN CURRENT_DATE<s.start_date THEN 'UPCOMING'
             WHEN CURRENT_DATE>s.end_date THEN 'EXPIRED' ELSE 'ACTIVE' END AS effective_status
       FROM subscriptions s JOIN membership_plans p ON p.gym_id=s.gym_id AND p.plan_no=s.plan_no
       LEFT JOIN trainers t ON t.trainer_id=s.trainer_id WHERE s.member_id=$1 AND s.gym_id=$2 ORDER BY s.start_date DESC`, [memberId,req.gymId!],
    )),
    import('../database/pool').then(({ query }) => query(
      `SELECT pay.payment_id,pay.amount,pay.payment_date,pay.payment_method,pay.payment_status,p.plan_name
       FROM payments pay JOIN subscriptions s ON s.subscription_id=pay.subscription_id
       JOIN membership_plans p ON p.gym_id=s.gym_id AND p.plan_no=s.plan_no WHERE s.member_id=$1 AND s.gym_id=$2 ORDER BY pay.payment_date DESC`, [memberId,req.gymId!],
    )),
  ]);
  res.json(toCamel({ member, subscriptions: subscriptions.rows, payments: payments.rows }));
});
