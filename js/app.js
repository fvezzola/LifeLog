// App entry point: wires modules together, runs init(), exposes the
// handful of functions still referenced via inline onclick="" in HTML.

import { state, loadState, savePersist, CAT_COLORS, getActiveAiKey } from './state.js';
import {
  toast, showScreen, openSheet, closeSheet,
  renderLog, renderBrowse, renderBrowseChips, renderTaxonomyPills,
  renderTaxonomySuggestion, updateEntryCount, filterBrowse
} from './ui.js';
import { classify, reanalyzeTaxonomy } from './ai.js';
import { initVoice, toggleVoice } from './voice.js';
import { toggleReminder, startReminder } from './reminders.js';
import { deleteEntry, deleteCat, clearAll, exportData, importData, handleImport } from './data.js';
import { saveApiKey, saveGeminiKey, setAiProvider, initAiSettingsUi, saveDgKey, clearDgKey } from './settings.js';
import { initSync, pushEntry, pushTaxonomy } from './sync.js';

// ── Submit (the entry → classify → render → persist flow) ─────────────
async function submitEntry() {
  const ta   = document.getElementById('entry-textarea');
  const text = ta.value.trim();
  if (!text) return;

  const hasAi = !!getActiveAiKey();
  const btn = document.getElementById('sheet-submit');
  btn.disabled = true;
  btn.textContent = hasAi ? '⟳ classifying...' : '⟳ saving...';
  document.getElementById('loading-card').classList.add('visible');

  const wasVoice = state.isRecording || (state.voiceFinalText && text === state.voiceFinalText);
  if (state.isRecording) toggleVoice();

  closeSheet();

  try {
    let key = 'uncategorized';
    let summary = '';
    let tags = [];
    let taxonomySuggestion = null;

    if (hasAi) {
      const result = await classify(text);
      key = result.category_key || 'other';
      summary = result.summary || '';
      tags = result.tags || [];
      taxonomySuggestion = result.taxonomy_suggestion || null;

      if (result.is_new && result.new_category) {
        const colorIdx = Object.keys(state.taxonomy).length % CAT_COLORS.length;
        state.taxonomy[key] = {
          name:        result.new_category.name || key,
          description: result.new_category.description || '',
          icon:        result.new_category.icon || '◆',
          color:       CAT_COLORS[colorIdx],
          count:       0
        };
      }
    }

    if (state.taxonomy[key]) state.taxonomy[key].count = (state.taxonomy[key].count || 0) + 1;

    const entry = {
      id:        Date.now().toString(),
      text,
      category:  key,
      summary,
      tags,
      timestamp: new Date().toISOString(),
      source:    wasVoice ? 'voice' : 'text'
    };

    state.entries.unshift(entry);
    savePersist();

    ta.value = '';
    state.voiceFinalText = '';

    pushEntry(entry);                 // fire-and-forget cloud upsert
    pushTaxonomy();                   // count changed; refresh remote blob

    if (taxonomySuggestion) renderTaxonomySuggestion(taxonomySuggestion);

    if (hasAi) toast(`→ ${state.taxonomy[key]?.name || key}`);
    else toast('Saved (add API key in Settings to auto-categorize)');
  } catch (e) {
    toast('Error: ' + e.message);
    console.error(e);
  }

  document.getElementById('loading-card').classList.remove('visible');
  btn.disabled = false;
  btn.textContent = 'Log it →';
  renderLog();
}

// ── Init ──────────────────────────────────────────────────────────────
function init() {
  loadState();

  initAiSettingsUi();
  if (state.dgKey) document.getElementById('dg-key-status').textContent = '✓ Deepgram key saved — voice will use Deepgram';

  const remMins = localStorage.getItem('ll_remindermins') || '120';
  const remOn   = localStorage.getItem('ll_reminderon') === 'true';
  document.getElementById('reminder-mins').value = remMins;
  if (remOn) { document.getElementById('reminder-toggle').checked = true; startReminder(); }

  initVoice();
  renderLog();
  renderTaxonomyPills();
  updateEntryCount();

  document.getElementById('entry-textarea').addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitEntry();
  });

  document.getElementById('reminder-mins').addEventListener('change', () => {
    if (document.getElementById('reminder-toggle').checked) startReminder();
  });

  initSync();
}

// ── Expose for inline HTML onclick handlers ───────────────────────────
// Inline onclick attributes can only see global identifiers; ES module
// scope is local. Bind the handful that HTML references directly.
Object.assign(window, {
  showScreen, openSheet, closeSheet, submitEntry, toggleVoice,
  saveApiKey, saveGeminiKey, setAiProvider, saveDgKey, clearDgKey, reanalyzeTaxonomy,
  toggleReminder, exportData, importData, handleImport, clearAll,
  deleteEntry, deleteCat, filterBrowse,
});

// Service Worker registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
