// Liveness probe — used to verify the server is reachable from a device.

import { Hono } from 'hono';
import { pool } from '../db.js';

export const healthRoutes = new Hono();

healthRoutes.get('/', async c => {
  try {
    await pool.query('select 1');
    return c.json({ ok: true, db: 'up' });
  } catch (err) {
    console.error('[health] db check failed', err);
    return c.json({ ok: false, db: 'down' }, 503);
  }
});
