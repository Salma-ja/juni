import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/index.mjs';
import { pool } from '../server/db.mjs';
import { connect, one, q, cleanupFixtures, mkGroup, mkProfile } from './helpers.mjs';

let server, base, c, fixture;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  c = await connect();
  await cleanupFixtures(c);
  await c.query('begin');
  fixture = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'hawara' }] });
  await c.query('commit');
});
after(async () => {
  await new Promise((r) => server.close(r));
  try { await cleanupFixtures(c); await c.end(); } finally { await pool.end(); }
});

const post = (path, body = {}, t) =>
  fetch(`${base}/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}), ...(process.env.JUNI_REHEARSAL_PIN ? { 'x-rehearsal-key': process.env.JUNI_REHEARSAL_PIN } : {}) },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const claim = async (gender = 'female') => (await post('demo/claim', { gender, fullName: 'zz-test Demo' })).data.token;

test('every /api/demo/* endpoint answers DEMO_ONLY for a non-demo profile', async () => {
  const id = await mkProfile(c, { demo: false });
  await c.query(`update profiles set full_name = 'zz-test Real' where id = $1`, [id]);
  const { token } = await one(c, 'insert into sessions (profile_id) values ($1) returning token', [id]);
  for (const path of ['settings', 'set', 'confirm-captain', 'assign-captain', 'expire-hold', 'start-trip', 'complete-trip', 'seed-checkout', 'reset', 'last-seat-groups']) {
    const r = await post(`demo/${path}`, { bookingId: randomUUID(), groupId: randomUUID(), holdId: randomUUID(), captainId: 'cap-6' }, token);
    assert.equal(r.code, 'DEMO_ONLY', path);
  }
});

test('race last seat: one request wins the 3/4 group, the other gets GROUP_FULL', async () => {
  const token = await claim('female');
  const list = (await post('demo/last-seat-groups', {}, token)).data;
  // the fixture sits in 2027, after the real seed groups, so find it by id
  const g = list.find((x) => x.group_id === fixture.groupId);
  assert.ok(g, 'fixture group is listed as a last-seat group');
  const [mine, seed] = await Promise.all([
    post('start-checkout', { groupId: g.group_id, pickupAreaId: g.pickup_area_id, routeVersion: g.route_version, idempotencyKey: randomUUID() }, token),
    post('demo/seed-checkout', { groupId: g.group_id }, token),
  ]);
  const wins = [mine, seed].filter((r) => r.ok);
  const losses = [mine, seed].filter((r) => !r.ok);
  assert.equal(wins.length, 1, JSON.stringify([mine, seed]));
  assert.equal(losses[0].code, 'GROUP_FULL');
  for (const w of wins) assert.equal((await post('demo/release-hold', { holdId: w.data.hold_id }, token)).ok, true);
  assert.equal((await q(c, 'select 1 from seat_holds where group_id=$1 and released_at is null', [g.group_id])).length, 0);
});

test('clock, toggles, expire-hold and reset work for a demo profile', async () => {
  const token = await claim('female');
  const set = await post('demo/set', { clockOffsetMinutes: 700, forceTravelOutage: true, forcePaymentFailure: true }, token);
  assert.equal(set.data.clockOffsetMinutes, 700);
  assert.equal(set.data.forceTravelOutage, true);
  assert.equal((await post('demo/set', { clockOffsetMinutes: 'x' }, token)).code, 'INVALID_INPUT');
  const diff = new Date(set.data.appNow) - new Date(set.data.realNow);
  assert.ok(Math.abs(diff - 700 * 60000) < 5000);

  const reset = await post('demo/reset', {}, token);
  assert.equal(reset.data.reset, true);
  const after = (await post('demo/settings', {}, token)).data;
  assert.equal(after.clockOffsetMinutes, 0);
  assert.equal(after.forceTravelOutage, false);
  assert.equal((await one(c, `select count(*)::int n from groups`)).n >= 90, true);
});
