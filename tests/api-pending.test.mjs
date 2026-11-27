import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/index.mjs';
import { pool } from '../server/db.mjs';
import { connect, cleanupFixtures, mkGroup, ARRIVAL_DAY, localTs } from './helpers.mjs';

// Home's "Upcoming ride" must reflect unfinished business: a found group, then a held seat, then a booking.
let server, base, c, fixture;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  c = await connect();
  await cleanupFixtures(c);
  await c.query('begin');
  fixture = await mkGroup(c, { pref: 'girls_only', members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'al-husn' }] });
  await c.query('commit');
});
after(async () => {
  await new Promise((r) => server.close(r));
  try {
    await cleanupFixtures(c);
    await c.end();
  } finally {
    await pool.end();
  }
});

const post = (path, body = {}, token) =>
  fetch(`${base}/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(process.env.JUNI_REHEARSAL_PIN ? { 'x-rehearsal-key': process.env.JUNI_REHEARSAL_PIN } : {}) },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

test('pending: nothing -> group found -> seat held -> booked', async () => {
  const claim = await post('demo/claim', { gender: 'female', fullName: 'zz-test Pending' });
  const token = claim.data.token;

  const none = await post('pending', {}, token);
  assert.equal(none.ok, true, JSON.stringify(none));
  assert.equal(none.data.hold, null);
  assert.equal(none.data.plan, null);

  const classStart = new Date(new Date(localTs(ARRIVAL_DAY, '07:50')).getTime() + 10 * 60000).toISOString();
  const req = await post('create-request', { campusId: 'just', pickupAreaId: 'hawara', classStartAt: classStart }, token);
  const found = await post('search-groups', { requestId: req.data.request_id, pref: 'girls_only' }, token);
  assert.equal(found.data.candidates.length, 1);

  const planned = await post('pending', {}, token);
  assert.equal(planned.data.hold, null);
  assert.equal(planned.data.plan?.request_id, req.data.request_id);
  assert.equal(planned.data.plan.pickup_name, 'Hawara');

  const cand = found.data.candidates[0];
  const co = await post('start-checkout', {
    groupId: cand.group_id, pickupAreaId: 'hawara', routeVersion: cand.route_version, idempotencyKey: randomUUID(),
  }, token);
  assert.equal(co.ok, true, JSON.stringify(co));

  const held = await post('pending', {}, token);
  assert.equal(held.data.hold?.hold_id, co.data.hold_id);
  assert.equal(held.data.hold.fare_fils, cand.fare_fils);
  assert.equal(held.data.hold.request_id, req.data.request_id);
  assert.ok(new Date(held.data.hold.expires_at) > new Date(held.data.app_now));

  const paid = await post('pay', { holdId: co.data.hold_id, outcome: 'success', idempotencyKey: randomUUID() }, token);
  assert.equal(paid.ok, true, JSON.stringify(paid));

  const done = await post('pending', {}, token);
  assert.equal(done.data.hold, null, 'a paid hold is no longer pending');
  assert.equal(done.data.plan, null, 'a booked ride is no longer a draft plan');
});

test('pending requires a session', async () => {
  const res = await post('pending', {});
  assert.equal(res.status, 401);
});
