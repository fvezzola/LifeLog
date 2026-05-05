// Shared mutable app state. Imported by every other module.
// Use `state.x = y` to mutate; the binding is shared across modules.

export const state = {
  entries: [],
  taxonomy: {},      // { key: { name, description, icon, color, count } }
  apiKey: '',        // Anthropic
  dgKey: '',         // Deepgram (optional voice fallback)
  browseFilter: 'all',
  isRecording: false,
  voiceFinalText: '',
};

export const CAT_COLORS = [
  '#4a9eff','#e8b84b','#4acd8a','#e05555','#b86cf0',
  '#e87a50','#50c8e8','#a0e050','#e850a0','#50e8b8'
];

export function loadState() {
  state.apiKey  = localStorage.getItem('ll_key') || '';
  state.dgKey   = localStorage.getItem('ll_dg_key') || '';
  state.entries = JSON.parse(localStorage.getItem('ll_entries') || '[]');
  state.taxonomy = JSON.parse(localStorage.getItem('ll_taxonomy') || '{}');
}

export function savePersist() {
  localStorage.setItem('ll_entries', JSON.stringify(state.entries));
  localStorage.setItem('ll_taxonomy', JSON.stringify(state.taxonomy));
}
