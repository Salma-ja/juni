import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { pool, withTx } from './db.mjs';
import { ApiError, toResponse } from './errors.mjs';
import { requireSession } from './auth.mjs';
import { ROOT } from './env.mjs';

/** Wrap an async handler so thrown errors become the JSON error shape. */
export const handler = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res);
    if (!res.headersSent) res.json({ ok: true, data });
  } catch (err) {
    const { status, body } = toResponse(err);
    res.status(status).json(body);
  }
};

const s = (v, name) => {
  if (typeof v !== 'string' || !v) throw new ApiError('INVALID_INPUT', `${name} is required`);
  return v;
};
export const uuid = (v, name) => {
  if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
    throw new ApiError('INVALID_INPUT', `${name} must be a uuid`);
  }
  return v;
};
export { s as str };

/**
 * Register POST /api/<name>. Handler pattern (§3): bearer token -> sessions -> profile -> begin ->
 * core.* with p_profile and p_now = core.app_now(profile) -> commit. A core error (P0001) rolls back.
 * fn receives {client, profile, body, now, req}. Use {public:true} for endpoints without a session.
 */
function assertRehearsal(req) {
  if (process.env.JUNI_REHEARSAL_MODE === 'false') throw new ApiError('NOT_FOUND', 'Not found.', 404);
  const pin = process.env.JUNI_REHEARSAL_PIN;
  if (!pin) return;
  const key = req.get('x-rehearsal-key') || '';
  if (key !== pin) throw new ApiError('REHEARSAL_REQUIRED', 'Rehearsal key required.', 403);
}

export function endpoint(router, name, fn, { public: isPublic = false, demoOnly = false } = {}) {
  router.post(`/${name}`, handler((req) =>
    withTx(async (client) => {
      if (name.startsWith('demo/')) assertRehearsal(req);
      let profile = null;
      let now = null;
      if (!isPublic) {
        profile = await requireSession(client, req);
        if (demoOnly && !profile.is_demo) throw new ApiError('DEMO_ONLY', 'Demo controls are only available in demo mode.');
        now = (await client.query('select core.app_now($1::uuid) as now', [profile.id])).rows[0].now;
      }
      return fn({ client, profile, body: req.body ?? {}, now, req });
    })));
}

/** Call a core function that returns jsonb. */
export const callCore = async (client, sql, params) => (await client.query(sql, params)).rows[0].r;

