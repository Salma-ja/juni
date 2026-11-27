import '../server/env.mjs';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query('show server_version');
console.log(`db ok ${rows[0].server_version}`);
await client.end();
