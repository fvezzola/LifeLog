// Hono app bootstrap. Wires routes, CORS, static-file serving for the
// PWA, and starts the realtime listener.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { config } from './config.js';
import { startListener } from './realtime.js';
import { authRoutes, meRoute } from './routes/auth.js';
import { entriesRoutes } from './routes/entries.js';
import { stateRoutes } from './routes/state.js';
import { streamRoutes } from './routes/stream.js';
import { healthRoutes } from './routes/health.js';

const app = new Hono();

if (config.allowedOrigin) {
  app.use('*', cors({
    origin:      config.allowedOrigin,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }));
}

// API routes — registered before the static handler so `/api/*` always
// wins over a hypothetical `api/` directory in the static root.
app.route('/api/health',    healthRoutes);
app.route('/api/auth',      authRoutes);
app.route('/api',           meRoute);          // /api/me
app.route('/api/entries',   entriesRoutes);
app.route('/api/app_state', stateRoutes);
app.route('/api/stream',    streamRoutes);

// Block any path that would expose internals: dotfiles (.git, .env), the
// server source tree, and any node_modules / pgdata that happen to sit
// alongside the PWA. Returns 404 so the existence isn't disclosed.
const BLOCKED = /^\/(\.|server\/|node_modules\/|pgdata\/)/;
app.use('*', async (c, next) => {
  if (BLOCKED.test(c.req.path)) return c.text('Not found', 404);
  return next();
});

// Static PWA. Served last; missing files fall through to the 404 handler.
app.use('*', serveStatic({ root: config.staticDir }));

// SPA-style fallback: any non-asset GET that didn't match a route or
// file returns index.html, so deep-links work.
app.get('*', serveStatic({ path: 'index.html', root: config.staticDir }));

app.notFound(c => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  console.error('[unhandled]', err);
  return c.json({ error: 'internal error' }, 500);
});

await startListener();

serve(
  { fetch: app.fetch, port: config.port, hostname: config.host },
  info => console.log(`[server] listening on http://${info.address}:${info.port}`),
);
