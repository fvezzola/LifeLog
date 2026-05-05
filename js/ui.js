// DOM rendering + UI primitives. No business logic.

import { state } from './state.js';

export function toast(msg, duration = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), duration);
}

export function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function showScreen(name) {
  ['log','browse','settings'].forEach(s => {
    document.getElementById('screen-' + s).classList.remove('active-screen');
    document.getElementById('tab-' + s).classList.remove('active');
  });
  document.getElementById('screen-' + name).classList.add('active-screen');
  document.getElementById('tab-' + name).classList.add('active');

  if (name === 'browse')   { renderBrowseChips(); renderBrowse(); }
  if (name === 'settings') { renderTaxonomyPills(); updateEntryCount(); }

  document.getElementById('fab').style.display = (name === 'log') ? 'flex' : 'none';
}

export function openSheet() {
  document.getElementById('input-sheet').classList.add('open');
  document.getElementById('sheet-overlay').classList.add('visible');
  setTimeout(() => document.getElementById('entry-textarea').focus(), 350);
}

export function closeSheet() {
  document.getElementById('input-sheet').classList.remove('open');
  document.getElementById('sheet-overlay').classList.remove('visible');
  // Stop voice via the global binding to avoid a circular import with voice.js
  if (state.isRecording && window.toggleVoice) window.toggleVoice();
}

export function setMicState(on) {
  ['mic-btn','sheet-mic'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = on ? '⏹' : '🎙';
    el.classList.toggle('recording', on);
  });
}

export function renderLog() {
  const feed = document.getElementById('entry-feed');
  feed.querySelectorAll('.entry-card,.evo-badge,.tax-notice').forEach(el => el.remove());

  if (!state.entries.length) {
    document.getElementById('empty-state').classList.add('visible');
    return;
  }
  document.getElementById('empty-state').classList.remove('visible');
  state.entries.forEach(e => feed.appendChild(makeCard(e)));
}

export function renderBrowseChips() {
  const scroll = document.getElementById('cat-chips-scroll');
  scroll.innerHTML = '';

  const allChip = document.createElement('div');
  allChip.className = 'filter-chip' + (state.browseFilter === 'all' ? ' active' : '');
  allChip.dataset.cat = 'all';
  allChip.textContent = 'All';
  allChip.onclick = () => filterBrowse('all', allChip);
  scroll.appendChild(allChip);

  Object.entries(state.taxonomy).forEach(([key, cat]) => {
    const chip = document.createElement('div');
    chip.className = 'filter-chip' + (state.browseFilter === key ? ' active' : '');
    chip.dataset.cat = key;
    chip.onclick = () => filterBrowse(key, chip);
    chip.textContent = `${cat.icon} ${cat.name}`;
    scroll.appendChild(chip);
  });
}

export function filterBrowse(cat, el) {
  state.browseFilter = cat;
  document.querySelectorAll('#cat-chips-scroll .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderBrowse();
}

export function renderBrowse() {
  const feed   = document.getElementById('browse-feed');
  const search = document.getElementById('search-input').value.toLowerCase();
  feed.innerHTML = '';

  const filtered = state.entries.filter(e => {
    const catOk  = state.browseFilter === 'all' || e.category === state.browseFilter;
    const textOk = !search || e.text.toLowerCase().includes(search) ||
                   (e.summary || '').toLowerCase().includes(search) ||
                   (e.tags || []).some(t => t.toLowerCase().includes(search));
    return catOk && textOk;
  });

  if (!filtered.length) {
    feed.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:20px;text-align:center">No entries found.</div>';
    return;
  }
  filtered.forEach(e => feed.appendChild(makeCard(e)));
}

export function makeCard(entry) {
  const card  = document.createElement('div');
  card.className = 'entry-card';

  const cat   = state.taxonomy[entry.category] || { name: entry.category, icon: '◆', color: '#7a8a9a' };
  const dt    = new Date(entry.timestamp);
  const timeStr = dt.toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  const tags  = (entry.tags || []).map(t => `<span class="card-tag">${escHtml(t)}</span>`).join('');
  const srcBadge = entry.source === 'voice' ? '<span class="card-source">🎙</span>' : '';

  card.innerHTML = `
    <div class="card-top">
      <span class="cat-chip" style="color:${cat.color};border-color:${cat.color}">${cat.icon} ${cat.name}</span>
      <span class="card-time">${timeStr}</span>${srcBadge}
      <button class="card-delete" onclick="deleteEntry('${entry.id}')">×</button>
    </div>
    ${entry.summary ? `<div class="card-summary">${escHtml(entry.summary)}</div>` : ''}
    <div class="card-body">${escHtml(entry.text)}</div>
    ${tags ? `<div class="card-tags">${tags}</div>` : ''}
  `;
  return card;
}

export function renderTaxonomyPills() {
  const container = document.getElementById('taxonomy-pills');
  container.innerHTML = '';
  if (!Object.keys(state.taxonomy).length) {
    container.innerHTML = '<span style="color:var(--muted);font-size:11px">No categories yet. Start logging.</span>';
    return;
  }
  Object.entries(state.taxonomy).forEach(([key, cat]) => {
    const pill = document.createElement('div');
    pill.className = 'tax-pill';
    pill.innerHTML = `
      <span style="color:${cat.color}">${cat.icon}</span>
      <span>${cat.name}</span>
      <span style="color:var(--muted);font-size:9px">${cat.count}</span>
      <button class="tax-pill-delete" onclick="deleteCat('${key}')">×</button>
    `;
    container.appendChild(pill);
  });
}

export function renderTaxonomySuggestion(suggestion) {
  const feed = document.getElementById('entry-feed');
  const card = document.createElement('div');
  card.className = 'tax-notice';
  card.innerHTML = `
    <strong>✦ Taxonomy insight</strong><br>
    ${escHtml(suggestion.description)}
    <br><button class="tax-apply-btn" onclick="this.parentElement.remove()">Dismiss</button>
  `;
  const loadingCard = document.getElementById('loading-card');
  feed.insertBefore(card, loadingCard.nextSibling);
}

export function updateEntryCount() {
  const el = document.getElementById('entry-count-display');
  if (el) el.textContent = `${state.entries.length} entries · ${Object.keys(state.taxonomy).length} categories`;
}
