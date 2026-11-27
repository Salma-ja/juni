import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/index.mjs';
import { pool } from '../server/db.mjs';
import { connect, cleanupFixtures, ARRIVAL_DAY, localTs } from './helpers.mjs';

let server, base, c;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  c = await connect();
  await cleanupFixtures(c);
});
after(async () => {
  await new Promise((r) => server.close(r));
  try {
    await c.query(`delete from profiles where captain_id is not null and is_demo`).catch(() => {});
    await cleanupFixtures(c);
    await c.end();
  } finally {
    await pool.end();
  }
});

const post = (path, body = {}, t) =>
  fetch(`${base}/api/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(t ? { authorization: `Bearer ${t}` } : {}),
      ...(process.env.JUNI_REHEARSAL_PIN ? { 'x-rehearsal-key': process.env.JUNI_REHEARSAL_PIN } : {}),
    },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

test('AAU and UJ campuses and Amman pickup gates are available and settable as default address', async () => {
  const rider = (await post('demo/claim', { gender: 'female', fullName: 'zz-test Amman' })).data.token;
  const camps = (await post('campuses', {}, rider)).data;
  const codes = camps.map((u) => u.code);
  assert.ok(codes.includes('AAU'), 'AAU exists');
  assert.ok(codes.includes('UJ'), 'UJ exists');

  const gates = (await post('pickup-areas', {}, rider)).data;
  assert.ok(gates.some((g) => g.id === 'sweileh' && g.corridor === 'amman'), 'Sweileh Amman gate exists');

  const setRes = await post('set-default-pickup', { pickupAreaId: 'sweileh' }, rider);
  assert.equal(setRes.ok, true);
  assert.equal(setRes.data.defaultPickupId, 'sweileh');

  // Save live Current GPS location and Custom Home Pin and group with nearby students from home
  const gpsLoc = await post('save-custom-location', {
    lat: 32.0242, lng: 35.8575, kind: 'current_gps', name: 'My Current Location', detail: 'Al-Jubaiha Home St, Bldg 9',
  }, rider);
  assert.equal(gpsLoc.ok, true);
  assert.equal(gpsLoc.data.is_custom, true);
  assert.equal(gpsLoc.data.location_kind, 'current_gps');
  assert.equal(gpsLoc.data.corridor, 'amman');

  const homeLoc = await post('save-custom-location', {
    lat: 32.0260, lng: 35.8440, kind: 'custom_home', name: 'My Home', detail: 'Sweileh Villa 14',
  }, rider);
  assert.equal(homeLoc.ok, true);
  assert.equal(homeLoc.data.location_kind, 'custom_home');

  const areasAfter = (await post('pickup-areas', {}, rider)).data;
  assert.ok(areasAfter.some((a) => a.id === homeLoc.data.id && a.is_custom), 'custom home appears in user pickup areas');

  // Plan & start a group directly from Custom Home and verify route/fare works end-to-end
  const classStart = new Date(new Date(localTs(ARRIVAL_DAY, '11:50')).getTime() + 10 * 60000).toISOString();
  const homeReq = await post('create-request', {
    campusId: 'uj', pickupAreaId: homeLoc.data.id, classStartAt: classStart,
  }, rider);
  assert.equal(homeReq.ok, true);
  const homeGroup = await post('create-group', { requestId: homeReq.data.request_id }, rider);
  assert.equal(homeGroup.ok, true);
  assert.ok(homeGroup.data.stops.includes('My Home'), 'route includes custom home stop');
});

test('filling last seat awards +30 pts, captain decline reassigns cleanly, accept & pickups notify all group riders', async () => {
  const tokens = [];
  for (let i = 0; i < 4; i += 1) {
    const cl = await post('demo/claim', { gender: 'female', fullName: `zz-test Girl${i + 1}` });
    tokens.push(cl.data.token);
  }

  const classStart = new Date(new Date(localTs(ARRIVAL_DAY, '10:50')).getTime() + 10 * 60000).toISOString();
  const req1 = (await post('create-request', { campusId: 'uj', pickupAreaId: 'sweileh', classStartAt: classStart }, tokens[0])).data;
  const created = (await post('create-group', { requestId: req1.request_id }, tokens[0])).data;
  const groupId = created.group_id;

  const bookingIds = [];
  for (let i = 0; i < 4; i += 1) {
    const area = i % 2 === 0 ? 'sweileh' : 'jubaiha';
    const req = i === 0
      ? req1
      : (await post('create-request', { campusId: 'uj', pickupAreaId: area, classStartAt: classStart }, tokens[i])).data;
    const det = (await post('group-detail', { groupId, requestId: req.request_id }, tokens[i])).data;
    const co = (await post('start-checkout', {
      groupId, pickupAreaId: area, routeVersion: det.route_version, idempotencyKey: randomUUID(),
    }, tokens[i])).data;
    const paid = (await post('pay', { holdId: co.hold_id, outcome: 'success', idempotencyKey: randomUUID() }, tokens[i])).data;
    bookingIds.push(paid.booking_id);
    if (i === 3) {
      assert.equal(paid.points_awarded, 30, '4th seat earns +30 points');
    }
  }

  // Verify 4th rider balance is 150 (120 base + 30 last-seat bonus)
  const pts4 = (await post('points', {}, tokens[3])).data;
  assert.equal(pts4.balance, 150);
  assert.ok(pts4.ledger.some((e) => e.delta === 30 && e.reason === 'last_seat_bonus'));

  // Assigned captain declines -> reassigns cleanly without breaking group or bookings
  const firstBooking = (await post('booking', { bookingId: bookingIds[0] }, tokens[0])).data;
  assert.ok(firstBooking.captain?.id, 'captain assigned when 4/4 filled');
  const cap1Token = (await post('demo/claim', { role: 'captain', captainId: firstBooking.captain.id })).data.token;
  const dec = await post('captain/decline', { groupId }, cap1Token);
  assert.equal(dec.ok, true);
  assert.ok(dec.data.reassigned_to, 'reassigned to next eligible captain');
  assert.notEqual(dec.data.reassigned_to, firstBooking.captain.id);

  // Reassigned captain accepts -> ALL 4 riders receive trip_accepted notification
  const cap2Token = (await post('demo/claim', { role: 'captain', captainId: dec.data.reassigned_to })).data.token;
  assert.equal((await post('captain/confirm', { groupId }, cap2Token)).ok, true);

  for (let i = 0; i < 4; i += 1) {
    const notifs = (await post('notifications', {}, tokens[i])).data;
    assert.ok(notifs.items.some((n) => n.kind === 'trip_accepted'), `rider ${i + 1} received trip_accepted`);
  }

  // Start trip & pick up first rider -> ALL 4 riders receive live rider_picked_up notification + 1/4 count
  assert.equal((await post('captain/start', { groupId }, cap2Token)).ok, true);
  const pickRes = await post('captain/pickup', { groupId, bookingId: bookingIds[0] }, cap2Token);
  assert.equal(pickRes.ok, true);
  assert.equal(pickRes.data.picked_up_count, 1);
  assert.equal(pickRes.data.total_riders, 4);

  for (let i = 0; i < 4; i += 1) {
    const notifs = (await post('notifications', {}, tokens[i])).data;
    assert.ok(notifs.items.some((n) => n.kind === 'rider_picked_up'), `rider ${i + 1} received rider_picked_up`);
    const bDetail = (await post('booking', { bookingId: bookingIds[i] }, tokens[i])).data;
    assert.equal(bDetail.picked_up_count, 1);
    assert.equal(bDetail.total_riders, 4);
  }
});
