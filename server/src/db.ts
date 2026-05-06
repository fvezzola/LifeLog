// Single shared pg pool. All routes import this.

import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

pool.on('error', err => {
  console.error('[db] idle client error', err);
});
