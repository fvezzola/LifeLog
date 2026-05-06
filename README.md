# LifeLog PWA

Private, AI-powered life stream. Log anything — an AI auto-builds and evolves your personal taxonomy. Entries sync across devices in real time when signed in; the app keeps working offline.

---

## What it does

You dump a thought, a mood, a workout, a meeting note — anything. The AI reads the entry alongside your existing taxonomy and the last few entries, then decides:

- **Assign** it to one of your existing categories
- **Create** a new category when a genuinely new domain appears
- **Suggest** a merge / rename / split when patterns drift

Over time the categories stop being generic and start reflecting *your* life.

If you don't add an AI key, entries still save — they just land in `uncategorized` until you add a key and re-analyze.

### Key features

- **Dynamic taxonomy** — categories evolve from your actual entries, not a fixed list
- **Pluggable AI** — pick Anthropic (Claude, paid) or Google Gemini (free tier on `gemini-2.5-flash`) in Settings; both are optional
- **Cloud sync** — magic-link sign-in via Supabase, real-time across phone + desktop, full offline fallback to localStorage
- **Re-analyze all entries** (Settings) — rebuild the whole taxonomy once you have 20–30 entries logged
- **Voice input** — Web Speech API on Chrome/Edge, automatic Deepgram WebSocket fallback if you save a Deepgram key
- **Reminders** — optional nudge every N minutes
- **Export / import JSON** — manual data portability
- **PWA** — installable, service worker caches the shell

### Keyboard shortcuts

- `Cmd / Ctrl + Enter` — submit entry

---

## Setup

### 1. AI (optional)

Open **Settings → AI Provider** and pick one:

- **Anthropic (Claude)** — paid, ~$0.003 per entry. Get a key at [console.anthropic.com](https://console.anthropic.com).
- **Google (Gemini)** — free tier covers normal use (15 req/min, 1500/day). Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

Keys are stored in your device's `localStorage` and sent only to the provider you selected.

### 2. Cloud sync (optional)

Run [`supabase_schema.sql`](./supabase_schema.sql) once in your Supabase project's SQL Editor (Project → SQL Editor → New query → paste → Run). Then add your project's URL and anon key to [`js/config.js`](./js/config.js).

In the app, **Settings → Cloud Sync** → enter your email → click the magic link in your inbox. Entries flow between devices in real time afterward.

If you skip this step the app still works — everything stays in `localStorage`.

### 3. Voice fallback (optional)

Web Speech works in Chrome/Edge out of the box. For Firefox, Brave, Opera, etc., paste a [Deepgram](https://console.deepgram.com) key in Settings → Voice Fallback. Free $200 credit, no card required.

---

## Get an Android app

1. Open the GitHub Pages URL on your phone in Chrome → **Add to Home Screen** (pure PWA)
2. Or generate a signed APK at [pwabuilder.com](https://www.pwabuilder.com) → enter the URL → **Package for stores → Android**

PWABuilder uses Android's **Trusted Web Activity**, so it's a real signed APK — not a webview wrapper.

A native Capacitor wrap (Android + iOS App Store) is on the roadmap.

---

## Roadmap

The app is moving toward a self-hosted backend (Postgres + small Hono server) replacing Supabase, so all data and API keys can live on your own machine. After that: domain-specific tabs (Health / Sleep / Exercise / etc.), AI-customizable layouts, and Capacitor-wrapped mobile apps. See the planning notes for details.

---

## Privacy

- **Entry text** is sent to whichever AI provider you've configured (Anthropic or Gemini) for classification only.
- **Entries** are stored in your browser's `localStorage` and, if you sign in, in your Supabase project where row-level security restricts every row to your user.
- **API keys** stay on your device and are sent only to the provider they belong to.

---

## License

MIT — see [LICENSE](./LICENSE).

> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. Use at your own risk.
