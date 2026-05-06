// One LISTEN connection on Postgres' lifelog_changes channel; fans events
// out to all SSE subscribers for the matching user_id.
//
// On startup, server/src/index.ts calls startListener() once. Each SSE
// client (in routes/stream.ts) calls subscribe() with their user_id and
// gets a callback for each notification matching that user.

import pg from 'pg';
import { config } from './config.js';

const { Client } = pg;

type ChangePayload = {
  table:   'entries' | 'app_state';
  op:      'INSERT' | 'UPDATE' | 'DELETE';
  user_id: string;
  row:     Record<string, unknown>;
};

type Subscriber = (payload: ChangePayload) => void;

const subscribers = new Map<string, Set<Subscriber>>();  // userId → set of callbacks

let listenerClient: pg.Client | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

export async function startListener(): Promise<void> {
  if (listenerClient) return;

  const client = new Client({ connectionString: config.databaseUrl });
  listenerClient = client;

  client.on('notification', msg => {
    if (msg.channel !== 'lifelog_changes' || !msg.payload) return;
    let parsed: ChangePayload;
    try { parsed = JSON.parse(msg.payload); }
    catch { console.warn('[realtime] bad payload', msg.payload); return; }

    const subs = subscribers.get(parsed.user_id);
    if (!subs) return;
    for (const cb of subs) {
      try { cb(parsed); } catch (err) { console.error('[realtime] subscriber threw', err); }
    }
  });

  client.on('error', err => {
    console.error('[realtime] listen client error', err);
    listenerClient = null;
    scheduleReconnect();
  });
  client.on('end', () => {
    console.warn('[realtime] listen client ended');
    listenerClient = null;
    scheduleReconnect();
  });

  await client.connect();
  await client.query('listen lifelog_changes');
  console.log('[realtime] listening on lifelog_changes');
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startListener().catch(err => console.error('[realtime] reconnect failed', err));
  }, 2000);
}

export function subscribe(userId: string, cb: Subscriber): () => void {
  let set = subscribers.get(userId);
  if (!set) { set = new Set(); subscribers.set(userId, set); }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) subscribers.delete(userId);
  };
}
