import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/index.mjs';
import { pool } from '../server/db.mjs';
import { connect, one, cleanupFixtures, mkGroup, ARRIVAL_DAY, localTs } from './helpers.mjs';

// Builds its own committed fixture group (removed afterwards) so the seed is never touched, then drives it over HTTP.
let server, base, token, c, fixture;
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

const post = (path, body = {}, t = token) =>
  fetch(`${base}/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

test('plan -> search -> checkout -> double-tap pay -> booking, over HTTP', async (t) => {
  const seeded = { at_: localTs(ARRIVAL_DAY, '07:50') };
  const claim = await post('demo/claim', { gender: 'female', fullName: 'zz-test Flow' }, null);
  token = claim.data.token;
  const classStart = new Date(new Date(seeded.at_).getTime() + 10 * 60000).toISOString();
  const req = await post('create-request', { campusId: 'just', pickupAreaId: 'hawara', classStartAt: classStart });
  assert.equal(req.ok, true, JSON.stringify(req));
  const dep = await post('recommend-departure', { requestId: req.data.request_id });
  assert.equal(dep.data.travel_source, 'model');
  const found = await post('search-groups', { requestId: req.data.request_id, pref: 'girls_only' });
  assert.equal(found.data.candidates.length, 1);
  const cand = found.data.candidates[0];
  const detail = await post('group-detail', { groupId: cand.group_id, requestId: req.data.request_id });
  assert.equal(detail.data.fare_fils, cand.fare_fils);

  const key = randomUUID();
  const co = await post('start-checkout', { groupId: cand.group_id, pickupAreaId: 'hawara', routeVersion: cand.route_version, idempotencyKey: key });
  assert.equal(co.ok, true, JSON.stringify(co));
  assert.equal(co.data.fare_fils, cand.fare_fils);
  const co2 = await post('start-checkout', { groupId: cand.group_id, pickupAreaId: 'hawara', routeVersion: cand.route_version, idempotencyKey: key });
  assert.equal(co2.data.hold_id, co.data.hold_id);

  const payKey = randomUUID();
  const [p1, p2] = await Promise.all([
    post('pay', { holdId: co.data.hold_id, outcome: 'success', idempotencyKey: payKey }),
    post('pay', { holdId: co.data.hold_id, outcome: 'success', idempotencyKey: payKey }),
  ].map((p) => p.catch((e) => ({ ok: false, code: e.message }))));
  const wins = [p1, p2].filter((p) => p.ok);
  assert.ok(wins.length >= 1, JSON.stringify([p1, p2]));
  assert.equal((await one(c, 'select count(*)::int n from bookings where hold_id=$1', [co.data.hold_id])).n, 1);

  const bookingId = wins[0].data.booking_id;
  const b = await post('booking', { bookingId });
  assert.equal(b.data.status, 'awaiting_captain');
  assert.equal(b.data.seats_taken, 4);
  assert.equal(b.data.fare_fils, cand.fare_fils);
  const sum = (await one(c, `select sum(fare_fils)::int s from bookings where group_id=$1 and status <> 'cancelled'`, [cand.group_id])).s;
  assert.equal(sum, 6000);
});

test('a failed payment books nothing and releases the hold', async (t) => {
  if (!token) return t.skip('no session');
  const seeded = await one(c, 'select id, route_version from groups where id=$1', [fixture.groupId]);
  const again = await one(c, 'select core.seats_booked($1::uuid) n', [seeded.id]);
  if (again.n >= 4) {
    await c.query(`delete from refunds where booking_id in (select id from bookings where group_id=$1)`, [seeded.id]);
    await c.query(`delete from payments where booking_id in (select id from bookings where group_id=$1)`, [seeded.id]);
    await c.query(`delete from bookings where rider_id in (select id from profiles where full_name='zz-test Flow')`);
    await c.query(`update groups set status='open', captain_id=null where id=$1`, [seeded.id]);
  }
  const co = await post('start-checkout', { groupId: seeded.id, pickupAreaId: 'hawara', routeVersion: seeded.route_version, idempotencyKey: randomUUID() });
  assert.equal(co.ok, true, JSON.stringify(co));
  const pr = await post('pay', { holdId: co.data.hold_id, outcome: 'failed', idempotencyKey: randomUUID() });
  assert.equal(pr.data.outcome, 'failed');
  assert.equal((await one(c, 'select count(*)::int n from bookings where hold_id=$1', [co.data.hold_id])).n, 0);
  assert.ok((await one(c, 'select released_at from seat_holds where id=$1', [co.data.hold_id])).released_at);
});
