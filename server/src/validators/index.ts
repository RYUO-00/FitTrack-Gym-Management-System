import { z } from 'zod';

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const id = z.coerce.number().int().positive();
const phone = z.string().trim().min(7).max(30);
export const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0,10) === value;
};
const isoDate = z.string().refine(isIsoDate,'Use a valid YYYY-MM-DD date.');

export const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
export const memberSchema = z.object({
  memberName: z.string().trim().min(2).max(120), email, phone,
  joinDate: isoDate.optional(),
});
export const trainerSchema = z.object({
  trainerName: z.string().trim().min(2).max(120), email, phone,
  specialization: z.string().trim().min(2).max(100),
});
export const gymSchema = z.object({
  branchName: z.string().trim().min(2).max(120), address: z.string().trim().min(1).max(500),
  city: z.string().trim().min(2).max(100), contactNumber: phone, email, status: z.enum(['ACTIVE','INACTIVE']).default('ACTIVE'),
});
export const planSchema = z.object({
  gymId: id, planNo: id, planName: z.string().trim().min(2).max(80), durationMonths: z.coerce.number().int().min(1).max(60),
  price: z.coerce.number().positive().max(10000000), description: z.string().trim().max(500).default(''),
  isActive: z.boolean().default(true),
});
export const subscriptionSchema = z.object({ memberId: id, gymId: id, planNo: id, trainerId: id.nullable().optional(), startDate: isoDate, amount: z.coerce.number().positive().optional(), paymentMethod: z.enum(['CASH','UPI','CARD','BANK_TRANSFER']).optional() });
export const renewalSchema = z.object({ gymId: id, planNo: id, trainerId: id.nullable().optional(), startDate: isoDate.optional(), amount: z.coerce.number().positive().optional(), paymentMethod: z.enum(['CASH','UPI','CARD','BANK_TRANSFER']).optional() });
export const paymentSchema = z.object({ subscriptionId: id, amount: z.coerce.number().positive(), paymentDate: z.string().datetime().optional(), paymentMethod: z.enum(['CASH','UPI','CARD','BANK_TRANSFER']), paymentStatus: z.enum(['PAID','PENDING','FAILED','REFUNDED']) });
export const paymentStatusSchema = z.object({ paymentStatus: z.enum(['PAID','PENDING','FAILED','REFUNDED']) });
export const attendanceSchema = z.object({ subscriptionId: id });
export const dateRangeSchema = z.object({ from: isoDate.optional(), to: isoDate.optional() });

export function parseId(value: string | string[]): number {
  const normalized = Array.isArray(value) ? value.length === 1 ? value[0] : undefined : value;
  const parsed = id.safeParse(normalized);
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}
