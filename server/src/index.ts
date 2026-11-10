import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import { env } from './config/env';
import { pool } from './database/pool';
import { authRoutes } from './routes/auth';
import { apiRoutes } from './routes/api';
import { errorHandler, notFound } from './middleware/errors';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

if (env.nodeEnv === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.port, () => console.log(`FitTrack API listening on port ${env.port}`));
const shutdown = () => server.close(() => { void pool.end().finally(() => process.exit(0)); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
