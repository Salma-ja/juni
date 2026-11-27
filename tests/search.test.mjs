import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { connect, one, q, mkProfile, makeRequest, mkGroup, joinGroup, group, NOW, cleanupFixtures } from './helpers.mjs';

let c;
before(async () => { c = await connect(); await cleanupFixtures(c); });
after(async () => { await cleanupFixtures(c); await c.end(); });
beforeEach(() => c.query('begin'));
afterEach(() => c.query('rollback'));

const SEARCH = 'select core.search_groups($1::uuid,$2::uuid,$3::group_pref,$4::timestamptz) as r';

test('empty results explain themselves: NO_GROUPS_AT_TIME, PREF_NONE, NO_SEATS', async () => {
  const omar = await mkProfile(c, { gender: 'male' });
  const noon = await makeRequest(c, omar, { area: 'ramtha', time: '12:00' });
  assert.equal((await one(c, SEARCH, [omar, noon.request_id, null, NOW])).r.reason, 'NO_GROUPS_AT_TIME');
  assert.equal((await one(c, 'select status from ride_requests where id=$1', [noon.request_id])).status, 'unmatched');

  await mkGroup(c, { pref: 'girls_only', members: [{ area: 'hawara', gender: 'female' }] });
  const req = await makeRequest(c, omar, { area: 'ramtha' });
  assert.equal((await one(c, SEARCH, [omar, req.request_id, 'girls_only', NOW])).r.reason, 'PREF_NONE');

  const full = await mkGroup(c, { time: '09:50', pref: 'any', members: Array(4).fill({ area: 'hawara' }) });
  const req2 = await makeRequest(c, omar, { area: 'ramtha', time: '09:50' });
  assert.equal((await one(c, SEARCH, [omar, req2.request_id, 'any', NOW])).r.reason, 'NO_SEATS');
  void full;
});

test('a girls-only 3/4 group is the first match for a female rider, with the last-seat fare', async () => {
  const g = await mkGroup(c, { pref: 'girls_only', members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'al-husn' }] });
  await mkGroup(c, { pref: 'boys_only', members: [{ area: 'ramtha', gender: 'male' }] });
  const salma = await mkProfile(c, { gender: 'female' });
  const req = await makeRequest(c, salma, { area: 'hawara' });
  const res = (await one(c, SEARCH, [salma, req.request_id, null, NOW])).r;
  assert.equal(res.reason, null);
  assert.equal(res.candidates.length, 1);
  const cand = res.candidates[0];
  assert.equal(cand.group_id, g.groupId);
  assert.equal(cand.seats_taken, 3);
  const frozen = (await one(c, 'select sum(fare_fils)::int s from bookings where group_id=$1', [g.groupId])).s;
  assert.equal(cand.fare_fils, 6000 - frozen);
  assert.deepEqual(cand.members.map((m) => m.first_name).length, 3);
  assert.equal((await one(c, 'select status from ride_requests where id=$1', [req.request_id])).status, 'matched');
});

test('a male rider never sees a girls-only group, and Any lists every group he is eligible for', async () => {
  await mkGroup(c, { pref: 'girls_only', members: [{ area: 'hawara', gender: 'female' }] });
  const mixed = await mkGroup(c, { pref: 'any', members: [{ area: 'ramtha', gender: 'male' }] });
  const boys = await mkGroup(c, { time: '07:45', pref: 'boys_only', members: [{ area: 'ramtha', gender: 'male' }] });
  const omar = await mkProfile(c, { gender: 'male' });
  const req = await makeRequest(c, omar, { area: 'ramtha' });
  const any = (await one(c, SEARCH, [omar, req.request_id, 'any', NOW])).r;
  assert.deepEqual(any.candidates.map((x) => x.group_id).sort(), [mixed.groupId, boys.groupId].sort());
  const onlyBoys = (await one(c, SEARCH, [omar, req.request_id, 'boys_only', NOW])).r;
  assert.deepEqual(onlyBoys.candidates.map((x) => x.group_id), [boys.groupId]);
});

test('a rider with another booking within 3 hours is not offered a clashing group', async () => {
  const rider = await mkProfile(c, { gender: 'female' });
  const first = await mkGroup(c, { members: [{ area: 'hawara' }] });
  // book the first group as the rider
  const j = await joinGroup(c, first.groupId, { area: 'hawara' });
  const req = await makeRequest(c, j.profile, { area: 'hawara' });
  await mkGroup(c, { campus: 'just', time: '08:50', members: [{ area: 'hawara' }] });
  const r = (await one(c, SEARCH, [j.profile, req.request_id, 'any', NOW])).r;
  assert.equal(r.candidates.length, 0);
  assert.equal(r.reason, 'BOOKING_OVERLAP');
  void rider;
});

test('create_group starts an open group with the rider preference and one stop, without booking', async () => {
  const salma = await mkProfile(c, { gender: 'female' });
  const req = await makeRequest(c, salma, { area: 'jerash', time: '09:50', pref: 'girls_only' });
  const cand = (await one(c, 'select core.create_group($1::uuid,$2::uuid,$3::timestamptz) as r', [salma, req.request_id, NOW])).r;
  const g = await group(c, cand.group_id);
  assert.equal(g.pref, 'girls_only');
  assert.equal(g.status, 'open');
  assert.equal(g.group_fare_fils, 6000);
  assert.equal((await q(c, 'select 1 from group_stops where group_id=$1', [g.id])).length, 1);
  assert.equal((await q(c, 'select 1 from bookings where group_id=$1', [g.id])).length, 0);
  assert.equal(cand.seats_taken, 0);
  const male = await mkProfile(c, { gender: 'male' });
  const req2 = await makeRequest(c, male, { area: 'ramtha', time: '10:50', pref: 'girls_only' });
  const cand2 = (await one(c, 'select core.create_group($1::uuid,$2::uuid,$3::timestamptz) as r', [male, req2.request_id, NOW])).r;
  assert.equal((await group(c, cand2.group_id)).pref, 'any');
});

test('group_detail hides groups the rider cannot join and groups at another campus', async () => {
  const g = await mkGroup(c, { pref: 'girls_only', members: [{ area: 'hawara', gender: 'female' }] });
  const omar = await mkProfile(c, { gender: 'male' });
  const req = await makeRequest(c, omar, { area: 'ramtha' });
  const detail = 'select core.group_detail($1::uuid,$2::uuid,$3::uuid,$4::timestamptz) as r';
  const { expectFail } = await import('./helpers.mjs');
  await expectFail(c, 'PREF_MISMATCH', detail, [omar, g.groupId, req.request_id, NOW]);
  const salma = await mkProfile(c, { gender: 'female' });
  const reqY = await makeRequest(c, salma, { area: 'hawara', campus: 'yarmouk' });
  await expectFail(c, 'GROUP_NOT_FOUND', detail, [salma, g.groupId, reqY.request_id, NOW]);
  const reqOk = await makeRequest(c, salma, { area: 'hawara' });
  const d = (await one(c, detail, [salma, g.groupId, reqOk.request_id, NOW])).r;
  assert.equal(d.group_id, g.groupId);
  assert.equal(d.members.length, 1);
});
