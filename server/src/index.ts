// Hono app bootstrap. Wires routes, CORS, and starts the realtime listener.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { config } from './config.js';
import { startListener } from './realtime.js';
import { authRoutes, meRoute } from './routes/auth.js';
import { entriesRoutes } from './routes/entries.js';
import { stateRoutes } from './routes/state.js';
import { streamRoutes } from './routes/stream.js';
import { healthRoutes } from './routes/health.js';

const app = new Hono();

app.use('*', cors({
  origin:      config.allowedOrigin,
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.route('/api/health',    healthRoutes);
app.route('/api/auth',      authRoutes);
app.route('/api',           meRoute);          // /api/me
app.route('/api/entries',   entriesRoutes);
app.route('/api/app_state', stateRoutes);
app.route('/api/stream',    streamRoutes);

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
