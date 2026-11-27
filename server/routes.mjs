import express from 'express';
import { pool } from './db.mjs';
import { toResponse } from './errors.mjs';

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

  return r;
}
