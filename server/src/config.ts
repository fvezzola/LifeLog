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
  publicUrl:      required('PUBLIC_URL'),
  allowedOrigin:  required('ALLOWED_ORIGIN'),
  port:           parseInt(optional('PORT', '3000'), 10),
  host:           optional('HOST', '127.0.0.1'),
  resendApiKey:   process.env.RESEND_API_KEY || null,
  resendFrom:     optional('RESEND_FROM', 'LifeLog <login@lifelog.local>'),
};

if (config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
