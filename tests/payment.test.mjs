import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  connect, one, q, expectFail, mkProfile, mkGroup, joinGroup, checkout, payHold, group, NOW, cleanupFixtures,
} from './helpers.mjs';

let c;
before(async () => { c = await connect(); await cleanupFixtures(c); });
after(async () => { await cleanupFixtures(c); await c.end(); });
beforeEach(() => c.query('begin'));
afterEach(() => c.query('rollback'));

test('T08: the 4th seat paid makes the group awaiting_captain, not confirmed', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }, { area: 'hawara' }, { area: 'al-husn' }, { area: 'hawara' }] });
  const row = await group(c, g.groupId);
  assert.equal(row.status, 'awaiting_captain');
  assert.equal(row.captain_confirmed_at, null);
  assert.ok(row.captain_id, 'a captain is auto-assigned but unconfirmed');
  const st = await q(c, 'select distinct status from bookings where group_id=$1', [g.groupId]);
  assert.deepEqual(st.map((r) => r.status), ['awaiting_captain']);
  // invariant 3: when full, fares sum to the group fare exactly
  const sum = (await one(c, 'select sum(fare_fils)::int s from bookings where group_id=$1', [g.groupId])).s;
  assert.equal(sum, row.group_fare_fils);
});

test('T10: successful pay creates one booking, one success payment and converts the hold', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
  const p = await mkProfile(c);
  const hold = await checkout(c, p, g.groupId, 'hawara');
  const pay = await payHold(c, p, hold.hold_id);
  assert.equal(pay.outcome, 'success');
  assert.match(pay.booking_code, /^JUNI-[A-Z2-7]{6}$/);
  assert.match(pay.payment_code, /^PAY-[A-Z2-7]{6}$/);
  assert.equal((await q(c, 'select 1 from bookings where hold_id=$1', [hold.hold_id])).length, 1);
  assert.equal((await q(c, `select 1 from payments where hold_id=$1 and outcome='success'`, [hold.hold_id])).length, 1);
  const h = await one(c, 'select * from seat_holds where id=$1', [hold.hold_id]);
  assert.equal(h.release_reason, 'converted');
  assert.equal((await one(c, 'select status from bookings where id=$1', [pay.booking_id])).status, 'seat_booked');
});

test('X1: paying after the hold expired raises HOLD_EXPIRED and the seat is free', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
  const p = await mkProfile(c);
  const hold = await checkout(c, p, g.groupId, 'hawara');
  const late = new Date(new Date(hold.expires_at).getTime() + 1000).toISOString();
  await expectFail(c, 'HOLD_EXPIRED', 'select core.pay($1::uuid,$2::uuid,$3,$4::uuid,$5::timestamptz)',
    [p, hold.hold_id, 'success', randomUUID(), late]);
  assert.equal((await one(c, 'select core.seats_held($1::uuid,$2::timestamptz) n', [g.groupId, late])).n, 0);
  assert.equal((await q(c, 'select 1 from bookings where rider_id=$1', [p])).length, 0);
});

test('X2: paying twice with the same key returns the same result and changes nothing', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
  const p = await mkProfile(c);
  const hold = await checkout(c, p, g.groupId, 'hawara');
  const key = randomUUID();
  const a = await payHold(c, p, hold.hold_id, 'success', NOW, key);
  const b = await payHold(c, p, hold.hold_id, 'success', NOW, key);
  assert.deepEqual(a, b);
  assert.equal((await q(c, 'select 1 from bookings where rider_id=$1', [p])).length, 1);
  assert.equal((await q(c, 'select 1 from payments where hold_id=$1', [hold.hold_id])).length, 1);
});

test('a failed payment records a failed payment, books nothing and releases the hold', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
  const p = await mkProfile(c);
  const hold = await checkout(c, p, g.groupId, 'hawara');
  const pay = await payHold(c, p, hold.hold_id, 'failed');
  assert.equal(pay.outcome, 'failed');
  assert.equal(pay.booking_id, null);
  assert.equal((await q(c, 'select 1 from bookings where rider_id=$1', [p])).length, 0);
  const h = await one(c, 'select * from seat_holds where id=$1', [hold.hold_id]);
  assert.ok(h.released_at);
  assert.equal(h.release_reason, 'payment_failed');
  assert.equal((await one(c, `select outcome from payments where hold_id=$1`, [hold.hold_id])).outcome, 'failed');
});

test('force_payment_failure makes the next pay fail once, then clears itself', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
  const p = await mkProfile(c, { demo: true });
  await c.query('update demo_settings set force_payment_failure = true where profile_id=$1', [p]);
  const hold = await checkout(c, p, g.groupId, 'hawara');
  assert.equal((await payHold(c, p, hold.hold_id, 'success')).outcome, 'failed');
  assert.equal((await one(c, 'select force_payment_failure f from demo_settings where profile_id=$1', [p])).f, false);
});

test('a hold that belongs to someone else is rejected', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
  const p = await mkProfile(c), other = await mkProfile(c);
  const hold = await checkout(c, p, g.groupId, 'hawara');
  await expectFail(c, 'HOLD_NOT_FOUND', 'select core.pay($1::uuid,$2::uuid,$3,$4::uuid,$5::timestamptz)',
    [other, hold.hold_id, 'success', randomUUID(), NOW]);
});

test('joining at a new pickup area adds a stop and bumps route_version; an existing stop does not', async () => {
  const g = await mkGroup(c, { members: [{ area: 'hawara' }] });
  const before = await group(c, g.groupId);
  await joinGroup(c, g.groupId, { area: 'hawara' });
  assert.equal((await group(c, g.groupId)).route_version, before.route_version);
  await joinGroup(c, g.groupId, { area: 'al-husn' });
  const after = await group(c, g.groupId);
  assert.equal(after.route_version, before.route_version + 1);
  assert.equal((await q(c, 'select 1 from group_stops where group_id=$1', [g.groupId])).length, 2);
});
