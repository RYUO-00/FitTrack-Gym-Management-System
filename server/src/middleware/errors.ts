import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/errors';

export const notFound: RequestHandler = (_req, res) => { res.status(404).json({ error: 'Route not found.' }); };

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Please check the submitted information.', details: error.flatten().fieldErrors });
    return;
  }
  if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
  const dbError = error as { code?: string; constraint?: string; detail?: string; message?: string };
  if (dbError?.code === '23505') { res.status(409).json({ error: 'A record with one of these unique values already exists.' }); return; }
  if (dbError?.code === '23503' || dbError?.code === '23001') { res.status(409).json({ error: 'This record is linked to other records and cannot be changed that way.' }); return; }
  if (dbError?.code === '23514' || dbError?.code === '22023' || dbError?.code === '22004') {
    res.status(400).json({ error: dbError.message ?? 'The requested operation violates a database rule.' }); return;
  }
  console.error('Unhandled request error:', error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
