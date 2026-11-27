import '../server/env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { ROOT } from '../server/env.mjs';

const dir = path.join(ROOT, 'db', 'migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    `create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`,
  );
  const applied = new Set((await client.query('select name from schema_migrations')).rows.map((r) => r.name));
  let count = 0;
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations(name) values ($1)', [f]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      console.error(`FAILED ${f}: ${err.message}`);
      process.exitCode = 1;
      break;
    }
    console.log(`applied ${f}`);
    count++;
  }
  if (!process.exitCode) console.log(count ? `${count} migration(s) applied` : 'nothing to apply');
} finally {
  await client.end();
}
