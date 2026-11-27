import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connect, one } from './helpers.mjs';

let c;
before(async () => { c = await connect(); });
after(async () => { await c.end(); });

// §7.5 reference values from the §5.1 model (peak 1.25 at 07:50 arrival).
const ARR = '2027-02-03T04:50:00Z';
const route = async (areas) =>
  (await one(c, `select core.build_route('just', $1::text[], $2::timestamptz, false) as r`, [areas, ARR])).r;

test('Hawara + Al-Husn -> JUST is 65 min, group fare 6000', async () => {
  assert.equal((await route(['hawara', 'al-husn'])).route_minutes, 65);
  assert.equal((await one(c, `select core.group_fare('just','hawara') as g`)).g, 6000);
});
test('Ramtha -> JUST is 22 min, group fare 4970', async () => {
  assert.equal((await route(['ramtha'])).route_minutes, 22);
  assert.equal((await one(c, `select core.group_fare('just','ramtha') as g`)).g, 4970);
});
test('Aidoun + Sareeh -> JUST is 42 min, group fare 5320', async () => {
  assert.equal((await route(['aidoun', 'sareeh'])).route_minutes, 42);
  assert.equal((await one(c, `select core.group_fare('just','sareeh') as g`)).g, 5320);
});
test('JUST ref_km is 17.81', async () => {
  assert.equal(Number((await one(c, `select ref_km from core.campus_ref_km where campus_id='just'`)).ref_km), 17.81);
});
test('stops are ordered farthest first and ETAs follow the legs', async () => {
  const r = await route(['al-husn', 'hawara']);
  assert.deepEqual(r.stops.map((s) => s.pickup_area_id), ['hawara', 'al-husn']);
  assert.equal(new Date(r.stops[0].eta_at).toISOString(), new Date(r.departure_at).toISOString());
  assert.equal(r.travel_source, 'model');
});
