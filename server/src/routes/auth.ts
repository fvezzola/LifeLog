// Password auth.
//
//   POST /api/auth/login   { email, password } → sets JWT cookie, 200 / 401
//   POST /api/auth/logout                      → clears cookie
//   GET  /api/me                               → current user or 401
//
// Accounts are created out-of-band via `npm run create-user`. There is no
// public sign-up endpoint — keeps the attack surface tight for a small
// self-hosted deployment.

import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { mintJwt, setAuthCookie, clearAuthCookie, requireAuth } from '../auth.js';

export const authRoutes = new Hono();

authRoutes.post('/login', async c => {
  let body: { email?: string; password?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }

  const email    = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) return c.json({ error: 'email and password required' }, 400);

  const { rows } = await pool.query(
    `select id, email, password_hash from users where email = $1`,
    [email],
  );

  // Constant-time-ish: always run bcrypt.compare even on missing user, so
  // response timing doesn't leak which emails exist.
  const fakeHash = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const hash = rows[0]?.password_hash ?? fakeHash;
  const ok   = await bcrypt.compare(password, hash);
  if (!ok || rows.length === 0) return c.json({ error: 'invalid credentials' }, 401);

  const user = rows[0];
  const jwt  = await mintJwt({ sub: user.id, email: user.email });
  setAuthCookie(c, jwt);
  return c.json({ id: user.id, email: user.email });
});

authRoutes.post('/logout', async c => {
  clearAuthCookie(c);
  return c.json({ ok: true });
});

export const meRoute = new Hono();
meRoute.get('/me', requireAuth, c => {
  const u = c.get('user');
  return c.json({ id: u.sub, email: u.email });
});
