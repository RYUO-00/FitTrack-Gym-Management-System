import { Router } from 'express';
import * as gyms from '../controllers/gyms';
import { requireBranch } from '../middleware/branch';
import * as plans from '../controllers/plans';
import * as catalog from '../controllers/catalog';
import * as subscriptions from '../controllers/subscriptions';
import * as payments from '../controllers/payments';
import * as attendance from '../controllers/attendance';
import { dashboard } from '../controllers/dashboard';
import { reports } from '../controllers/reports';
import { validateBody } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { memberSchema, trainerSchema, gymSchema, planSchema, subscriptionSchema, renewalSchema, paymentSchema, paymentStatusSchema, attendanceSchema } from '../validators';

export const apiRoutes = Router();
apiRoutes.use(authenticate);
apiRoutes.get('/gyms', gyms.list);
apiRoutes.post('/gyms', validateBody(gymSchema), gyms.create);
apiRoutes.get('/gyms/:id', gyms.getOne);
apiRoutes.put('/gyms/:id', validateBody(gymSchema), gyms.update);
apiRoutes.delete('/gyms/:id', gyms.remove);

apiRoutes.use(requireBranch);
apiRoutes.get('/dashboard', dashboard);

apiRoutes.get('/members', catalog.list('members'));
apiRoutes.post('/members', validateBody(memberSchema), catalog.create('members'));
apiRoutes.get('/members/:id/history', catalog.memberHistory);
apiRoutes.get('/members/:id', catalog.getOne('members'));
apiRoutes.put('/members/:id', validateBody(memberSchema), catalog.update('members'));
apiRoutes.delete('/members/:id', catalog.remove('members'));

apiRoutes.get('/trainers', catalog.list('trainers'));
apiRoutes.post('/trainers', validateBody(trainerSchema), catalog.create('trainers'));
apiRoutes.get('/trainers/:id', catalog.getOne('trainers'));
apiRoutes.put('/trainers/:id', validateBody(trainerSchema), catalog.update('trainers'));
apiRoutes.delete('/trainers/:id', catalog.remove('trainers'));

apiRoutes.get('/plans', plans.list);
apiRoutes.post('/plans', validateBody(planSchema), plans.create);
apiRoutes.get('/plans/:gymId/:planNo', plans.getOne);
apiRoutes.put('/plans/:gymId/:planNo', validateBody(planSchema), plans.update);
apiRoutes.delete('/plans/:gymId/:planNo', plans.remove);

apiRoutes.get('/subscriptions', subscriptions.list);
apiRoutes.post('/subscriptions', validateBody(subscriptionSchema), subscriptions.create);
apiRoutes.get('/subscriptions/:id', subscriptions.getOne);
apiRoutes.post('/subscriptions/:id/renew', validateBody(renewalSchema), subscriptions.renew);
apiRoutes.post('/subscriptions/:id/cancel', subscriptions.cancel);

apiRoutes.get('/payments', payments.list);
apiRoutes.post('/payments', validateBody(paymentSchema), payments.create);
apiRoutes.patch('/payments/:id/status', validateBody(paymentStatusSchema), payments.updateStatus);

apiRoutes.get('/attendance', attendance.list);
apiRoutes.post('/attendance', validateBody(attendanceSchema), attendance.checkIn);
apiRoutes.patch('/attendance/:id/checkout', attendance.checkOut);

apiRoutes.get('/reports', reports);
