// app_state: single-row taxonomy blob per user.
//   GET /api/app_state  → { taxonomy: {...}, updated_at: '...' } or 404 if none
//   PUT /api/app_state  → body { taxonomy: {...} } replaces the blob

import { Hono } from 'hono';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

export const stateRoutes = new Hono<{ Variables: { user: { sub: string; email: string } } }>();

stateRoutes.use('*', requireAuth);

stateRoutes.get('/', async c => {
  const user = c.get('user');
  const { rows } = await pool.query(
    `select taxonomy, updated_at from app_state where user_id = $1`,
    [user.sub],
  );
  if (rows.length === 0) return c.json({ taxonomy: {}, updated_at: null });
  return c.json(rows[0]);
});

stateRoutes.put('/', async c => {
  const user = c.get('user');
  let body: { taxonomy?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }

  if (!body.taxonomy || typeof body.taxonomy !== 'object' || Array.isArray(body.taxonomy)) {
    return c.json({ error: 'taxonomy must be an object' }, 400);
  }

  await pool.query(
    `insert into app_state (user_id, taxonomy, updated_at)
     values ($1, $2, now())
     on conflict (user_id) do update set
       taxonomy = excluded.taxonomy,
       updated_at = excluded.updated_at`,
    [user.sub, JSON.stringify(body.taxonomy)],
  );

  return c.json({ ok: true });
});
