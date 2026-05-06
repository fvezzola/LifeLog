// Cloud sync: Supabase auth (magic link) + entries CRUD + realtime
// subscription. No-op when the user isn't signed in, so the app keeps
// working in pure-localStorage mode.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { state, savePersist } from './state.js';
import {
  toast, renderLog, renderTaxonomyPills, renderBrowse,
  renderBrowseChips, updateEntryCount
} from './ui.js';

let client       = null;
let currentUser  = null;
let realtimeCh   = null;
let lastSyncMs   = 0;

// ── Bootstrap ─────────────────────────────────────────────────────────
export async function initSync() {
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  // React to sign-in / sign-out (including magic-link redirects)
  client.auth.onAuthStateChange(async (event, session) => {
    console.log('[sync] auth event:', event, 'user:', session?.user?.email || null);
    currentUser = session?.user || null;
    updateSyncUi();
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (currentUser) {
        await initialSync();
        subscribeRealtime();
      }
    }
    if (event === 'SIGNED_OUT') {
      unsubscribeRealtime();
    }
  });

  // Wire up the Settings UI buttons
  const signinBtn = document.getElementById('sync-signin-btn');
  const signoutBtn = document.getElementById('sync-signout-btn');
  if (signinBtn)  signinBtn.addEventListener('click', sendMagicLink);
  if (signoutBtn) signoutBtn.addEventListener('click', signOut);
}

// ── Auth ──────────────────────────────────────────────────────────────
async function sendMagicLink() {
  const email = document.getElementById('sync-email').value.trim();
  if (!email || !email.includes('@')) { toast('Enter a valid email'); return; }
  setSyncStatus('sending magic link...');
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href }
  });
  if (error) { toast(`Sign-in failed: ${error.message}`); setSyncStatus(''); return; }
  setSyncStatus(`✓ link sent to ${email} — check your inbox`);
  toast('Magic link sent');
}

async function signOut() {
  unsubscribeRealtime();
  await client.auth.signOut();
  toast('Signed out — local data preserved');
}

export function isSignedIn() { return !!currentUser; }
export function getUser()    { return currentUser; }

// ── Mutation hooks (called from data.js / app.js) ─────────────────────
export async function pushEntry(entry) {
  if (!currentUser || !client) return;
  const row = { ...entry, user_id: currentUser.id };
  const { error } = await client.from('entries').upsert(row);
  if (error) console.warn('[sync] pushEntry', error);
  else markSynced();
}

export async function deleteEntryRemote(id) {
  if (!currentUser || !client) return;
  const { error } = await client.from('entries').delete().eq('id', id);
  if (error) console.warn('[sync] deleteEntryRemote', error);
  else markSynced();
}

export async function pushTaxonomy() {
  if (!currentUser || !client) return;
  const { error } = await client.from('app_state').upsert({
    user_id:    currentUser.id,
    taxonomy:   state.taxonomy,
    updated_at: new Date().toISOString()
  });
  if (error) console.warn('[sync] pushTaxonomy', error);
  else markSynced();
}

// ── Initial sync on sign-in ──────────────────────────────────────────
async function initialSync() {
  console.log('[sync] initialSync: starting, user.id =', currentUser?.id);
  setSyncStatus('syncing...');
  try {
    console.log('[sync] initialSync: firing entries + app_state queries...');
    const [entriesRes, stateRes] = await Promise.all([
      client.from('entries').select('*').order('timestamp', { ascending: false }),
      client.from('app_state').select('*').eq('user_id', currentUser.id).maybeSingle()
    ]);
    console.log('[sync] initialSync: queries resolved', {
      entriesError: entriesRes.error,
      entriesCount: entriesRes.data?.length,
      stateError: stateRes.error,
      stateData:   stateRes.data
    });
    if (entriesRes.error) throw entriesRes.error;

    const remoteEntries = entriesRes.data || [];
    const remoteIds = new Set(remoteEntries.map(e => e.id));
    const localOnly = state.entries.filter(e => !remoteIds.has(e.id));

    // Push local-only entries to remote
    if (localOnly.length) {
      const rows = localOnly.map(e => ({ ...e, user_id: currentUser.id }));
      const { error } = await client.from('entries').upsert(rows);
      if (error) throw error;
    }

    // Merged set: remote + local-only, sorted newest-first
    state.entries = [...remoteEntries, ...localOnly]
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    // Taxonomy: remote takes precedence if it has data; otherwise push local up.
    const remoteState = stateRes.data;
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

// ── Realtime: react to inserts / updates / deletes from other devices ─
function subscribeRealtime() {
  if (!currentUser || realtimeCh) return;
  realtimeCh = client
    .channel('lifelog-' + currentUser.id)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${currentUser.id}` },
      payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new;
          const idx = state.entries.findIndex(e => e.id === row.id);
          if (idx >= 0) state.entries[idx] = row;
          else state.entries.unshift(row);
        } else if (payload.eventType === 'DELETE') {
          state.entries = state.entries.filter(e => e.id !== payload.old.id);
        }
        savePersist();
        renderLog();
        renderBrowse();
        updateEntryCount();
        markSynced();
      })
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'app_state', filter: `user_id=eq.${currentUser.id}` },
      payload => {
        if (payload.new && payload.new.taxonomy) {
          state.taxonomy = payload.new.taxonomy;
          savePersist();
          renderTaxonomyPills();
          renderLog();
          renderBrowseChips();
          markSynced();
        }
      })
    .subscribe();
}

function unsubscribeRealtime() {
  if (realtimeCh) {
    client.removeChannel(realtimeCh);
    realtimeCh = null;
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
  lastSyncMs = Date.now();
  setSyncStatus('✓ synced');
}
