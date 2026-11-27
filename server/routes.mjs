import express from 'express';
import { pool, withTx } from './db.mjs';
import { ApiError, toResponse } from './errors.mjs';
import { requireSession } from './auth.mjs';

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
export function endpoint(router, name, fn, { public: isPublic = false, demoOnly = false } = {}) {
  router.post(`/${name}`, handler((req) =>
    withTx(async (client) => {
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
      res.json({ ok: true, db: true });
    } catch {
      res.status(500).json({ ok: false, db: false });
    }
  });

  r.get('/config', (_req, res) => {
    res.json({ demoLoginEnabled: process.env.JUNI_DEMO_LOGIN_ENABLED === 'true' });
  });

  // ---- Phase 3: demo sessions (§6) ----
  endpoint(r, 'demo/claim', async ({ client, body }) => {
    if (process.env.JUNI_DEMO_LOGIN_ENABLED !== 'true') throw new ApiError('DEMO_DISABLED', 'Demo login is disabled.', 403);
    const { gender } = body;
    if (gender !== 'female' && gender !== 'male') throw new ApiError('INVALID_INPUT', 'gender must be female or male');
    const fullName = typeof body.fullName === 'string' && body.fullName.trim() ? body.fullName.trim().slice(0, 40) : (gender === 'female' ? 'Salma' : 'Omar');
    const p = (await client.query(
      `insert into profiles (full_name, gender, verified, is_demo) values ($1, $2, true, true)
       returning id, full_name, gender, verified, is_demo`, [fullName, gender])).rows[0];
    await client.query('insert into demo_settings (profile_id) values ($1)', [p.id]);
    const { token } = (await client.query('insert into sessions (profile_id) values ($1) returning token', [p.id])).rows[0];
    return { token, profile: meJson(p) };
  }, { public: true });

  endpoint(r, 'me', async ({ profile }) => meJson(profile));

  endpoint(r, 'signout', async ({ client, req }) => {
    const token = req.get('authorization').replace(/^Bearer\s+/i, '').toLowerCase();
    await client.query('delete from sessions where token = $1', [token]);
    return { signedOut: true };
  });

  endpoint(r, 'pickup-areas', async ({ client }) =>
    (await client.query('select id, name, detail, lat, lng from pickup_areas order by name')).rows);
  endpoint(r, 'campuses', async ({ client }) =>
    (await client.query('select id, code, name, label, lat, lng from campuses order by label')).rows);

  // ---- Phase 4: plan, departure, search, groups ----
  const PREFS = ['girls_only', 'boys_only', 'any'];
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
  endpoint(r, 'group-detail', ({ client, profile, body, now }) =>
    callCore(client, 'select core.group_detail($1::uuid,$2::uuid,$3::uuid,$4::timestamptz) as r',
      [profile.id, uuid(body.groupId, 'groupId'), uuid(body.requestId, 'requestId'), now]));

  // start-checkout is registered here because X7 (Phase 3) asserts that it rejects missing sessions.
  endpoint(r, 'start-checkout', ({ client, profile, body, now }) =>
    callCore(client, 'select core.start_checkout($1::uuid,$2::uuid,$3,$4::int,$5::uuid,$6::timestamptz) as r',
      [profile.id, uuid(body.groupId, 'groupId'), s(body.pickupAreaId, 'pickupAreaId'),
       Number.isInteger(body.routeVersion) ? body.routeVersion : null, uuid(body.idempotencyKey, 'idempotencyKey'), now]));

  // ---- Phase 5: payment and booking ----
  endpoint(r, 'pay', ({ client, profile, body, now }) => {
    if (body.outcome !== 'success' && body.outcome !== 'failed') throw new ApiError('INVALID_INPUT', 'outcome is invalid');
    return callCore(client, 'select core.pay($1::uuid,$2::uuid,$3,$4::uuid,$5::timestamptz) as r',
      [profile.id, uuid(body.holdId, 'holdId'), body.outcome, uuid(body.idempotencyKey, 'idempotencyKey'), now]);
  });
  endpoint(r, 'booking', ({ client, profile, body, now }) =>
    callCore(client, 'select core.booking_detail($1::uuid,$2::uuid,$3::timestamptz) as r',
      [profile.id, uuid(body.bookingId, 'bookingId'), now]));
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

  return r;
}

const meJson = (p) => ({ profileId: p.id, fullName: p.full_name, gender: p.gender, verified: p.verified, isDemo: p.is_demo });
