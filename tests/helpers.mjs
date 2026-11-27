import '../server/env.mjs';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

// Fixtures use a fixed future date and an explicit p_now so they never depend on the seed (relative to now()).
// The date must fall before the seeded captains' licences expire (earliest 2027-03-31, cap-4).
export const NOW = '2027-02-01T06:00:00Z';
export const ARRIVAL_DAY = '2027-02-03'; // a Wednesday

export async function connect() {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  return c;
}

export const q = async (c, sql, params = []) => (await c.query(sql, params)).rows;
export const one = async (c, sql, params = []) => (await c.query(sql, params)).rows[0];

/** Run a statement that must raise core error `code`. Uses a savepoint so the transaction stays usable. */
export async function expectFail(c, code, sql, params = []) {
  await c.query('savepoint expect_fail');
  try {
    await c.query(sql, params);
  } catch (err) {
    await c.query('rollback to savepoint expect_fail');
    if (err.code !== 'P0001' || err.message !== code) {
      throw new Error(`expected ${code}, got ${err.code}:${err.message}`);
    }
    return;
  }
  await c.query('rollback to savepoint expect_fail');
  throw new Error(`expected ${code}, but the call succeeded`);
}

export async function mkProfile(c, { gender = 'female', verified = true, demo = false, name } = {}) {
  const id = randomUUID();
  await c.query('insert into profiles (id, full_name, gender, verified, is_demo) values ($1,$2,$3,$4,$5)', [
    id, name ?? `zz-test ${id.slice(0, 6)}`, gender, verified, demo,
  ]);
  if (demo) await c.query('insert into demo_settings (profile_id) values ($1)', [id]);
  return id;
}

export const localTs = (day, hhmm) => new Date(new Date(`${day}T${hhmm}:00+03:00`)).toISOString();

export async function makeRequest(c, profile, { campus = 'just', area = 'hawara', time = '07:50', day = ARRIVAL_DAY, pref = null, now = NOW } = {}) {
  const arrival = new Date(localTs(day, time));
  const classStart = new Date(arrival.getTime() + 10 * 60000).toISOString();
  const r = await one(c, 'select core.create_request($1::uuid,$2,$3,$4::timestamptz,$5::group_pref,$6::timestamptz) as r',
    [profile, campus, area, classStart, pref, now]);
  return r.r;
}

export async function checkout(c, profile, groupId, area, now = NOW, key = randomUUID()) {
  const rv = (await one(c, 'select route_version from groups where id=$1', [groupId])).route_version;
  return (await one(c, 'select core.start_checkout($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::timestamptz) as r',
    [profile, groupId, area, rv, key, now])).r;
}

export async function payHold(c, profile, holdId, outcome = 'success', now = NOW, key = randomUUID()) {
  return (await one(c, 'select core.pay($1::uuid,$2::uuid,$3,$4::uuid,$5::timestamptz) as r', [profile, holdId, outcome, key, now])).r;
}

/**
 * Build a group with the given members, booked through core.* with p_now = NOW.
 * members: [{area, gender}]. The first member creates it.
 */
export async function mkGroup(c, { campus = 'just', time = '07:50', day = ARRIVAL_DAY, pref = 'any', members = [], now = NOW } = {}) {
  let groupId = null;
  const out = [];
  for (const m of members) {
    const profile = await mkProfile(c, { gender: m.gender ?? 'female' });
    const req = await makeRequest(c, profile, { campus, area: m.area, time, day, pref, now });
    if (!groupId) {
      groupId = (await one(c, 'select core.create_group($1::uuid,$2::uuid,$3::timestamptz) as r', [profile, req.request_id, now])).r.group_id;
    }
    const hold = await checkout(c, profile, groupId, m.area, now);
    const pay = await payHold(c, profile, hold.hold_id, 'success', now);
    out.push({ profile, request: req, hold, pay });
  }
  return { groupId, members: out };
}

export const group = (c, id) => one(c, 'select * from groups where id=$1', [id]);

/** Remove committed fixtures (profiles named zz-test*) and everything hanging off them. */
export async function cleanupFixtures(c) {
  const ids = `(select id from profiles where full_name like 'zz-test%')`;
  const gids = `(select id from groups where created_by in ${ids})`;
  await c.query(`delete from refunds where booking_id in (select id from bookings where group_id in ${gids})`);
  await c.query(`delete from incidents where group_id in ${gids}`);
  await c.query(`delete from payments where hold_id in (select id from seat_holds where group_id in ${gids})`);
  await c.query(`delete from bookings where group_id in ${gids}`);
  await c.query(`delete from seat_holds where group_id in ${gids}`);
  await c.query(`delete from group_stops where group_id in ${gids}`);
  await c.query(`delete from groups where id in ${gids}`);
  await c.query(`delete from ride_requests where rider_id in ${ids}`);
  await c.query(`delete from idempotency_results where created_at < now() and key not in (select idempotency_key from payments union select idempotency_key from seat_holds)`);
  await c.query(`delete from profiles where full_name like 'zz-test%'`);
}

/** Join an existing group as a new rider (checkout + pay). Returns {profile, hold, pay}. */
export async function joinGroup(c, groupId, { area = 'hawara', gender = 'female', now = NOW } = {}) {
  const profile = await mkProfile(c, { gender });
  const hold = await checkout(c, profile, groupId, area, now);
  const pay = await payHold(c, profile, hold.hold_id, 'success', now);
  return { profile, hold, pay };
}

export const booking = (c, id) => one(c, 'select * from bookings where id=$1', [id]);
