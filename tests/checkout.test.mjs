import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  connect, one, q, expectFail, mkProfile, mkGroup, joinGroup, checkout, payHold, group, NOW,
  cleanupFixtures, makeRequest,
} from './helpers.mjs';

let c;
before(async () => { c = await connect(); await cleanupFixtures(c); });
after(async () => { await cleanupFixtures(c); await c.end(); });
beforeEach(() => c.query('begin'));
afterEach(() => c.query('rollback'));

const CO = 'select core.start_checkout($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::timestamptz)';
const args = (p, g, area, rv, now = NOW) => [p, g, area, rv, randomUUID(), now];

test('T01: GROUP_FULL on a 4/4 group and on a 3/3 group (veh-5)', async () => {
  const g4 = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'al-husn' }, { area: 'hawara' }] });
  const late = await mkProfile(c);
  await expectFail(c, 'GROUP_FULL', CO, args(late, g4.groupId, 'hawara', (await group(c, g4.groupId)).route_version));

  const g3 = await mkGroup(c, { time: '08:50', members: [{ area: 'hawara' }, { area: 'hawara' }] });
  await c.query(`update groups set capacity = 3, vehicle_id = 'veh-5', captain_id = 'cap-5' where id = $1`, [g3.groupId]);
  await joinGroup(c, g3.groupId, { area: 'hawara' });
  assert.equal((await group(c, g3.groupId)).status, 'awaiting_captain');
  await expectFail(c, 'GROUP_FULL', CO, args(late, g3.groupId, 'hawara', (await group(c, g3.groupId)).route_version));
});

test('T02: NOT_VERIFIED', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
  const p = await mkProfile(c, { verified: false });
  await expectFail(c, 'NOT_VERIFIED', CO, args(p, g.groupId, 'hawara', 1));
});

test('T03: PREF_MISMATCH for a male rider in a girls_only group', async () => {
  const g = await mkGroup(c, { pref: 'girls_only', members: [{ area: 'hawara', gender: 'female' }] });
  assert.equal((await group(c, g.groupId)).pref, 'girls_only');
  const p = await mkProfile(c, { gender: 'male' });
  await expectFail(c, 'PREF_MISMATCH', CO, args(p, g.groupId, 'hawara', 1));
});

test('T07: FARE_OVER_CAP when frozen fares are 5900 on a 2/4 group', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }] });
  const ids = (await q(c, 'select id from bookings where group_id=$1 order by created_at', [g.groupId])).map((r) => r.id);
  await c.query('update bookings set fare_fils = 3000 where id = $1', [ids[0]]);
  await c.query('update bookings set fare_fils = 2900 where id = $1', [ids[1]]);
  const p = await mkProfile(c);
  await expectFail(c, 'FARE_OVER_CAP', CO, args(p, g.groupId, 'hawara', (await group(c, g.groupId)).route_version));
});

test('validation order: ALREADY_BOOKED, QUOTE_STALE, GROUP_NOT_OPEN', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara', gender: 'female' }] });
  const rv = (await group(c, g.groupId)).route_version;
  // ALREADY_BOOKED: the creator tries again
  await expectFail(c, 'ALREADY_BOOKED', CO, args(g.members[0].profile, g.groupId, 'hawara', rv));
  const p = await mkProfile(c);
  await expectFail(c, 'QUOTE_STALE', CO, args(p, g.groupId, 'hawara', rv + 5));
  await c.query(`update groups set status = 'confirmed' where id = $1`, [g.groupId]);
  await expectFail(c, 'GROUP_NOT_OPEN', CO, args(p, g.groupId, 'hawara', rv));
});

test('checkout is idempotent and holds a seat for 5 minutes', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
  const p = await mkProfile(c);
  const key = randomUUID();
  const rv = (await group(c, g.groupId)).route_version;
  const a = (await one(c, CO + ' as r', [p, g.groupId, 'hawara', rv, key, NOW])).r;
  const b = (await one(c, CO + ' as r', [p, g.groupId, 'hawara', rv, key, NOW])).r;
  assert.deepEqual(a, b);
  assert.equal((await q(c, 'select 1 from seat_holds where rider_id=$1', [p])).length, 1);
  assert.equal(new Date(a.expires_at).getTime() - new Date(NOW).getTime(), 5 * 60000);
  assert.equal(a.inside_12h, false);
});

test('inside_12h is reported when pickup is within 12 hours', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
  const dep = new Date((await group(c, g.groupId)).departure_at).getTime();
  const p = await mkProfile(c);
  const h = (await one(c, CO + ' as r', [p, g.groupId, 'hawara', 1, randomUUID(), new Date(dep - 6 * 3600000).toISOString()])).r;
  assert.equal(h.inside_12h, true);
});

test('T12 (single connection): second checkout on a 3/4 group sees the first hold', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'hawara' }] });
  const a = await mkProfile(c), b = await mkProfile(c);
  const rv = (await group(c, g.groupId)).route_version;
  await one(c, CO + ' as r', args(a, g.groupId, 'hawara', rv));
  await expectFail(c, 'GROUP_FULL', CO, args(b, g.groupId, 'hawara', rv));
});

test('create_request rejects a pickup less than 60 minutes away (TOO_SOON)', async () => {
  const p = await mkProfile(c);
  // departure for Hawara -> JUST at 07:50 is 06:45 local on the arrival day; p_now = 07:00 local is 28 min before
  await expectFail(c, 'TOO_SOON', `select core.create_request($1::uuid,'just','hawara',$2::timestamptz,null,$3::timestamptz)`,
    [p, '2027-02-03T05:00:00Z', '2027-02-03T04:00:00Z']);
});
