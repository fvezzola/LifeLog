// Thin client for the self-hosted LifeLog backend. Replaces the
// supabase-js usage that lived inside js/sync.js.
//
// Auth: the server sets an httpOnly cookie on /api/auth/verify, so all
// requests just include credentials. There's no token to manage from JS.
//
// Realtime: a single EventSource on /api/stream pushes 'change' events.
// js/sync.js subscribes and applies them to local state.

import { API_BASE } from './config.js';

async function req(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (res.status === 401) {
    const err = new Error('unauthorized');
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error || ''; } catch {}
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────
export async function requestMagicLink(email) {
  return req('/api/auth/magic-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function signOutRemote() {
  return req('/api/auth/logout', { method: 'POST' });
}

export async function getMe() {
  try { return await req('/api/me'); }
  catch (e) { if (e.status === 401) return null; throw e; }
}

// ── Entries ──────────────────────────────────────────────────────────
export async function listEntries() {
  return req('/api/entries');
}

export async function upsertEntries(entries) {
  return req('/api/entries', {
    method: 'POST',
    body: JSON.stringify(entries),
  });
}

export async function deleteEntry(id) {
  return req(`/api/entries/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── App state (taxonomy blob) ───────────────────────────────────────
export async function getAppState() {
  return req('/api/app_state');
}

export async function putAppState(taxonomy) {
  return req('/api/app_state', {
    method: 'PUT',
    body: JSON.stringify({ taxonomy }),
  });
}

// ── Realtime ────────────────────────────────────────────────────────
// Returns an unsubscribe function. The EventSource auto-reconnects on
// transient drops; we surface fatal errors via the onError callback.
export function subscribeChanges(onChange, onError) {
  const es = new EventSource(`${API_BASE}/api/stream`, { withCredentials: true });
  es.addEventListener('change', ev => {
    try { onChange(JSON.parse(ev.data)); }
    catch (err) { console.warn('[api] bad change payload', err); }
  });
  es.addEventListener('error', err => {
    if (es.readyState === EventSource.CLOSED) onError?.(err);
  });
  return () => es.close();
}
