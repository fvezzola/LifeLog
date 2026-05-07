// Create a LifeLog user (or reset their password) from the command line.
//
//   npm run create-user                                    (interactive)
//   npm run create-user -- --email a@b.com --password p    (non-interactive)
//
// If a user with that email already exists, the password is UPDATED — so
// this script also works as a password-reset tool. There is no public
// signup endpoint; this is the only way accounts get created.

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Did you `cp .env.example .env` and edit it?');
  process.exit(1);
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

let email    = flag('email');
let password = flag('password');

if (!email || !password) {
  console.log('(Password will be visible as you type — you are alone at your laptop, it is fine.)');
  const rl = createInterface({ input: stdin, output: stdout });
  if (!email)    email    = (await rl.question('Email:    ')).trim().toLowerCase();
  if (!password) password = await rl.question('Password: ');
  rl.close();
}

if (!email || !email.includes('@'))     { console.error('Invalid email');                       process.exit(1); }
if (!password || password.length < 8)   { console.error('Password must be at least 8 chars');   process.exit(1); }

const hash = await bcrypt.hash(password, 12);

const pool = new Pool({ connectionString: databaseUrl });
const { rows } = await pool.query(
  `insert into users (email, password_hash) values ($1, $2)
   on conflict (email) do update set password_hash = excluded.password_hash
   returning id, (xmax = 0) as inserted`,
  [email, hash],
);
await pool.end();

const { id, inserted } = rows[0];
console.log(`[create-user] ${inserted ? 'created' : 'updated password for'} ${email} → ${id}`);
