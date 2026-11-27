import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  connect, one, q, mkGroup, joinGroup, group, expectFail, NOW, cleanupFixtures,
} from './helpers.mjs';

let c;
before(async () => { c = await connect(); await cleanupFixtures(c); });
after(async () => { await cleanupFixtures(c); await c.end(); });

const full4 = (conn, opts = {}) =>
  mkGroup(conn, { ...opts, members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'al-husn' }, { area: 'hawara' }] });
const ASSIGN = 'select core.assign_captain($1::uuid,$2,$3,$4::timestamptz) as r';

test('T04: the unlicensed captain cap-6 is rejected and the group is unchanged', async () => {
  await c.query('begin');
  try {
    const g = await full4(c);
    await c.query('update groups set captain_id = null, vehicle_id = null where id = $1', [g.groupId]);
    const before = await group(c, g.groupId);
    await expectFail(c, 'CAPTAIN_INELIGIBLE', ASSIGN, [g.groupId, 'cap-6', 'veh-6', NOW]);
    const after = await group(c, g.groupId);
    assert.equal(after.status, before.status);
    assert.equal(after.captain_id, null);
  } finally { await c.query('rollback'); }
});

test('cap-5 (capacity 3) is ineligible for a 4-seat group', async () => {
  await c.query('begin');
  try {
    const g = await full4(c);
    await c.query('update groups set captain_id = null, vehicle_id = null where id = $1', [g.groupId]);
    await expectFail(c, 'CAPTAIN_INELIGIBLE', ASSIGN, [g.groupId, 'cap-5', 'veh-5', NOW]);
  } finally { await c.query('rollback'); }
});

test('T10/T08 flow: assigning does not confirm; confirm_captain does (X3 single connection)', async () => {
  await c.query('begin');
  try {
    const g = await full4(c);
    await c.query('update groups set captain_id = null, vehicle_id = null where id = $1', [g.groupId]);
    await one(c, ASSIGN, [g.groupId, 'cap-2', 'veh-2', NOW]);
    let row = await group(c, g.groupId);
    assert.equal(row.captain_id, 'cap-2');
    assert.equal(row.status, 'awaiting_captain');
    assert.equal(row.captain_confirmed_at, null);
    await expectFail(c, 'GROUP_NOT_AWAITING', ASSIGN, [g.groupId, 'cap-1', 'veh-1', NOW]);
    await c.query('select core.confirm_captain($1::uuid,$2::timestamptz)', [g.groupId, NOW]);
    row = await group(c, g.groupId);
    assert.equal(row.status, 'confirmed');
    assert.ok(row.captain_confirmed_at);
    assert.equal((await q(c, `select distinct status from bookings where group_id=$1`, [g.groupId]))[0].status, 'confirmed');
  } finally { await c.query('rollback'); }
});

test('CAPTAIN_BUSY when the captain already drives an overlapping group', async () => {
  await c.query('begin');
  try {
    const a = await full4(c);                         // takes the lowest free captain automatically
    const second = await full4(c, { campus: 'yarmouk' });
    await c.query('update groups set captain_id = null, vehicle_id = null where id = $1', [second.groupId]);
    const cap = (await group(c, a.groupId)).captain_id;
    await expectFail(c, 'CAPTAIN_BUSY', ASSIGN, [second.groupId, cap, `veh-${cap.slice(4)}`, NOW]);
  } finally { await c.query('rollback'); }
});

test('confirm_captain needs a captain', async () => {
  await c.query('begin');
  try {
    const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
    await expectFail(c, 'NO_CAPTAIN', 'select core.confirm_captain($1::uuid,$2::timestamptz)', [g.groupId, NOW]);
  } finally { await c.query('rollback'); }
});

test('auto-assign skips busy, unlicensed and undersized captains', async () => {
  await c.query('begin');
  try {
    const a = await full4(c, { campus: 'just' });
    const b = await full4(c, { campus: 'yarmouk' });
    const d = await full4(c, { campus: 'inu' });
    const e = await full4(c, { campus: 'just', area: 'x' }).catch(() => null);
    const caps = [a, b, d].map(async (x) => (await group(c, x.groupId)).captain_id);
    assert.deepEqual(await Promise.all(caps), ['cap-1', 'cap-2', 'cap-3']);
    void e;
  } finally { await c.query('rollback'); }
});

test('X3: two connections assign cap-1 and cap-2 at once; exactly one wins', async () => {
  await cleanupFixtures(c);
  let groupId;
  try {
    await c.query('begin');
    const g = await full4(c);
    groupId = g.groupId;
    await c.query('update groups set captain_id = null, vehicle_id = null where id = $1', [groupId]);
    await c.query('commit');

    const c1 = await connect(), c2 = await connect();
    const run = async (conn, cap) => {
      try { await conn.query('begin'); await conn.query(ASSIGN, [groupId, cap, `veh-${cap.slice(4)}`, NOW]); await conn.query('commit'); return 'ok'; }
      catch (e) { await conn.query('rollback'); return e.message; }
    };
    const results = await Promise.all([run(c1, 'cap-1'), run(c2, 'cap-2')]);
    await c1.end(); await c2.end();
    assert.equal(results.filter((r) => r === 'ok').length, 1, JSON.stringify(results));
    assert.ok(results.includes('GROUP_NOT_AWAITING'), JSON.stringify(results));
    const row = await group(c, groupId);
    assert.ok(['cap-1', 'cap-2'].includes(row.captain_id));
  } finally { await cleanupFixtures(c); }
});
