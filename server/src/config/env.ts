export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  pgSsl: process.env.PGSSL === 'true',
  cookieSecret: process.env.COOKIE_SECRET ?? '',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
};

if (!env.databaseUrl) throw new Error('DATABASE_URL must be configured. Copy .env.example to .env and set it.');
if (env.cookieSecret.length < 32) throw new Error('COOKIE_SECRET must contain at least 32 characters.');
