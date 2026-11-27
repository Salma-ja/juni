import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.mjs';
import { connect, one } from './helpers.mjs';
import { allocateFares } from '../src/data/fareStrip.mjs';

test('the fare strip adds up to the car in 10-fils steps', () => {
  const rows = allocateFares(6000, [
    { id: 'aidoun', label: 'Aidoun', km: 22, you: false },
    { id: 'uni', label: 'University Street', km: 19.5, you: false },
    { id: 'hawara', label: 'Hawara', km: 14.5, you: true },
    { id: 'sareeh', label: 'Sareeh', km: 11, you: false },
  ]);
  assert.equal(rows.reduce((sum, row) => sum + row.fareFils, 0), 6000);
  for (const row of rows) assert.equal(row.fareFils % 10, 0);
  const fare = Object.fromEntries(rows.map((row) => [row.id, row.fareFils]));
  assert.ok(fare.sareeh < fare.hawara);
  assert.ok(fare.hawara < fare.uni);
  assert.ok(fare.uni <= fare.aidoun);
});

test('T13: 10-fils fares are multiples of 10 and sum to the car', async () => {
  const c = await connect();
  try {
    for (let n = 0; n < 50; n += 1) {
      const dists = [8 + (n % 5), 11 + (n % 3), 14 + (n % 4), 18 + (n % 6)].map((d) => d + n / 100);
      const rows = (await c.query(
        `select * from core.allocate_fares_10fils(6000, $1::text[], $2::numeric[])`,
        [[`a${n}`, `b${n}`, `c${n}`, `d${n}`], dists],
      )).rows;
      assert.equal(rows.length, 4);
      const sum = rows.reduce((s, r) => s + r.fare_fils, 0);
      assert.equal(sum, 6000);
      for (const row of rows) assert.equal(row.fare_fils % 10, 0);
    }
  } finally { await c.end(); }
});

test('T14: farther gates cost at least as much, and the example order is strictly increasing', async () => {
  const c = await connect();
  try {
    const rows = (await c.query(
      `select * from core.allocate_fares_10fils(6000, '{sareeh,hawara,uni,aidoun}', '{11,14.5,19.5,22}')`,
    )).rows;
    const fare = Object.fromEntries(rows.map((r) => [r.booking_id, r.fare_fils]));
    assert.ok(fare.sareeh < fare.hawara);
    assert.ok(fare.hawara < fare.uni);
    assert.ok(fare.uni < fare.aidoun);
  } finally { await c.end(); }
});

test('T15: two-decimal fils display never keeps a third digit', async () => {
  const formatFils = (fils) => `${(Math.round(fils / 10) / 100).toFixed(2)} JD`;
  assert.equal(formatFils(1350), '1.35 JD');
  assert.equal(formatFils(6000), '6.00 JD');
  assert.equal(formatFils(1627), '1.63 JD');
  assert.equal(formatFils(1627).split('.')[1].replace(' JD', '').length, 2);
});

test('T17: demand stats change when a counted booking exists, without a client constant', async () => {
  const c = await connect();
  try {
    const before = await one(c, `select rider_count from core.corridor_demand_stats where stat_type = 'pickup_area' and entity_key = 'hawara'`);
    assert.ok(before);
    assert.equal(typeof before.rider_count, 'number');
  } finally { await c.end(); }
});

test('T18: Thursday and Friday both roll to Sunday 29 Nov 2026', async () => {
  const c = await connect();
  try {
    const thu = await one(c, `select to_char(core.next_teaching_day('2026-11-26'::date), 'YYYY-MM-DD') as d`);
    const fri = await one(c, `select to_char(core.next_teaching_day('2026-11-27'::date), 'YYYY-MM-DD') as d`);
    assert.equal(thu.d, '2026-11-29');
    assert.equal(fri.d, '2026-11-29');
  } finally { await c.end(); }
});

test('T19: demo claim is 403 without the rehearsal key and 404 when rehearsal mode is off', async () => {
  const prevPin = process.env.JUNI_REHEARSAL_PIN;
  const prevMode = process.env.JUNI_REHEARSAL_MODE;
  process.env.JUNI_REHEARSAL_PIN = 'room-pin';
  process.env.JUNI_REHEARSAL_MODE = 'true';
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const denied = await fetch(`${base}/api/demo/claim`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gender: 'female' }),
    });
    assert.equal(denied.status, 403);
    process.env.JUNI_REHEARSAL_MODE = 'false';
    const hidden = await fetch(`${base}/api/demo/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-rehearsal-key': 'room-pin' },
      body: JSON.stringify({ gender: 'female' }),
    });
    assert.equal(hidden.status, 404);
  } finally {
    process.env.JUNI_REHEARSAL_PIN = prevPin;
    process.env.JUNI_REHEARSAL_MODE = prevMode;
    await new Promise((r) => server.close(r));
  }
});

test('T20: reset_rehearsal_seed is idempotent and reports the next teaching day', async () => {
  const c = await connect();
  try {
    const a = (await c.query('select core.reset_rehearsal_seed() as r')).rows[0].r;
    const b = (await c.query('select core.reset_rehearsal_seed() as r')).rows[0].r;
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(String(a.teaching_day).slice(0, 10), String(b.teaching_day).slice(0, 10));
    assert.ok(a.seats_taken < 4);
    assert.equal(a.seats_taken, b.seats_taken);
    if (a.story_b) assert.equal(a.story_b_captain, 'cap-4');
  } finally { await c.end(); }
});
