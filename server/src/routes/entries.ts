// Entries CRUD. Every query is scoped by the authenticated user_id.
//
//   GET    /api/entries          → all of the user's entries, newest first
//   POST   /api/entries          → upsert one entry or an array of entries
//   DELETE /api/entries/:id      → delete one entry by id

import { Hono } from 'hono';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

type Entry = {
  id:        string;
  text:      string;
  category?: string | null;
  summary?:  string | null;
  tags?:     unknown;
  timestamp: string;
  source?:   string | null;
};

function isEntry(x: unknown): x is Entry {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  return typeof e.id === 'string'
      && typeof e.text === 'string'
      && typeof e.timestamp === 'string';
}

export const entriesRoutes = new Hono<{ Variables: { user: { sub: string; email: string } } }>();

entriesRoutes.use('*', requireAuth);

entriesRoutes.get('/', async c => {
  const user = c.get('user');
  const { rows } = await pool.query(
    `select id, text, category, summary, tags, timestamp, source
       from entries
      where user_id = $1
      order by timestamp desc`,
    [user.sub],
  );
  return c.json(rows);
});

entriesRoutes.post('/', async c => {
  const user = c.get('user');
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }

  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) return c.json({ ok: true, count: 0 });
  if (!list.every(isEntry)) return c.json({ error: 'invalid entry shape' }, 400);

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const e of list) {
      await client.query(
        `insert into entries (id, user_id, text, category, summary, tags, timestamp, source)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do update set
           text = excluded.text,
           category = excluded.category,
           summary = excluded.summary,
           tags = excluded.tags,
           timestamp = excluded.timestamp,
           source = excluded.source
         where entries.user_id = $2`,
        [
          e.id, user.sub, e.text,
          e.category ?? null, e.summary ?? null,
          e.tags ? JSON.stringify(e.tags) : null,
          e.timestamp, e.source ?? null,
        ],
      );
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error('[entries] upsert failed', err);
    return c.json({ error: 'upsert failed' }, 500);
  } finally {
    client.release();
  }

  return c.json({ ok: true, count: list.length });
});

entriesRoutes.delete('/:id', async c => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { rowCount } = await pool.query(
    `delete from entries where id = $1 and user_id = $2`,
    [id, user.sub],
  );
  return c.json({ ok: true, deleted: rowCount ?? 0 });
});