export function buildRouter() {
  const r = express.Router();

  r.get('/health', async (_req, res) => {
    try {
      await pool.query('select 1');
      const day = await pool.query(`select core.next_teaching_day((now() at time zone 'Asia/Amman')::date) as d`);
      res.json({
        ok: true, db: true,
        rehearsalMode: process.env.JUNI_REHEARSAL_MODE !== 'false',
        nextTeachingDay: day.rows[0].d,
      });
    } catch {
      res.status(500).json({ ok: false, db: false });
    }
  });

  r.get('/config', (_req, res) => {
    res.json({
      demoLoginEnabled: process.env.JUNI_DEMO_LOGIN_ENABLED === 'true',
      rehearsalMode: process.env.JUNI_REHEARSAL_MODE !== 'false',
    });
  });

  // ---- Phase 3: demo sessions (§6) ----
  endpoint(r, 'demo/claim', async ({ client, body }) => {
    if (process.env.JUNI_DEMO_LOGIN_ENABLED !== 'true') throw new ApiError('DEMO_DISABLED', 'Demo login is disabled.', 403);
    if (body.role === 'captain') {
      const cap = (await client.query('select id, full_name from captains where id = $1 and licensed and active', [body.captainId])).rows[0];
      if (!cap) throw new ApiError('INVALID_INPUT', 'captainId is invalid');
      const p = (await client.query(
        `insert into profiles (full_name, gender, verified, is_demo, captain_id) values ($1, 'male', true, true, $2)
         returning id, full_name, gender, verified, is_demo, captain_id, points_balance, default_pickup_id`, [cap.full_name, cap.id])).rows[0];
      await client.query('insert into demo_settings (profile_id) values ($1)', [p.id]);
      const { token } = (await client.query('insert into sessions (profile_id) values ($1) returning token', [p.id])).rows[0];
      return { token, profile: meJson(p) };
    }
    const { gender } = body;
    if (gender !== 'female' && gender !== 'male') throw new ApiError('INVALID_INPUT', 'gender must be female or male');
    const fullName = typeof body.fullName === 'string' && body.fullName.trim() ? body.fullName.trim().slice(0, 40) : (gender === 'female' ? 'Salma' : 'Omar');
    const p = (await client.query(
      `insert into profiles (full_name, gender, verified, is_demo) values ($1, $2, true, true)
       returning id, full_name, gender, verified, is_demo, points_balance, default_pickup_id`, [fullName, gender])).rows[0];
    await client.query('insert into demo_settings (profile_id) values ($1)', [p.id]);
    const { token } = (await client.query('insert into sessions (profile_id) values ($1) returning token', [p.id])).rows[0];
    return { token, profile: meJson(p) };
  }, { public: true });

  endpoint(r, 'me', async ({ client, profile }) => {
    const me = meJson(profile);
    if (profile.captain_id) {
      const v = (await client.query(
        `select v.make_model, v.color, v.plate, c.license_expires_on, c.phone_masked
           from captains c join vehicles v on v.captain_id = c.id where c.id = $1`, [profile.captain_id])).rows[0];
      me.captain = v ?? null;
    }
    return me;
  });

  endpoint(r, 'signout', async ({ client, req }) => {
    const token = req.get('authorization').replace(/^Bearer\s+/i, '').toLowerCase();
    await client.query('delete from sessions where token = $1', [token]);
    return { signedOut: true };
  });

  endpoint(r, 'pickup-areas', async ({ client, profile }) =>
    (await client.query(
      `select id, name, name_ar, detail, gate_landmark_en, gate_landmark_ar, lat, lng, corridor, is_custom, location_kind
         from pickup_areas
        where not is_custom or owner_profile_id = $1
        order by is_custom desc, corridor desc, name`,
      [profile.id],
    )).rows);
  endpoint(r, 'campuses', async ({ client }) =>
    (await client.query(`select id, code, name, name_ar, short_ar, label, lat, lng, corridor, corridor_polyline
                           from campuses
                          order by case id when 'just' then 1 when 'yarmouk' then 2 when 'inu' then 3 when 'uj' then 4 when 'aau' then 5 else 6 end, label`)).rows);
  endpoint(r, 'demand-stats', async ({ client }) =>
    (await client.query('select stat_type, entity_key, rider_count, is_highlighted from core.corridor_demand_stats')).rows);
  // Dispatch log for one group: only for riders booked in it and the group's own captain.
  endpoint(r, 'dispatch-audit', async ({ client, profile, body }) =>
    (await client.query(
      `select a.captain_id, a.outcome, a.detail from captain_dispatch_audit a
        where a.group_id = $1
          and (exists (select 1 from bookings b where b.group_id = a.group_id and b.rider_id = $2 and b.status <> 'cancelled')
               or exists (select 1 from groups g where g.id = a.group_id and g.captain_id = $3))
        order by a.created_at`,
      [uuid(body.groupId, 'groupId'), profile.id, profile.captain_id ?? null],
    )).rows);

  endpoint(r, 'set-default-pickup', async ({ client, profile, body }) => {
    const areaId = s(body.pickupAreaId, 'pickupAreaId');
    const row = (await client.query(
      'select id from pickup_areas where id = $1 and (not is_custom or owner_profile_id = $2)',
      [areaId, profile.id],
    )).rows[0];
    if (!row) throw new ApiError('INVALID_INPUT', 'pickupAreaId is invalid');
    await client.query('update profiles set default_pickup_id = $2 where id = $1', [profile.id, areaId]);
    return { defaultPickupId: areaId };
  });

  endpoint(r, 'save-custom-location', async ({ client, profile, body }) => {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 29.0 || lat > 33.5 || lng < 34.8 || lng > 39.5) {
      throw new ApiError('INVALID_INPUT', 'Coordinates must be within Jordan service corridors.');
    }
    const kind = body.kind === 'current_gps' ? 'current_gps' : 'custom_home';
    // Find nearest reference gate to infer corridor & neighborhood context
    const nearest = (await client.query(
      `select id, name, name_ar, corridor, round(core.leg_km($1, $2, lat, lng), 1) as km
         from pickup_areas
        where not is_custom
        order by core.haversine_km($1, $2, lat, lng) asc
        limit 1`,
      [lat, lng],
    )).rows[0];
    const corridor = nearest?.corridor ?? (lat < 32.2 ? 'amman' : 'irbid');
    const rawName = typeof body.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, 48)
      : (kind === 'current_gps' ? 'My Current Location' : 'My Home');
    const nearHint = nearest ? `Near ${nearest.name} (${nearest.km} km)` : 'Home pickup pin';
    const rawDetail = typeof body.detail === 'string' && body.detail.trim()
      ? `${body.detail.trim().slice(0, 80)} · ${nearHint}`
      : nearHint;
    const nameAr = kind === 'current_gps' ? 'موقعي الحالي' : 'منزلي';
    // Create a fresh immutable ID if existing custom pin already has active bookings/stops so historical routes never mutate
    const baseId = `${kind === 'current_gps' ? 'gps' : 'home'}-${profile.id.slice(0, 8)}`;
    const inUse = (await client.query(
      `select 1 from group_stops where pickup_area_id = $1
       union all select 1 from bookings where pickup_area_id = $1 limit 1`,
      [baseId],
    )).rows[0];
    const areaId = inUse ? `${baseId}-${Math.random().toString(36).slice(2, 6)}` : baseId;

    // Only ever update a pin this rider owns; if the id is taken by someone else, save under a fresh random id.
    const savePin = async (id) => (await client.query(
      `insert into pickup_areas (
         id, name, name_ar, detail, gate_landmark_en, gate_landmark_ar,
         lat, lng, corridor, is_custom, owner_profile_id, location_kind
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11)
       on conflict (id) do update set
         name = excluded.name,
         name_ar = excluded.name_ar,
         detail = excluded.detail,
         gate_landmark_en = excluded.gate_landmark_en,
         gate_landmark_ar = excluded.gate_landmark_ar,
         lat = excluded.lat,
         lng = excluded.lng,
         corridor = excluded.corridor,
         location_kind = excluded.location_kind
       where pickup_areas.owner_profile_id = excluded.owner_profile_id
       returning id, name, name_ar, detail, gate_landmark_en, gate_landmark_ar, lat, lng, corridor, is_custom, location_kind`,
      [id, rawName, nameAr, rawDetail, rawDetail, nearest?.name_ar ? `بالقرب من ${nearest.name_ar}` : nameAr, lat, lng, corridor, profile.id, kind],
    )).rows[0];
    const saved = (await savePin(areaId)) ?? (await savePin(`${baseId}-${randomUUID().slice(0, 8)}`));
    if (!saved) throw new ApiError('INTERNAL', 'Could not save the location.', 500);

    await client.query('update profiles set default_pickup_id = $2 where id = $1', [profile.id, saved.id]);
    return saved;
  });

  endpoint(r, 'points', async ({ client, profile }) => {
    const ledger = (await client.query(
      `select id, booking_id, delta, reason, label, created_at
         from points_ledger where profile_id = $1 order by created_at desc limit 25`,
      [profile.id],
    )).rows;
    return { balance: profile.points_balance ?? 120, target: 300, ledger };
  });

  endpoint(r, 'notifications', async ({ client, profile }) => {
    const items = (await client.query(
      `select id, group_id, booking_id, kind, title, body, meta, read_at, created_at
         from notifications where recipient_id = $1 order by created_at desc limit 30`,
      [profile.id],
    )).rows;
    const unreadCount = items.filter((n) => !n.read_at).length;
    return { unreadCount, items };
  });

  endpoint(r, 'notifications/read', async ({ client, profile, body }) => {
    if (body.notificationId) {
      await client.query(
        `update notifications set read_at = coalesce(read_at, now()) where id = $1 and recipient_id = $2`,
        [uuid(body.notificationId, 'notificationId'), profile.id],
      );
    } else {
      await client.query(
        `update notifications set read_at = now() where recipient_id = $1 and read_at is null`,
        [profile.id],
      );
    }
    return { ok: true };
  });

  endpoint(r, 'isolated-pools', async ({ client, profile, body, now }) => {
    const reqRow = (await client.query(
      `select id, campus_id, pickup_area_id, arrival_target_at, class_start_at
         from ride_requests where id = $1 and rider_id = $2`,
      [uuid(body.requestId, 'requestId'), profile.id],
    )).rows[0];
    if (!reqRow) throw new ApiError('REQUEST_NOT_FOUND', 'Request not found.');
    const pools = (await client.query(
      `select g.id as group_id, g.campus_id, g.pref, g.status, g.departure_at, g.arrival_target_at as arrival_at,
              g.route_minutes, g.capacity, g.group_fare_fils,
              core.seats_booked(g.id) + core.seats_held(g.id, $3::timestamptz) as seats_taken,
              (select coalesce(jsonb_agg(pa.name order by s.seq), '[]'::jsonb)
                 from group_stops s join pickup_areas pa on pa.id = s.pickup_area_id where s.group_id = g.id) as stops,
              (select coalesce(jsonb_agg(jsonb_build_object('first_name', core.first_name(p.full_name), 'verified', p.verified) order by b.created_at), '[]'::jsonb)
                 from bookings b join profiles p on p.id = b.rider_id where b.group_id = g.id and b.status <> 'cancelled') as members
         from groups g
        where g.campus_id = $1
          and (g.arrival_target_at at time zone 'Asia/Amman')::date = ($2::timestamptz at time zone 'Asia/Amman')::date
          and g.status in ('open', 'full', 'awaiting_captain', 'confirmed')
          and g.pref = $4::group_pref
        order by abs(extract(epoch from (g.arrival_target_at - $2::timestamptz))), g.departure_at
        limit 24`,
      // Groups are gender-isolated: a rider only ever sees groups of their own gender.
      [reqRow.campus_id, reqRow.arrival_target_at, now, profile.gender === 'male' ? 'boys_only' : 'girls_only'],
    )).rows;
    return {
      campus_id: reqRow.campus_id,
      rider_gender: profile.gender,
      pools,
    };
  });

  // ---- Phase 4: plan, departure, search, groups ----
  const PREFS = ['girls_only', 'boys_only'];
  const pref = (v) => {
    if (v == null) return null;
    if (!PREFS.includes(v)) throw new ApiError('INVALID_INPUT', 'pref is invalid');
    return v;
  };
  endpoint(r, 'create-request', ({ client, profile, body, now }) => {
    const start = new Date(body.classStartAt);
    if (Number.isNaN(start.getTime())) throw new ApiError('INVALID_INPUT', 'classStartAt is invalid');
    return callCore(client, 'select core.create_request($1::uuid,$2,$3,$4::timestamptz,$5::group_pref,$6::timestamptz) as r',
      [profile.id, s(body.campusId, 'campusId'), s(body.pickupAreaId, 'pickupAreaId'), start.toISOString(), pref(body.pref), now]);
  });
  endpoint(r, 'recommend-departure', ({ client, profile, body, now }) =>
    callCore(client, 'select core.recommend_departure($1::uuid,$2::uuid,$3::timestamptz) as r',
      [profile.id, uuid(body.requestId, 'requestId'), now]));
  endpoint(r, 'search-groups', ({ client, profile, body, now }) =>
    callCore(client, 'select core.search_groups($1::uuid,$2::uuid,$3::group_pref,$4::timestamptz) as r',
      [profile.id, uuid(body.requestId, 'requestId'), pref(body.pref), now]));
  endpoint(r, 'create-group', ({ client, profile, body, now }) =>
    callCore(client, 'select core.create_group($1::uuid,$2::uuid,$3::timestamptz) as r',
      [profile.id, uuid(body.requestId, 'requestId'), now]));
  endpoint(r, 'group-detail', async ({ client, profile, body, now }) => {
    const data = await callCore(client, 'select core.group_detail($1::uuid,$2::uuid,$3::uuid,$4::timestamptz) as r',
      [profile.id, uuid(body.groupId, 'groupId'), uuid(body.requestId, 'requestId'), now]);
    const locked = (await client.query(
      `select core.first_name(p.full_name) as first_name, b.fare_fils, pa.name, pa.name_ar,
              core.area_km(b.pickup_area_id, g.campus_id) as km
         from bookings b
         join profiles p on p.id = b.rider_id
         join groups g on g.id = b.group_id
         join pickup_areas pa on pa.id = b.pickup_area_id
        where b.group_id = $1 and b.status <> 'cancelled'
        order by b.created_at`,
      [data.group_id],
    )).rows;
    const you = (await client.query(
      `select pa.name, pa.name_ar, core.area_km(pa.id, $2) as km
         from pickup_areas pa where pa.id = $1`,
      [data.pickup_area_id, data.campus_id],
    )).rows[0];
    return { ...data, locked_seats: locked, your_gate: you ?? null };
  });

  // start-checkout is registered here because X7 (Phase 3) asserts that it rejects missing sessions.
  endpoint(r, 'start-checkout', ({ client, profile, body, now }) =>
    callCore(client, 'select core.start_checkout($1::uuid,$2::uuid,$3,$4::int,$5::uuid,$6::timestamptz) as r',
      [profile.id, uuid(body.groupId, 'groupId'), s(body.pickupAreaId, 'pickupAreaId'),
       Number.isInteger(body.routeVersion) ? body.routeVersion : null, uuid(body.idempotencyKey, 'idempotencyKey'), now]));

  // ---- Phase 5: payment and booking ----
  endpoint(r, 'pay', async ({ client, profile, body, now }) => {
    if (body.outcome !== 'success' && body.outcome !== 'failed') throw new ApiError('INVALID_INPUT', 'outcome is invalid');
    const method = body.paymentMethod === 'jeeny_wallet' || body.paymentMethod === 'card' ? body.paymentMethod : 'cash';
    const result = await callCore(client, 'select core.pay($1::uuid,$2::uuid,$3,$4::uuid,$5::timestamptz) as r',
      [profile.id, uuid(body.holdId, 'holdId'), body.outcome, uuid(body.idempotencyKey, 'idempotencyKey'), now]);
    if (result.booking_id) {
      await client.query('update bookings set payment_method = $2 where id = $1', [result.booking_id, method]);
    }
    return { ...result, payment_method: method };
  });
  endpoint(r, 'booking', async ({ client, profile, body, now }) => {
    const data = await callCore(client, 'select core.booking_detail($1::uuid,$2::uuid,$3::timestamptz) as r',
      [profile.id, uuid(body.bookingId, 'bookingId'), now]);
    const row = (await client.query('select payment_method from bookings where id = $1', [data.id])).rows[0];
    return { ...data, payment_method: row?.payment_method ?? 'cash' };
  });
  // Plain read of the caller's own hold, so the payment screen survives a reload (not a rule: no computation).
  endpoint(r, 'hold', async ({ client, profile, body, now }) => {
    const row = (await client.query(
      `select h.id as hold_id, h.group_id, h.pickup_area_id, h.quoted_fare_fils as fare_fils, h.expires_at, h.released_at,
              h.release_reason, g.departure_at, g.campus_id
         from seat_holds h join groups g on g.id = h.group_id
        where h.id = $1 and h.rider_id = $2`, [uuid(body.holdId, 'holdId'), profile.id])).rows[0];
    if (!row) throw new ApiError('HOLD_NOT_FOUND', 'Hold not found.');
    return { ...row, app_now: now, active: row.released_at === null && new Date(row.expires_at) > new Date(now) };
  });

  // What the rider has started but not finished: an unpaid seat hold, or a group search that found a group but has no booking yet.
  endpoint(r, 'pending', async ({ client, profile, now }) => {
    const hold = (await client.query(
      `select h.id as hold_id, h.group_id, h.pickup_area_id, pa.name as pickup_name, g.campus_id,
              h.quoted_fare_fils as fare_fils, h.expires_at,
              coalesce(s.eta_at, g.departure_at) as pickup_at, g.arrival_target_at as arrival_at,
              (select q.id from ride_requests q
                where q.rider_id = h.rider_id and q.campus_id = g.campus_id and q.pickup_area_id = h.pickup_area_id
                order by q.created_at desc limit 1) as request_id
         from seat_holds h
         join groups g on g.id = h.group_id
         join pickup_areas pa on pa.id = h.pickup_area_id
         left join group_stops s on s.group_id = h.group_id and s.pickup_area_id = h.pickup_area_id
        where h.rider_id = $1 and h.released_at is null and h.expires_at > $2
        order by h.created_at desc limit 1`, [profile.id, now])).rows[0] ?? null;
    const plan = (await client.query(
      `select q.id as request_id, q.campus_id, q.pickup_area_id, pa.name as pickup_name, q.arrival_target_at as arrival_at
         from ride_requests q join pickup_areas pa on pa.id = q.pickup_area_id
        where q.rider_id = $1 and q.status = 'matched' and q.arrival_target_at > $2
          and q.created_at > now() - interval '3 hours'
          and not exists (
            select 1 from bookings b join groups g on g.id = b.group_id
             where b.rider_id = q.rider_id and b.status in ('seat_booked', 'awaiting_captain', 'confirmed', 'in_progress')
               and abs(extract(epoch from (g.arrival_target_at - q.arrival_target_at))) < 10800)
        order by q.created_at desc limit 1`, [profile.id, now])).rows[0] ?? null;
    return { app_now: now, hold, plan };
  });

  // ---- Phase 6: rides, cancellation, SOS ----
  endpoint(r, 'my-bookings', ({ client, profile, now }) =>
    callCore(client, 'select core.my_bookings($1::uuid,$2::timestamptz) as r', [profile.id, now]));
  endpoint(r, 'cancel-booking', ({ client, profile, body, now }) =>
    callCore(client, 'select core.cancel_booking($1::uuid,$2::uuid,$3::timestamptz) as r',
      [profile.id, uuid(body.bookingId, 'bookingId'), now]));
  endpoint(r, 'log-sos', ({ client, profile, body, now }) =>
    callCore(client, 'select core.log_sos($1::uuid,$2::uuid,$3::timestamptz) as r',
      [profile.id, uuid(body.bookingId, 'bookingId'), now]));

  // ---- Phase 7: demo control panel (§8). Every endpoint answers DEMO_ONLY unless the caller is a demo profile. ----
  const demo = (name, fn) => endpoint(r, `demo/${name}`, fn, { demoOnly: true });
  const bookingArg = (body) => uuid(body.bookingId, 'bookingId');

  const settings = async (client, profile) => {
    const row = (await client.query(
      `select clock_offset_minutes, force_travel_outage, force_payment_failure, now() as real_now,
              core.app_now($1::uuid) as app_now from demo_settings where profile_id = $1`, [profile.id])).rows[0];
    const hold = (await client.query(
      `select id from seat_holds where rider_id = $1 and released_at is null and expires_at > $2
        order by created_at desc limit 1`, [profile.id, row.app_now])).rows[0];
    return {
      clockOffsetMinutes: row.clock_offset_minutes, forceTravelOutage: row.force_travel_outage,
      forcePaymentFailure: row.force_payment_failure, realNow: row.real_now, appNow: row.app_now,
      activeHoldId: hold?.id ?? null,
    };
  };
  demo('settings', ({ client, profile }) => settings(client, profile));
  demo('set', async ({ client, profile, body }) => {
    if (body.clockOffsetMinutes !== undefined) {
      if (!Number.isInteger(body.clockOffsetMinutes) || Math.abs(body.clockOffsetMinutes) > 60 * 24 * 30) {
        throw new ApiError('INVALID_INPUT', 'clockOffsetMinutes is invalid');
      }
      await client.query('update demo_settings set clock_offset_minutes = $2 where profile_id = $1', [profile.id, body.clockOffsetMinutes]);
    }
    for (const [key, col] of [['forceTravelOutage', 'force_travel_outage'], ['forcePaymentFailure', 'force_payment_failure']]) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'boolean') throw new ApiError('INVALID_INPUT', `${key} must be boolean`);
        await client.query(`update demo_settings set ${col} = $2 where profile_id = $1`, [profile.id, body[key]]);
      }
    }
    return settings(client, profile);
  });
  demo('confirm-captain', ({ client, profile, body, now }) =>
    callCore(client, 'select core.demo_confirm_captain($1::uuid,$2::uuid,$3::timestamptz) as r', [profile.id, bookingArg(body), now]));
  demo('assign-captain', ({ client, profile, body, now }) =>
    callCore(client, 'select core.demo_assign_captain($1::uuid,$2::uuid,$3,$4::timestamptz) as r',
      [profile.id, bookingArg(body), s(body.captainId, 'captainId'), now]));
  demo('expire-hold', ({ client, profile, body, now }) =>
    callCore(client, 'select core.demo_expire_hold($1::uuid,$2::uuid,$3::timestamptz) as r', [profile.id, uuid(body.holdId, 'holdId'), now]));
  demo('release-hold', ({ client, profile, body, now }) =>
    callCore(client, 'select core.demo_release_hold($1::uuid,$2::uuid,$3::timestamptz) as r', [profile.id, uuid(body.holdId, 'holdId'), now]));
  demo('start-trip', ({ client, profile, body, now }) =>
    callCore(client, 'select core.demo_start_trip($1::uuid,$2::uuid,$3::timestamptz) as r', [profile.id, bookingArg(body), now]));
  demo('complete-trip', ({ client, profile, body, now }) =>
    callCore(client, 'select core.demo_complete_trip($1::uuid,$2::uuid,$3::timestamptz) as r', [profile.id, bookingArg(body), now]));
  demo('last-seat-groups', ({ client, profile, now }) =>
    callCore(client, 'select core.last_seat_groups($1::uuid,$2::timestamptz) as r', [profile.id, now]));
  demo('seed-checkout', ({ client, body, now }) =>
    callCore(client, 'select core.seed_checkout($1::uuid,$2::timestamptz) as r', [uuid(body.groupId, 'groupId'), now]));
  demo('reset', async ({ client, profile }) => {
    await client.query('select core.demo_reset_user($1::uuid)', [profile.id]);
    await client.query(fs.readFileSync(path.join(ROOT, 'db', 'seed.sql'), 'utf8'));
    return { reset: true };
  });
  demo('reset-rehearsal', async ({ client }) =>
    (await client.query('select core.reset_rehearsal_seed() as r')).rows[0].r);

  // ---- Captain (driver) mode ----
  const cap = (name, fn) => endpoint(r, `captain/${name}`, (ctx) => {
    if (!ctx.profile.captain_id) throw new ApiError('CAPTAIN_ONLY', 'Captain account required.', 403);
    return fn({ ...ctx, captainId: ctx.profile.captain_id });
  });
  cap('trips', ({ client, captainId, now }) =>
    callCore(client, 'select core.captain_trips($1,$2::timestamptz) as r', [captainId, now]));
  cap('confirm', ({ client, captainId, body, now }) =>
    callCore(client, 'select core.captain_confirm($1,$2::uuid,$3::timestamptz) as r', [captainId, uuid(body.groupId, 'groupId'), now]));
  cap('decline', ({ client, captainId, body, now }) =>
    callCore(client, 'select core.captain_decline($1,$2::uuid,$3::timestamptz) as r', [captainId, uuid(body.groupId, 'groupId'), now]));
  cap('start', ({ client, captainId, body, now }) =>
    callCore(client, 'select core.captain_start($1,$2::uuid,$3::timestamptz) as r', [captainId, uuid(body.groupId, 'groupId'), now]));
  cap('pickup', ({ client, captainId, body, now }) =>
    callCore(client, 'select core.captain_pickup($1,$2::uuid,$3::uuid,$4::timestamptz) as r',
      [captainId, uuid(body.groupId, 'groupId'), uuid(body.bookingId, 'bookingId'), now]));
  cap('complete', ({ client, captainId, body, now }) =>
    callCore(client, 'select core.captain_complete($1,$2::uuid,$3::timestamptz) as r', [captainId, uuid(body.groupId, 'groupId'), now]));
  cap('earnings', ({ client, captainId }) =>
    callCore(client, 'select core.captain_earnings($1) as r', [captainId]));

  return r;
}

const meJson = (p) => ({
  profileId: p.id, fullName: p.full_name, gender: p.gender, verified: p.verified, isDemo: p.is_demo,
  role: p.captain_id ? 'captain' : 'rider', captainId: p.captain_id ?? null,
  pointsBalance: p.points_balance ?? 120, defaultPickupId: p.default_pickup_id ?? null,
});
