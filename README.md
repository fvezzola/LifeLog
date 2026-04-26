# LifeLog PWA

Private, AI-powered life stream. Log anything — Claude auto-builds and evolves your personal taxonomy.

---

## Files
```
lifelog-pwa/
├── index.html     ← main app
├── manifest.json  ← PWA config
├── sw.js          ← service worker (offline support)
└── README.md
```

You also need two icon files (any square image, renamed):
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

---

## Option A — Use in Browser Right Now (no hosting needed)

Chrome/Edge can install a local PWA with a flag:
1. Open Chrome, go to `chrome://flags`
2. Enable **"Unsafely treat insecure origin as secure"**
3. Add `file:///path/to/lifelog-pwa/index.html`
4. Open the file, then install from Chrome menu

Or just open `index.html` in Chrome directly — it works without the PWA layer.

---

## Option B — Host on GitHub Pages (Free, 5 min) → Best for APK

### Step 1: GitHub Pages

1. Create a free account at **github.com**
2. New repository → name it `lifelog` → set to **Public**
3. Upload all files from this folder
4. Go to repo **Settings → Pages → Source → main branch → Save**
5. Your app is live at: `https://YOUR_USERNAME.github.io/lifelog/`

### Step 2: Install on Android (Chrome)

1. Open your GitHub Pages URL in Chrome on your phone
2. Wait 30 seconds for the app to load
3. Tap Chrome menu (⋮) → **"Add to Home Screen"** or **"Install app"**
4. Done — it's on your home screen like a native app

### Step 3: Get a Real APK (Optional)

1. Go to **pwabuilder.com**
2. Enter your GitHub Pages URL
3. Click **"Package for stores"** → Android
4. Download the generated APK
5. Sideload it: transfer to phone → Settings → Install unknown apps → install

The PWABuilder APK uses Android's **Trusted Web Activity** — it's a real signed APK, not a webview wrapper.

---

## API Key

Get a free Anthropic API key at **console.anthropic.com** (you pay per use, very cheap).
Enter it in Settings → it stays only in your device's localStorage, never sent anywhere except Anthropic's API for classification.

---

## How the Dynamic Taxonomy Works

On each entry, Claude receives:
- The new entry text
- Your full current taxonomy (categories + descriptions + counts)
- The last 5 entries as context

It then decides:
- **Assign** to an existing category (most common)
- **Create** a new category (when a genuinely new life domain appears)
- **Suggest** a taxonomy optimization (merge, rename, split) when it spots patterns

Over time, the categories stop being generic and become yours — shaped by your actual life patterns.

Use **"Re-analyze all entries"** in Settings to have Claude rebuild the entire taxonomy from scratch after you've logged 20–30 entries. This is the most powerful way to let the AI learn your patterns.

---

## Keyboard Shortcuts

- `Cmd/Ctrl + Enter` → Submit entry (desktop)

---

## Data

All data lives in your browser's **localStorage**. Export to JSON anytime from Settings. Import it back if you switch devices or browsers.

---

## Privacy

Your entries go to Anthropic's API for classification only. They are not stored anywhere else.
Your API key is stored only in your device's localStorage.
This app has no backend, no database, no accounts.
