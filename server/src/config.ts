// Load + validate environment config once at startup. Throws if anything
// required is missing so you don't ship a half-configured server.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  databaseUrl:    required('DATABASE_URL'),
  jwtSecret:      required('JWT_SECRET'),
  // Empty string disables CORS entirely (the PWA is now served from the
  // same origin as the API, so cross-origin doesn't apply).
  allowedOrigin:  process.env.ALLOWED_ORIGIN || '',
  // Where the PWA's static files live, relative to the server's working
  // directory (`server/` when you run `npm run dev`). Default: the repo
  // root, one level up.
  staticDir:      optional('STATIC_DIR', '../'),
  port:           parseInt(optional('PORT', '3000'), 10),
  host:           optional('HOST', '127.0.0.1'),
};

if (config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
