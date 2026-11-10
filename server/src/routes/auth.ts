import { Router } from 'express';
import { login, logout, me } from '../controllers/auth';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema } from '../validators';

export const authRoutes = Router();
authRoutes.post('/login', validateBody(loginSchema), login);
authRoutes.post('/logout', logout);
authRoutes.get('/me', authenticate, me);
