# LifeLog server

Self-hosted backend for LifeLog. Hono + Postgres, exposed to your other devices via Tailscale Serve. Replaces Supabase. No third-party services for auth or email — accounts are created via a local CLI command and you sign in with email + password.

---

## What's here

- `src/` — Hono API: password auth (JWT cookie), entries CRUD, taxonomy blob, SSE realtime.
- `migrations/001_init.sql` — schema, applied by `npm run migrate`.
- `scripts/migrate.ts` — applies migrations.
- `scripts/create-user.ts` — creates a user account (or resets a password).
- `scripts/import.ts` — one-shot importer for a Supabase / LifeLog JSON export.
- `docker-compose.yml` — Postgres only. The Node API runs on the host.

---

## First-time setup

### 1. Install Node, Docker, Tailscale on your laptop

- **Node 20 or newer** — https://nodejs.org (LTS installer is fine)
- **Docker Desktop** — https://www.docker.com/products/docker-desktop (macOS/Windows). On Linux: install Docker Engine.
- **Tailscale** — https://tailscale.com/download. Sign up for a free account.

After installing Tailscale, open the app and sign in. Then install the Tailscale app on your phone too and sign in with the same account. Your phone and laptop are now on the same private network.

### 2. Configure the server

```sh
cd server
cp .env.example .env
```

Open `.env` in any text editor and edit two values:

- **JWT_SECRET** — paste the output of:
  ```sh
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **ALLOWED_ORIGIN** — the URL where your PWA lives. For GitHub Pages: `https://<your-github-username>.github.io`. (No trailing slash.)

Leave the other values at their defaults.

### 3. Start Postgres

```sh
docker compose up -d
```

This downloads Postgres 16 and starts it in the background. Run `docker compose ps` to confirm `lifelog-pg` is `healthy`.

### 4. Install Node deps and apply the schema

```sh
npm install
npm run migrate
```

You should see `[migrate] applying 001_init.sql` followed by `[migrate] done (1 files)`.

### 5. Create your user account

```sh
npm run create-user
```

It'll prompt for an email and password. Both will be visible as you type — that's fine, you're alone at your laptop. The password is hashed with bcrypt before being stored.

You can re-run this any time to change a password (or to add a second user later).

### 6. Front the API with Tailscale (free TLS)

In a separate terminal, leave this running:

```sh
sudo tailscale serve --https=443 --bg http://127.0.0.1:3000
tailscale serve status
```

The status output prints your public URL — something like `https://lifelog-laptop.tail-scales.ts.net`. **Copy that URL** — you'll use it in step 8.

### 7. Run the API

```sh
npm run dev
```

You should see:

```
[realtime] listening on lifelog_changes
[server] listening on http://127.0.0.1:3000
```

Test it: open the URL from step 6 in your phone's browser, append `/api/health`. You should get `{"ok":true,"db":"up"}`.

### 8. Point the PWA at your server

Open `js/config.js` (in the **root** of the repo, not in `server/`) and replace the placeholder URL with the one from step 6:

```js
export const API_BASE = 'https://lifelog-laptop.tail-scales.ts.net';
```

Commit and push. GitHub Pages will redeploy in a minute or two.

### 9. Sign in for the first time

Open the live PWA on your phone or laptop, go to **Settings → Cloud Sync**, enter the email and password you set in step 5, click **Sign in**. The app should load your entries and start syncing.

---

## Migrating existing data from Supabase

If you have entries in your old Supabase project:

1. Open the live PWA → **Settings → Export** → save the JSON file.
2. Run, on your laptop with the server set up:
   ```sh
   npx tsx scripts/import.ts you@example.com /path/to/lifelog_export.json
   ```
   (Use the same email you used for `create-user`.)
3. Sign in to the new backend — your entries should be there.

The importer is idempotent (re-running with the same dump is safe) and won't touch entries belonging to other users.

---

## Day-to-day operation

After a reboot:

```sh
docker compose up -d        # Postgres
npm run dev                 # API
sudo tailscale serve ...    # if it doesn't auto-start
```

Want hands-off start? Wrap `npm run dev` in a launchd / systemd service. (Doc TBD; ask and I'll add one.)

---

## Caveats

- **Laptop sleep stops sync.** When the lid closes, Postgres + the API go down. Entries log offline on devices and resync when you wake the laptop.
- **No backups yet.** Run `pg_dump` on a schedule, or move `pgdata/` to a synced folder. A proper backup story is on the roadmap.
- **No public signup.** New accounts are created only via `npm run create-user`. This is deliberate — for a small self-hosted system, the smaller attack surface is worth the inconvenience.
- **No password reset by email.** If you forget your password, run `npm run create-user` with the same email to set a new one. (Phase 1.5 will introduce end-to-end encryption, after which password recovery will require a recovery code; that's a different document.)
