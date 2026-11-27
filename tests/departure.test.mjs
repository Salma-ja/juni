import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { connect, one, q, mkProfile, makeRequest, mkGroup, expectFail, NOW, cleanupFixtures } from './helpers.mjs';

let c;
before(async () => { c = await connect(); await cleanupFixtures(c); });
after(async () => { await cleanupFixtures(c); await c.end(); });
beforeEach(() => c.query('begin'));
afterEach(() => c.query('rollback'));

const REC = 'select core.recommend_departure($1::uuid,$2::uuid,$3::timestamptz) as r';

test('recommend_departure: model travel time, 10 min before class, peak note', async () => {
  const p = await mkProfile(c);
  const req = await makeRequest(c, p, { area: 'ramtha' });
  const r = (await one(c, REC, [p, req.request_id, NOW])).r;
  assert.equal(r.travel_source, 'model');
  assert.equal(r.route_minutes, 22);
  assert.equal(r.peak_factor, 1.25);
  assert.equal(new Date(r.arrival_at).getTime() - new Date(r.departure_at).getTime(), 22 * 60000);
  assert.equal(r.minutes_before_class, 10);
});

test('T09: a travel data outage falls back to 45 minutes, labelled fallback', async () => {
  const p = await mkProfile(c, { demo: true });
  const req = await makeRequest(c, p, { area: 'ramtha' });
  await c.query('update demo_settings set force_travel_outage = true where profile_id=$1', [p]);
  const r = (await one(c, REC, [p, req.request_id, NOW])).r;
  assert.equal(r.travel_source, 'fallback');
  assert.equal(r.route_minutes, 45);
});

test('the alternative is the second-ranked group departure, or null', async () => {
  const p = await mkProfile(c, { gender: 'female' });
  const req = await makeRequest(c, p, { area: 'hawara', pref: 'any' });
  assert.equal((await one(c, REC, [p, req.request_id, NOW])).r.alternative, null);
  await mkGroup(c, { members: [{ area: 'hawara' }] });
  await mkGroup(c, { members: [{ area: 'sareeh' }] });
  const r = (await one(c, REC, [p, req.request_id, NOW])).r;
  assert.ok(r.alternative && r.alternative.group_id);
});
