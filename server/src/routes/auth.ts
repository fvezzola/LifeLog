// Magic-link issue + verify, /me, logout.
//
// Flow:
//   1. POST /api/auth/magic-link  { email }
//        → server mints a one-time token, stores it with 15-min expiry,
//          sends an email (or prints to console) with a verify URL.
//   2. GET /api/auth/verify?token=...
//        → server consumes the token, upserts the user, mints a JWT,
//          sets it as an httpOnly cookie, redirects to ALLOWED_ORIGIN.
//   3. GET  /api/me                  → current user or 401
//   4. POST /api/auth/logout         → clears the cookie

import { Hono } from 'hono';
import { randomBytes } from 'node:crypto';
import { pool } from '../db.js';
import { config } from '../config.js';
import { sendMagicLink } from '../email.js';
import {
  mintJwt, setAuthCookie, clearAuthCookie, requireAuth,
} from '../auth.js';

const TOKEN_TTL_MIN = 15;

export const authRoutes = new Hono();

authRoutes.post('/magic-link', async c => {
  let body: { email?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) return c.json({ error: 'invalid email' }, 400);

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000);

  await pool.query(
    `insert into magic_link_tokens (token, email, expires_at) values ($1, $2, $3)`,
    [token, email, expiresAt],
  );

  const link = `${config.publicUrl}/api/auth/verify?token=${token}`;
  try {
    await sendMagicLink(email, link);
  } catch (err) {
    console.error('[auth] sendMagicLink failed', err);
    return c.json({ error: 'email delivery failed' }, 500);
  }

  return c.json({ ok: true, expiresInMinutes: TOKEN_TTL_MIN });
});

authRoutes.get('/verify', async c => {
  const token = c.req.query('token');
  if (!token) return c.text('Missing token', 400);

  const client = await pool.connect();
  try {
    await client.query('begin');

    const row = await client.query(
      `select email, expires_at, used_at from magic_link_tokens where token = $1 for update`,
      [token],
    );
    if (row.rowCount === 0) {
      await client.query('rollback');
      return c.text('Invalid or unknown token', 400);
    }
    const t = row.rows[0];
    if (t.used_at) {
      await client.query('rollback');
      return c.text('This link was already used. Request a new one.', 400);
    }
    if (new Date(t.expires_at) < new Date()) {
      await client.query('rollback');
      return c.text('This link has expired. Request a new one.', 400);
    }

    await client.query(`update magic_link_tokens set used_at = now() where token = $1`, [token]);

    const userRow = await client.query(
      `insert into users (email) values ($1)
       on conflict (email) do update set email = excluded.email
       returning id, email`,
      [t.email],
    );
    const user = userRow.rows[0];

    await client.query('commit');

    const jwt = await mintJwt({ sub: user.id, email: user.email });
    setAuthCookie(c, jwt);

    // Redirect back to the PWA. The cookie is now set; the page will
    // call /api/me on load and discover it's signed in.
    return c.redirect(config.allowedOrigin);
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error('[auth] verify failed', err);
    return c.text('Sign-in failed', 500);
  } finally {
    client.release();
  }
});

authRoutes.post('/logout', async c => {
  clearAuthCookie(c);
  return c.json({ ok: true });
});

// /me lives on the root API router, mounted separately; see index.ts.
export const meRoute = new Hono();
meRoute.get('/me', requireAuth, c => {
  const u = c.get('user');
  return c.json({ id: u.sub, email: u.email });
});
