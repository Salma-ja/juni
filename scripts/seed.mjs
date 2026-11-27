import '../server/env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { ROOT } from '../server/env.mjs';

const ifEmpty = process.argv.includes('--if-empty');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  if (ifEmpty) {
    const { rows } = await client.query('select count(*)::int as n from profiles where is_seed');
    if (rows[0].n > 0) {
      console.log('seed data present, skipping (--if-empty)');
      process.exit(0);
    }
  }
  const sql = fs.readFileSync(path.join(ROOT, 'db', 'seed.sql'), 'utf8');
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    console.error(`seed failed: ${err.message}`);
    process.exit(1);
  }
  const counts = await client.query(`
    select 'profiles(is_seed)' as t, count(*)::int as n from profiles where is_seed
    union all select 'campuses', count(*)::int from campuses
    union all select 'pickup_areas', count(*)::int from pickup_areas
    union all select 'captains', count(*)::int from captains
    union all select 'vehicles', count(*)::int from vehicles
    union all select 'groups', count(*)::int from groups
    union all select 'bookings', count(*)::int from bookings`);
  for (const r of counts.rows) console.log(`${r.t} = ${r.n}`);
} finally {
  await client.end();
}
