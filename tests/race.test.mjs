import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connect, one, q, mkGroup, mkProfile, group, NOW, cleanupFixtures } from './helpers.mjs';

let c;
before(async () => { c = await connect(); await cleanupFixtures(c); });
after(async () => { await cleanupFixtures(c); await c.end(); });

test('T12: two connections race for the last seat of a 3/4 group; exactly one hold, the other GROUP_FULL', async () => {
  let groupId, a, b;
  try {
    await c.query('begin');
    const g = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'hawara' }] });
    groupId = g.groupId;
    a = await mkProfile(c); b = await mkProfile(c);
    await c.query('commit');
    const rv = (await group(c, groupId)).route_version;

    const c1 = await connect(), c2 = await connect();
    const run = async (conn, profile) => {
      try {
        await conn.query('begin');
        const r = await conn.query('select core.start_checkout($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::timestamptz) as r',
          [profile, groupId, 'hawara', rv, randomUUID(), NOW]);
        await conn.query('commit');
        return { ok: true, hold: r.rows[0].r.hold_id };
      } catch (e) {
        await conn.query('rollback');
        return { ok: false, code: e.message };
      }
    };
    const results = await Promise.all([run(c1, a), run(c2, b)]);
    await c1.end(); await c2.end();
    assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results));
    assert.equal(results.find((r) => !r.ok).code, 'GROUP_FULL');
    assert.equal((await q(c, 'select 1 from seat_holds where group_id=$1 and released_at is null', [groupId])).length, 1);
  } finally {
    await cleanupFixtures(c);
  }
});
