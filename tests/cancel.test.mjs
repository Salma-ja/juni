import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  connect, one, q, mkGroup, joinGroup, checkout, payHold, group, booking, expectFail, NOW, cleanupFixtures, mkProfile,
} from './helpers.mjs';

let c;
before(async () => { c = await connect(); await cleanupFixtures(c); });
after(async () => { await cleanupFixtures(c); await c.end(); });
beforeEach(() => c.query('begin'));
afterEach(() => c.query('rollback'));

const CANCEL = 'select core.cancel_booking($1::uuid,$2::uuid,$3::timestamptz) as r';
const minus = (ts, hours) => new Date(new Date(ts).getTime() - hours * 3600000).toISOString();

async function threeOfFour() {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'al-husn' }] });
  const mine = await joinGroup(c, g.groupId, { area: 'hawara' }); // 4th seat
  return { g, mine };
}

test('T05: cancel 13 h before pickup refunds the full fare', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }] });
  const mine = await joinGroup(c, g.groupId, { area: 'hawara' });
  const b = await booking(c, mine.pay.booking_id);
  const r = (await one(c, CANCEL, [mine.profile, b.id, minus(b.pickup_at, 13)])).r;
  assert.equal(r.refund_fils, b.fare_fils);
  assert.equal(r.reason, 'rider_12h_plus');
  assert.equal((await booking(c, b.id)).status, 'cancelled');
  assert.equal((await one(c, 'select core.seats_booked($1::uuid) n', [g.groupId])).n, 2);
});

test('T06: cancel 10 h before pickup refunds 0, keeps the seat taken and other fares unchanged', async () => {
  const { g, mine } = await threeOfFour();
  const fares = await q(c, `select id, fare_fils from bookings where group_id=$1 and rider_id <> $2 order by id`, [g.groupId, mine.profile]);
  const b = await booking(c, mine.pay.booking_id);
  const r = (await one(c, CANCEL, [mine.profile, b.id, minus(b.pickup_at, 10)])).r;
  assert.equal(r.refund_fils, 0);
  assert.equal(r.reason, 'rider_late_no_refund');
  assert.equal((await one(c, 'select core.seats_booked($1::uuid) n', [g.groupId])).n, 4);
  assert.equal((await group(c, g.groupId)).status, 'awaiting_captain');
  assert.deepEqual(await q(c, `select id, fare_fils from bookings where group_id=$1 and rider_id <> $2 order by id`, [g.groupId, mine.profile]), fares);
});

test('T11: cancel exactly 12 h before pickup refunds the full fare', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }] });
  const mine = await joinGroup(c, g.groupId, { area: 'hawara' });
  const b = await booking(c, mine.pay.booking_id);
  const r = (await one(c, CANCEL, [mine.profile, b.id, minus(b.pickup_at, 12)])).r;
  assert.equal(r.refund_fils, b.fare_fils);
  assert.equal(r.reason, 'rider_12h_plus');
});

test('X6: a full refund cancel on an awaiting_captain group reopens it and unassigns the captain', async () => {
  const { g, mine } = await threeOfFour();
  assert.equal((await group(c, g.groupId)).status, 'awaiting_captain');
  const b = await booking(c, mine.pay.booking_id);
  await one(c, CANCEL, [mine.profile, b.id, minus(b.pickup_at, 20)]);
  const row = await group(c, g.groupId);
  assert.equal(row.status, 'open');
  assert.equal(row.captain_id, null);
  assert.equal(row.captain_confirmed_at, null);
  assert.equal((await one(c, 'select core.seats_booked($1::uuid) n', [g.groupId])).n, 3);
});

test('a full refund cancel on a confirmed group reopens it so the seat can be re-booked (journey 5-7)', async () => {
  const { g, mine } = await threeOfFour();
  await c.query(`select core.confirm_captain($1::uuid, $2::timestamptz)`, [g.groupId, NOW]);
  assert.equal((await group(c, g.groupId)).status, 'confirmed');
  const b = await booking(c, mine.pay.booking_id);
  await one(c, CANCEL, [mine.profile, b.id, minus(b.pickup_at, 13)]);
  const row = await group(c, g.groupId);
  assert.equal(row.status, 'open');
  assert.equal(row.captain_id, null);
  assert.equal((await q(c, `select status from bookings where group_id=$1 and status <> 'cancelled'`, [g.groupId])).every((r) => r.status === 'seat_booked'), true);
  // re-book the same seat; the fare is the same last-seat fare (G minus the others)
  const again = await checkout(c, mine.profile, g.groupId, 'hawara');
  assert.equal(again.fare_fils, b.fare_fils);
  const pay = await payHold(c, mine.profile, again.hold_id);
  assert.equal(pay.status, 'awaiting_captain');
});

test('CANCEL_NOT_ALLOWED once the trip has started', async () => {
  const { g, mine } = await threeOfFour();
  await c.query(`select core.confirm_captain($1::uuid, $2::timestamptz)`, [g.groupId, NOW]);
  await c.query(`select core.start_trip($1::uuid, $2::timestamptz)`, [g.groupId, NOW]);
  await expectFail(c, 'CANCEL_NOT_ALLOWED', CANCEL, [mine.profile, mine.pay.booking_id, NOW]);
});

test('only the booking owner can cancel; a second cancel is rejected', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
  const b = await booking(c, g.members[0].pay.booking_id);
  const other = await mkProfile(c);
  await expectFail(c, 'BOOKING_NOT_FOUND', CANCEL, [other, b.id, NOW]);
  await one(c, CANCEL, [g.members[0].profile, b.id, minus(b.pickup_at, 20)]);
  await expectFail(c, 'ALREADY_CANCELLED', CANCEL, [g.members[0].profile, b.id, minus(b.pickup_at, 20)]);
});
