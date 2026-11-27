import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connect, one } from './helpers.mjs';

let c;
before(async () => { c = await connect(); });
after(async () => { await c.end(); });

const share = async (d, idx, frozen, last) =>
  (await one(c, 'select core.fare_share(6000, 4, $1::numeric[], $2, $3, $4) as f', [d, idx, frozen, last])).f;

test('X4: weighted split worked example (1017, 1322, 1625, 2036, sum 6000)', async () => {
  const a = await share([6, 12, 12, 12], 1, 0, false);
  const b = await share([6, 8, 12, 12], 2, a, false);
  const cc = await share([6, 8, 10, 12], 3, a + b, false);
  const d = await share([6, 8, 10, 12], 4, a + b + cc, true);
  console.log(`X4 fares ${a}, ${b}, ${cc}, ${d}`);
  assert.deepEqual([a, b, cc, d], [1017, 1322, 1625, 2036]);
  assert.equal(a + b + cc + d, 6000);
});

test('equal split when the spread is within 2 km', async () => {
  assert.equal(await share([10, 11, 11, 12], 1, 0, false), 1500);
});
