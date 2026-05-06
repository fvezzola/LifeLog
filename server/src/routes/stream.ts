// SSE stream endpoint. Each client opens an EventSource to /api/stream and
// receives "change" events for their own user_id. Heartbeats every 25s
// keep the connection alive through proxies.

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { requireAuth } from '../auth.js';
import { subscribe } from '../realtime.js';

export const streamRoutes = new Hono<{ Variables: { user: { sub: string; email: string } } }>();

streamRoutes.use('*', requireAuth);

streamRoutes.get('/', c => {
  const user = c.get('user');

  return streamSSE(c, async stream => {
    let id = 0;
    const queue: string[] = [];
    let resolveTick: (() => void) | null = null;

    const wake = () => { if (resolveTick) { const r = resolveTick; resolveTick = null; r(); } };

    const unsub = subscribe(user.sub, payload => {
      queue.push(JSON.stringify(payload));
      wake();
    });

    stream.onAbort(() => { unsub(); wake(); });

    await stream.writeSSE({ event: 'ready', data: '{}', id: String(id++) });

    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: 'ping', data: '{}', id: String(id++) }).catch(() => {});
    }, 25_000);

    try {
      while (!stream.aborted) {
        if (queue.length === 0) {
          await new Promise<void>(r => { resolveTick = r; });
          if (stream.aborted) break;
        }
        const data = queue.shift();
        if (data === undefined) continue;
        await stream.writeSSE({ event: 'change', data, id: String(id++) });
      }
    } finally {
      clearInterval(heartbeat);
      unsub();
    }
  });
});
