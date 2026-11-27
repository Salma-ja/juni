import './env.mjs';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

/** Run fn(client) inside one transaction. Rolls back on throw. */
export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    try {
      await client.query('rollback');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}
