# LifeLog server

Self-hosted backend for LifeLog. Hono + Postgres, exposed to your other devices via Tailscale Serve. Replaces Supabase. **The same server hosts the PWA itself**, so everything lives on one URL — you don't need GitHub Pages anymore, and the GitHub repo can be private.

No third-party services for auth or email. Accounts are created via a local CLI command; you sign in with email + password.

---

## What's here

- `src/` — Hono API: password auth (JWT cookie), entries CRUD, taxonomy blob, SSE realtime, static-file serving for the PWA.
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

Open `.env` and edit one value:

- **JWT_SECRET** — paste the output of:
  ```sh
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

Leave everything else at defaults.

### 3. Start Postgres

```sh
docker compose up -d
```

This downloads Postgres 16 (~150 MB, one-time) and runs it in the background. Confirm:

```sh
docker compose ps
```

`lifelog-pg` should show `(healthy)`.

### 4. Install Node deps and apply the schema

```sh
npm install
npm run migrate
```

You should see `[migrate] applying 001_init.sql` then `[migrate] done (1 files)`.

### 5. Create your user account

```sh
npm run create-user
```

It'll prompt for an email and password. Both will be visible as you type — that's fine, you're alone at your laptop. The password is hashed with bcrypt before being stored.

Re-run this any time to change a password (or to add a second user later).

### 6. Front the API + PWA with Tailscale (free TLS)

In a separate terminal, leave this running:

```sh
sudo tailscale serve --https=443 --bg http://127.0.0.1:3000
tailscale serve status
```

The status output prints your public URL — something like `https://lifelog-laptop.tail-scales.ts.net`. **That single URL serves both the PWA and the API.** Bookmark it on your phone — that's the app from now on.

### 7. Run the server

```sh
npm run dev
```

You should see:

```
[realtime] listening on lifelog_changes
[server] listening on http://127.0.0.1:3000
```

### 8. Sign in

Open your tailnet URL (from step 6) in any browser on any device on the tailnet. The PWA loads. Go to **Settings → Cloud Sync**, enter the email + password from step 5, click **Sign in**.

That's it — your entries are now syncing through your own server.

---

## Migrating existing data from Supabase

If you have entries in your old Supabase project:

1. Open the live PWA (the old GitHub Pages version, while it's still up) → Settings → Export → save the JSON file.
2. On your laptop, with the server set up:
   ```sh
   cd server
   npx tsx scripts/import.ts you@example.com /path/to/lifelog_export.json
   ```
   Use the same email you used in step 5 of setup.
3. Sign in to your tailnet URL — your entries should be there.

The importer is idempotent (re-running with the same dump is safe).

---

## Making the GitHub repo private

Once you're running off your laptop, you can flip the repo to private:

1. GitHub → repo Settings → "Change repository visibility" → Private.
2. GitHub Pages will stop serving — that's expected, you don't need it anymore.
3. The PWA continues to work because your laptop is now hosting it. Update any old bookmarks pointing at `*.github.io` to your tailnet URL.

If you ever need to clone the repo on a new machine, you'll need a personal access token or SSH key for GitHub auth — same as any private repo.

---

## Day-to-day operation

After a reboot:

```sh
cd LifeLog/server
docker compose up -d        # Postgres
npm run dev                 # API + PWA
```

Tailscale Serve is sticky and usually comes back automatically. If your tailnet URL stops resolving, re-run the `tailscale serve` command from step 6.

Want it to all auto-start on login? Say the word and I'll add a launchd / systemd service.

---

## Caveats

- **Laptop sleep stops the app.** When the lid closes, Postgres + the API go down. Entries log offline on devices and resync when you wake the laptop. Move to an always-on box (Raspberry Pi, mini-PC, or VPS) when this becomes annoying.
- **No backups yet.** Run `pg_dump` on a schedule, or move `pgdata/` to a synced folder. A proper backup story is on the roadmap.
- **No public signup endpoint.** New accounts come only from `npm run create-user`. Smaller attack surface for a small self-hosted system.
- **No password reset by email.** Forgot your password → re-run `npm run create-user` with the same email. Phase 1.5 introduces end-to-end encryption, where recovery uses a recovery code instead.
- **Local browser access via `http://127.0.0.1:3000` won't sign in** — auth cookies require HTTPS, so use your tailnet URL even from the laptop itself.
