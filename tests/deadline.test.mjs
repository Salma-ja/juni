import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { connect, one, q, mkGroup, joinGroup, group, NOW, cleanupFixtures } from './helpers.mjs';

let c;
before(async () => { c = await connect(); await cleanupFixtures(c); });
after(async () => { await cleanupFixtures(c); await c.end(); });
beforeEach(() => c.query('begin'));
afterEach(() => c.query('rollback'));

const DL = 'select core.enforce_deadline($1::uuid,$2::timestamptz) as r';
const minus = (ts, hours) => new Date(new Date(ts).getTime() - hours * 3600000).toISOString();

test('X5: a 2/4 group with 2800 collected is cancelled below_floor with two full refunds at first_pickup - 2h', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }] });
  const ids = (await q(c, 'select id from bookings where group_id=$1 order by created_at', [g.groupId])).map((r) => r.id);
  await c.query('update bookings set fare_fils = 1400 where id = any($1::uuid[])', [ids]);
  const row = await group(c, g.groupId);
  // one minute earlier does nothing
  assert.equal((await one(c, DL, [g.groupId, minus(row.departure_at, 2.02)])).r, 'none');
  assert.equal((await one(c, DL, [g.groupId, minus(row.departure_at, 2)])).r, 'cancelled_below_floor');
  assert.equal((await group(c, g.groupId)).status, 'cancelled');
  const refunds = await q(c, `select r.amount_fils, r.reason from refunds r join bookings b on b.id = r.booking_id where b.group_id=$1`, [g.groupId]);
  assert.deepEqual(refunds, [{ amount_fils: 1400, reason: 'below_floor' }, { amount_fils: 1400, reason: 'below_floor' }]);
  assert.equal((await q(c, `select 1 from bookings where group_id=$1 and status='cancelled' and cancelled_by='platform'`, [g.groupId])).length, 2);
  assert.equal((await q(c, `select 1 from incidents where group_id=$1 and kind='below_floor'`, [g.groupId])).length, 1);
});

test('at the deadline a group over the floor dispatches with the riders it has (auto-confirmed)', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'al-husn' }] });
  assert.ok((await one(c, 'select core.collected_fils($1::uuid) n', [g.groupId])).n >= 3750);
  const row = await group(c, g.groupId);
  assert.equal((await one(c, DL, [g.groupId, minus(row.departure_at, 1.5)])).r, 'confirmed');
  const after = await group(c, g.groupId);
  assert.equal(after.status, 'confirmed');
  assert.ok(after.captain_id && after.captain_confirmed_at);
});

test('at the deadline a group with no eligible captain is cancelled (no_captain) with full refunds', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'al-husn' }] });
  await c.query(`update captains set active = false`);
  const row = await group(c, g.groupId);
  assert.equal((await one(c, DL, [g.groupId, minus(row.departure_at, 1.5)])).r, 'cancelled_no_captain');
  const refunds = await q(c, `select distinct r.reason from refunds r join bookings b on b.id = r.booking_id where b.group_id=$1`, [g.groupId]);
  assert.deepEqual(refunds, [{ reason: 'no_captain' }]);
});

test('reading a group lazily enforces the deadline (booking_detail)', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
  const row = await group(c, g.groupId);
  const mine = g.members[0];
  const d = (await one(c, 'select core.booking_detail($1::uuid,$2::uuid,$3::timestamptz) as r',
    [mine.profile, mine.pay.booking_id, minus(row.departure_at, 1)])).r;
  assert.equal(d.status, 'cancelled');
  assert.equal(d.refund.reason, 'below_floor');
  assert.equal(d.refund.amount_fils, d.fare_fils);
});
