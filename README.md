# LifeLog PWA

Private, AI-powered life stream. Log anything — Claude auto-builds and evolves your personal taxonomy.

No backend. No accounts. No database. Your entries live in your browser's `localStorage`.

---

## What it does

You dump a thought, a mood, a workout, a meeting note — anything. Claude reads the entry alongside your existing taxonomy and the last few entries, then decides:

- **Assign** it to one of your existing categories
- **Create** a new category when a genuinely new domain appears
- **Suggest** a merge / rename / split when patterns drift

Over time the categories stop being generic and start reflecting *your* life.

### Key features

- **Dynamic taxonomy** — categories evolve from your actual entries, not a fixed list
- **Re-analyze all entries** (Settings) — rebuild the whole taxonomy once you have 20–30 entries logged
- **Voice input** — tap the 🎙 to dictate (Chrome on Android or desktop; iOS Safari is not supported)
- **Reminders** — optional nudge every N minutes
- **Export / import JSON** — move data between devices
- **Offline-capable PWA** — service worker caches the shell

### Keyboard shortcuts

- `Cmd / Ctrl + Enter` — submit entry

---

## API key

Get a key at **console.anthropic.com** and paste it into Settings. It's stored only in your device's `localStorage` and is sent only to Anthropic's API for classification — never anywhere else.

---

## Get the APK (optional)

If you want a real Android app icon instead of the browser PWA install:

1. Open the GitHub Pages URL on your phone in Chrome (or use **Add to Home Screen** for a pure PWA)
2. Or generate a signed APK at **pwabuilder.com** → enter the URL → **Package for stores → Android**
3. Sideload: transfer the APK to your phone → Settings → *Install unknown apps* → install

PWABuilder uses Android's **Trusted Web Activity**, so it's a real signed APK — not a webview wrapper.

---

## Privacy

Entries are sent to Anthropic's API for classification only. They are not persisted server-side by this app. Your API key never leaves your device except in those classification requests.

---

## License

MIT — see [LICENSE](./LICENSE).

> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. Use at your own risk.
