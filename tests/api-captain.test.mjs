import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.mjs';
import { pool } from '../server/db.mjs';
import { connect, one, cleanupFixtures, mkGroup } from './helpers.mjs';

let server, base, c, fx;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  c = await connect();
  await cleanupFixtures(c);
  await c.query('begin');
  fx = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'al-husn' }, { area: 'hawara' }] });
  await c.query('commit');
});
after(async () => {
  await new Promise((r) => server.close(r));
  try {
    await c.query(`delete from profiles where captain_id is not null and is_demo`).catch(() => {});
    await cleanupFixtures(c); await c.end();
  } finally { await pool.end(); }
});

const post = (path, body = {}, t) =>
  fetch(`${base}/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}), ...(process.env.JUNI_REHEARSAL_PIN ? { 'x-rehearsal-key': process.env.JUNI_REHEARSAL_PIN } : {}) },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

test('a rider session cannot use captain endpoints', async () => {
  const rider = (await post('demo/claim', { gender: 'female', fullName: 'zz-test R' })).data.token;
  const r = await post('captain/trips', {}, rider);
  assert.equal(r.code, 'CAPTAIN_ONLY');
  assert.equal(r.status, 403);
});

test('captain accepts, starts, picks up every rider, completes and earns 80%', async () => {
  const claim = await post('demo/claim', { role: 'captain', captainId: (await one(c, 'select captain_id from groups where id=$1', [fx.groupId])).captain_id });
  assert.equal(claim.data.profile.role, 'captain');
  const t = claim.data.token;
  const trips = (await post('captain/trips', {}, t)).data;
  const trip = trips.find((x) => x.group_id === fx.groupId);
  assert.ok(trip, 'assigned trip is listed');
  assert.equal(trip.status, 'awaiting_captain');
  assert.equal(trip.stops.flatMap((s) => s.riders).length, 4);
  assert.equal(trip.payout_fils, Math.floor(trip.collected_fils * 0.8));

  assert.equal((await post('captain/start', { groupId: fx.groupId }, t)).code, 'GROUP_NOT_CONFIRMED');
  assert.equal((await post('captain/confirm', { groupId: fx.groupId }, t)).ok, true);
  assert.equal((await post('captain/start', { groupId: fx.groupId }, t)).ok, true);
  assert.equal((await post('captain/complete', { groupId: fx.groupId }, t)).code, 'PICKUPS_PENDING');
  const live = (await post('captain/trips', {}, t)).data.find((x) => x.group_id === fx.groupId);
  for (const s of live.stops) for (const rd of s.riders) {
    assert.equal((await post('captain/pickup', { groupId: fx.groupId, bookingId: rd.booking_id }, t)).ok, true);
  }
  assert.equal((await post('captain/complete', { groupId: fx.groupId }, t)).ok, true);
  assert.equal((await c.query('select status from groups where id=$1', [fx.groupId])).rows[0].status, 'completed');
  const earn = (await post('captain/earnings', {}, t)).data;
  assert.ok(earn.trips.some((x) => x.group_id === fx.groupId));
  assert.ok(earn.total_payout_fils >= trip.payout_fils);
});

test('a captain cannot touch a trip that is not theirs; decline hands the trip to another captain', async () => {
  await c.query('begin');
  const g2 = await mkGroup(c, { time: '09:50', members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'al-husn' }, { area: 'hawara' }] });
  await c.query('commit');
  const cap = (await one(c, 'select captain_id from groups where id=$1', [g2.groupId])).captain_id;
  const other = (await post('demo/claim', { role: 'captain', captainId: cap === 'cap-4' ? 'cap-3' : 'cap-4' })).data.token;
  assert.equal((await post('captain/confirm', { groupId: g2.groupId }, other)).code, 'NOT_YOUR_TRIP');
  const owner = (await post('demo/claim', { role: 'captain', captainId: cap })).data.token;
  const d = await post('captain/decline', { groupId: g2.groupId }, owner);
  assert.equal(d.ok, true);
  assert.notEqual(d.data.reassigned_to, cap);
  assert.equal((await post('captain/confirm', { groupId: g2.groupId }, owner)).code, 'NOT_YOUR_TRIP');
});
