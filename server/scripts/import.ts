// Import a Supabase JSON export (or any { entries, taxonomy } dump from
// LifeLog's Settings → Export) into the self-hosted database.
//
// Usage:
//   tsx scripts/import.ts <email> <path/to/dump.json>
//
// Creates the user if they don't exist; upserts entries by id (so it's
// safe to re-run); replaces the taxonomy.

import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Pool } = pg;

const [, , email, file] = process.argv;
if (!email || !file) {
  console.error('Usage: tsx scripts/import.ts <email> <path/to/dump.json>');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const dump = JSON.parse(await readFile(file, 'utf8')) as {
  entries?:  Array<{
    id: string; text: string; category?: string; summary?: string;
    tags?: unknown; timestamp: string; source?: string;
  }>;
  taxonomy?: Record<string, unknown>;
};

const entries = dump.entries ?? [];
const taxonomy = dump.taxonomy ?? {};

const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  await client.query('begin');

  const u = await client.query(
    `insert into users (email) values ($1)
     on conflict (email) do update set email = excluded.email
     returning id`,
    [email.toLowerCase()],
  );
  const userId = u.rows[0].id;
  console.log(`[import] user ${email} → ${userId}`);

  let upserted = 0;
  for (const e of entries) {
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
        e.id, userId, e.text,
        e.category ?? null, e.summary ?? null,
        e.tags ? JSON.stringify(e.tags) : null,
        e.timestamp, e.source ?? null,
      ],
    );
    upserted++;
  }
  console.log(`[import] entries upserted: ${upserted}`);

  await client.query(
    `insert into app_state (user_id, taxonomy, updated_at)
     values ($1, $2, now())
     on conflict (user_id) do update set
       taxonomy = excluded.taxonomy,
       updated_at = excluded.updated_at`,
    [userId, JSON.stringify(taxonomy)],
  );
  console.log(`[import] taxonomy keys: ${Object.keys(taxonomy).length}`);

  await client.query('commit');
  console.log('[import] done');
} catch (err) {
  await client.query('rollback').catch(() => {});
  console.error('[import] failed', err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
