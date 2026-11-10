import { Pool, types, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../config/env';

// PostgreSQL DATE values are calendar dates, not instants. Keep them as
// YYYY-MM-DD strings so JSON serialization cannot shift them across time zones.
types.setTypeParser(types.builtins.DATE, (value) => value);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.pgSsl ? { rejectUnauthorized: false } : undefined,
  max: 12,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000,
});

export const query = <T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> =>
  pool.query<T>(text, values);

export async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
