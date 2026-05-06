// JWT mint/verify + Hono middleware that puts `c.var.user` in scope
// on protected routes. JWT is delivered as an httpOnly cookie so the
// PWA can use credentials:'include' without having to manage tokens.

import { SignJWT, jwtVerify } from 'jose';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context, MiddlewareHandler } from 'hono';
import { config } from './config.js';

const COOKIE_NAME = 'lifelog_jwt';
const JWT_TTL_DAYS = 30;
const secretKey = new TextEncoder().encode(config.jwtSecret);

export type UserClaims = {
  sub:   string;  // user id (uuid)
  email: string;
};

export async function mintJwt(claims: UserClaims): Promise<string> {
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${JWT_TTL_DAYS}d`)
    .sign(secretKey);
}

export async function verifyJwt(token: string): Promise<UserClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function setAuthCookie(c: Context, jwt: string) {
  setCookie(c, COOKIE_NAME, jwt, {
    httpOnly: true,
    secure:   true,
    sameSite: 'Lax',
    path:     '/',
    maxAge:   JWT_TTL_DAYS * 24 * 60 * 60,
  });
}

export function clearAuthCookie(c: Context) {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}

// Protected-route middleware. Pulls the JWT from cookie OR Authorization
// header (so Capacitor / future native clients without cookie support work
// the same way).
export const requireAuth: MiddlewareHandler<{ Variables: { user: UserClaims } }> = async (c, next) => {
  let token = getCookie(c, COOKIE_NAME);
  if (!token) {
    const auth = c.req.header('Authorization');
    if (auth?.startsWith('Bearer ')) token = auth.slice(7);
  }
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const claims = await verifyJwt(token);
  if (!claims) return c.json({ error: 'unauthorized' }, 401);

  c.set('user', claims);
  await next();
};
