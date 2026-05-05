// Entry / category mutations + JSON export/import.

import { state, savePersist } from './state.js';
import { toast, renderLog, renderBrowse, renderTaxonomyPills, updateEntryCount } from './ui.js';

export function deleteEntry(id) {
  const e = state.entries.find(e => e.id === id);
  if (e && state.taxonomy[e.category]) {
    state.taxonomy[e.category].count = Math.max(0, state.taxonomy[e.category].count - 1);
  }
  state.entries = state.entries.filter(e => e.id !== id);
  savePersist();
  renderLog();
  renderBrowse();
  updateEntryCount();
}

export function deleteCat(key) {
  if (!confirm(`Remove category "${state.taxonomy[key]?.name}"? Entries keep their tag.`)) return;
  delete state.taxonomy[key];
  savePersist();
  renderTaxonomyPills();
}

export function clearAll() {
  if (confirm('Delete everything? This cannot be undone.')) {
    state.entries = [];
    state.taxonomy = {};
    savePersist();
    renderLog();
    renderTaxonomyPills();
    updateEntryCount();
  }
}

export function exportData() {
  const blob = new Blob([JSON.stringify({
    exported: new Date().toISOString(),
    taxonomy: state.taxonomy,
    entries:  state.entries
  }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `lifelog_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

export function importData() { document.getElementById('import-file').click(); }

export function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.entries) {
        state.entries  = data.entries;
        state.taxonomy = data.taxonomy || state.taxonomy;
        savePersist();
        renderLog();
        renderTaxonomyPills();
        toast(`Imported ${state.entries.length} entries`);
      }
    } catch { toast('Invalid JSON file'); }
  };
  reader.readAsText(file);
}
