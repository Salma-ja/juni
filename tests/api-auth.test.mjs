import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.mjs';
import { pool } from '../server/db.mjs';
import { connect } from './helpers.mjs';

let server, base;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  const c = await connect();
  await c.query(`delete from profiles where is_demo and full_name like 'zz-test%'`);
  await c.end();
  await pool.end();
});

const post = (path, body = {}, token) =>
  fetch(`${base}/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

test('X7: /api/me and /api/start-checkout return 401 NO_SESSION without a header and with a bogus token', async () => {
  for (const path of ['me', 'start-checkout']) {
    for (const token of [undefined, '00000000-0000-4000-8000-000000000000', 'not-a-token']) {
      const r = await post(path, {}, token);
      assert.equal(r.status, 401, `${path} ${token}`);
      assert.equal(r.body.ok, false);
      assert.equal(r.body.code, 'NO_SESSION');
    }
  }
});

test('demo claim creates a verified demo profile and session; me and signout work', async () => {
  const claim = await post('demo/claim', { gender: 'female', fullName: 'zz-test Salma' });
  assert.equal(claim.status, 200);
  assert.equal(claim.body.ok, true);
  const { token, profile } = claim.body.data;
  assert.equal(profile.verified, true);
  assert.equal(profile.isDemo, true);
  assert.equal(profile.gender, 'female');

  const me = await post('me', {}, token);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.fullName, 'zz-test Salma');

  const areas = await post('pickup-areas', {}, token);
  assert.equal(areas.body.data.length, 8);
  const campuses = await post('campuses', {}, token);
  assert.equal(campuses.body.data.length, 3);

  assert.equal((await post('signout', {}, token)).status, 200);
  assert.equal((await post('me', {}, token)).body.code, 'NO_SESSION');
});

test('each demo claim is a separate profile; invalid gender is rejected; unknown api path is JSON 404', async () => {
  const a = await post('demo/claim', { gender: 'male', fullName: 'zz-test Omar' });
  const b = await post('demo/claim', { gender: 'male', fullName: 'zz-test Omar' });
  assert.notEqual(a.body.data.profile.profileId, b.body.data.profile.profileId);
  assert.equal((await post('demo/claim', { gender: 'other' })).body.code, 'INVALID_INPUT');
  const nope = await fetch(`${base}/api/nope`);
  assert.equal(nope.status, 404);
  assert.equal((await nope.json()).ok, false);
});

test('demo claim returns 403 DEMO_DISABLED when the flag is off', async () => {
  const prev = process.env.JUNI_DEMO_LOGIN_ENABLED;
  process.env.JUNI_DEMO_LOGIN_ENABLED = 'false';
  try {
    const r = await post('demo/claim', { gender: 'female' });
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'DEMO_DISABLED');
    const cfg = await (await fetch(`${base}/api/config`)).json();
    assert.equal(cfg.demoLoginEnabled, false);
  } finally {
    process.env.JUNI_DEMO_LOGIN_ENABLED = prev;
  }
});
