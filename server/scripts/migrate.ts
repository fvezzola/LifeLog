// Apply SQL migrations from server/migrations/ in order.
// Idempotent — each migration uses CREATE IF NOT EXISTS / OR REPLACE.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

const files = (await readdir(MIGRATIONS_DIR))
  .filter(f => f.endsWith('.sql'))
  .sort();

for (const file of files) {
  const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
  console.log(`[migrate] applying ${file}`);
  await pool.query(sql);
}

console.log(`[migrate] done (${files.length} files)`);
await pool.end();
