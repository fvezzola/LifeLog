// LifeLog backend URL. Point this at your self-hosted server (the Hono
// API in ../server/), exposed via Tailscale Serve or a public domain.
//
// Examples:
//   - Tailscale Serve:   https://lifelog.tail-scales.ts.net
//   - Cloudflare Tunnel: https://lifelog.yourdomain.com
//   - Local dev:         http://127.0.0.1:3000
//
// This URL must match the PUBLIC_URL configured in server/.env, and the
// PWA's origin (e.g. https://fvezzola.github.io) must be in that
// server's ALLOWED_ORIGIN.

export const API_BASE = 'https://lifelog.example.ts.net';
