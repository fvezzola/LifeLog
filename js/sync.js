// Cloud sync against the self-hosted LifeLog backend (server/).
// Magic-link auth, entries CRUD, taxonomy blob, realtime via SSE.
// No-op when not signed in, so the app keeps working in pure-localStorage
// mode.

import * as api from './api.js';
import { state, savePersist } from './state.js';
import {
  toast, renderLog, renderTaxonomyPills, renderBrowse,
  renderBrowseChips, updateEntryCount,
} from './ui.js';

let currentUser = null;
let unsubscribeStream = null;

// ── Bootstrap ─────────────────────────────────────────────────────────
export async function initSync() {
  // Wire Settings buttons regardless of auth state.
  const signinBtn  = document.getElementById('sync-signin-btn');
  const signoutBtn = document.getElementById('sync-signout-btn');
  if (signinBtn)  signinBtn.addEventListener('click', sendMagicLink);
  if (signoutBtn) signoutBtn.addEventListener('click', signOut);

  // On load, ask the server whether we're signed in (cookie may have
  // been set by /api/auth/verify on a previous visit).
  try {
    currentUser = await api.getMe();
  } catch (err) {
    console.warn('[sync] /api/me failed', err);
    currentUser = null;
  }
  updateSyncUi();

  if (currentUser) {
    await initialSync();
    subscribeRealtime();
  }
}

// ── Auth ──────────────────────────────────────────────────────────────
async function sendMagicLink() {
  const email = document.getElementById('sync-email').value.trim();
  if (!email || !email.includes('@')) { toast('Enter a valid email'); return; }
  setSyncStatus('sending magic link...');
  try {
    await api.requestMagicLink(email);
    setSyncStatus(`✓ link sent to ${email} — check your inbox / server logs`);
    toast('Magic link sent');
  } catch (err) {
    toast(`Sign-in failed: ${err.message}`);
    setSyncStatus('');
  }
}

async function signOut() {
  unsubscribeRealtime();
  try { await api.signOutRemote(); } catch (err) { console.warn('[sync] signOut', err); }
  currentUser = null;
  updateSyncUi();
  toast('Signed out — local data preserved');
}

export function isSignedIn() { return !!currentUser; }
export function getUser()    { return currentUser; }

// ── Mutation hooks (called from data.js / app.js) ─────────────────────
export async function pushEntry(entry) {
  if (!currentUser) return;
  try { await api.upsertEntries(entry); markSynced(); }
  catch (err) { console.warn('[sync] pushEntry', err); }
}

export async function deleteEntryRemote(id) {
  if (!currentUser) return;
  try { await api.deleteEntry(id); markSynced(); }
  catch (err) { console.warn('[sync] deleteEntryRemote', err); }
}

export async function pushTaxonomy() {
  if (!currentUser) return;
  try { await api.putAppState(state.taxonomy); markSynced(); }
  catch (err) { console.warn('[sync] pushTaxonomy', err); }
}

// ── Initial sync on sign-in ──────────────────────────────────────────
async function initialSync() {
  setSyncStatus('syncing...');
  try {
    const [remoteEntries, remoteState] = await Promise.all([
      api.listEntries(),
      api.getAppState(),
    ]);

    const remoteIds = new Set(remoteEntries.map(e => e.id));
    const localOnly = state.entries.filter(e => !remoteIds.has(e.id));

    if (localOnly.length) {
      await api.upsertEntries(localOnly);
    }

    state.entries = [...remoteEntries, ...localOnly]
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    if (remoteState && remoteState.taxonomy && Object.keys(remoteState.taxonomy).length) {
      state.taxonomy = remoteState.taxonomy;
    } else if (Object.keys(state.taxonomy).length) {
      await pushTaxonomy();
    }

    savePersist();
    renderLog();
    renderTaxonomyPills();
    renderBrowse();
    renderBrowseChips();
    updateEntryCount();
    markSynced();
  } catch (err) {
    console.error('[sync] initialSync failed', err);
    toast(`Sync failed: ${err.message}`);
    setSyncStatus('sync error — see console');
  }
}

// ── Realtime: react to changes from other devices ─────────────────────
function subscribeRealtime() {
  if (unsubscribeStream) return;
  unsubscribeStream = api.subscribeChanges(
    payload => applyChange(payload),
    err => {
      console.warn('[sync] stream closed', err);
      unsubscribeStream = null;
      setSyncStatus('disconnected — retrying...');
      // EventSource auto-reconnects; if it gives up we re-establish.
      setTimeout(() => { if (currentUser && !unsubscribeStream) subscribeRealtime(); }, 3000);
    },
  );
}

function unsubscribeRealtime() {
  if (unsubscribeStream) { unsubscribeStream(); unsubscribeStream = null; }
}

function applyChange(payload) {
  const { table, op, row } = payload;
  if (table === 'entries') {
    if (op === 'INSERT' || op === 'UPDATE') {
      const idx = state.entries.findIndex(e => e.id === row.id);
      if (idx >= 0) state.entries[idx] = row;
      else state.entries.unshift(row);
    } else if (op === 'DELETE') {
      state.entries = state.entries.filter(e => e.id !== row.id);
    }
    savePersist();
    renderLog();
    renderBrowse();
    updateEntryCount();
    markSynced();
  } else if (table === 'app_state') {
    if (row.taxonomy) {
      state.taxonomy = row.taxonomy;
      savePersist();
      renderTaxonomyPills();
      renderLog();
      renderBrowseChips();
      markSynced();
    }
  }
}

// ── UI plumbing ───────────────────────────────────────────────────────
function updateSyncUi() {
  const signedOut = document.getElementById('sync-signed-out');
  const signedIn  = document.getElementById('sync-signed-in');
  const emailEl   = document.getElementById('sync-user-email');
  if (!signedOut || !signedIn) return;
  if (currentUser) {
    signedOut.style.display = 'none';
    signedIn.style.display  = '';
    if (emailEl) emailEl.textContent = currentUser.email || '(no email)';
  } else {
    signedOut.style.display = '';
    signedIn.style.display  = 'none';
    setSyncStatus('');
  }
}

function setSyncStatus(text) {
  const el = document.getElementById('sync-status');
  if (el) el.textContent = text;
}

function markSynced() {
  setSyncStatus('✓ synced');
}
