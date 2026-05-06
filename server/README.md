# LifeLog server

Self-hosted backend for LifeLog. Hono + Postgres, exposed to your other devices via Tailscale Serve. Replaces Supabase.

---

## What's here

- `src/` — Hono API: auth (magic link + JWT cookie), entries CRUD, taxonomy blob, SSE realtime.
- `migrations/` — schema SQL applied by `npm run migrate`.
- `scripts/migrate.ts` — applies migrations.
- `scripts/import.ts` — one-shot importer for a Supabase / LifeLog JSON export.
- `docker-compose.yml` — Postgres only. The Node API runs on the host.

---

## First-time setup

### 1. Install Node + Docker on your laptop

You need Node 20+ and Docker Desktop (or Colima / OrbStack on macOS, Docker Engine on Linux).

### 2. Install Tailscale

```sh
# macOS
brew install --cask tailscale
# Linux
curl -fsSL https://tailscale.com/install.sh | sh
```

Sign in (`tailscale up`). Install the Tailscale app on every device that should reach LifeLog (phone, other laptops). They all share a private network.

### 3. Configure env

```sh
cd server
cp .env.example .env
```

Edit `.env`:

- `JWT_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `PUBLIC_URL` — your tailnet hostname (see step 5). Set after `tailscale serve` is up. Example: `https://lifelog.tail-scales.ts.net`.
- `ALLOWED_ORIGIN` — where the PWA lives. For GitHub Pages: `https://fvezzola.github.io`. For local dev of the front-end: `http://127.0.0.1:5500`.
- `RESEND_API_KEY` — leave empty initially. Magic links print to the server console; copy-paste them into the browser. Set this later if you want real email delivery.

### 4. Start Postgres + run migrations

```sh
docker compose up -d
npm install
npm run migrate
```

### 5. Front the API with Tailscale Serve (handles TLS for free)

In a separate shell, leave this running:

```sh
sudo tailscale serve --https=443 --bg http://127.0.0.1:3000
tailscale serve status
```

The status output shows your public URL — copy it back into `.env` as `PUBLIC_URL`.

### 6. Run the API

```sh
npm run dev
```

You should see:

```
[realtime] listening on lifelog_changes
[server] listening on http://127.0.0.1:3000
```

Hit `https://<tailnet>/api/health` from a browser on any tailnet device — should return `{"ok":true,"db":"up"}`.

### 7. Point the PWA at it

In `../js/config.js`, replace `API_BASE` with your `PUBLIC_URL` value. Commit + push (GitHub Pages picks it up).

### 8. Sign in for the first time

Open the PWA, go to **Settings → Cloud Sync**, enter your email, click **Send Magic Link**. The server console prints the link — open it in the same browser. The cookie gets set, the PWA flips to signed-in state, and `initialSync` runs.

---

## Migrating data from Supabase

If you already have entries in your Supabase project:

1. Open the live PWA → **Settings → Export** → save the JSON file.
2. Run:
   ```sh
   tsx scripts/import.ts you@example.com /path/to/lifelog_export.json
   ```
3. Sign in to the new backend with the same email — your entries and taxonomy should be there.

The importer is idempotent (re-running with the same dump is safe) and won't touch entries belonging to other users.

---

## Day-to-day operation

Whenever you reboot:

```sh
docker compose up -d        # Postgres
sudo tailscale serve ...    # if it doesn't auto-start
npm run dev                 # API
```

For hands-free, register the API as a launchd / systemd service. Doc TBD.

---

## Caveats

- **Laptop sleep stops sync.** When the lid closes, Postgres + the API go down. Entries log offline on devices and resync when you wake the laptop. Move to an always-on box (RPi, mini-PC, or VPS) when this becomes annoying.
- **No backups yet.** Run `pg_dump` on a schedule, or move `pgdata/` to a synced folder. A proper backup story is on the roadmap.
- **Single user assumed.** The API supports multiple users by design (every query is user-scoped), but there's no admin / invite flow. Anyone with a magic-link can sign up by entering an email.
