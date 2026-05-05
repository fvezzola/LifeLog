// Settings panel actions — saving / clearing API keys, picking AI provider.

import { state } from './state.js';
import { toast } from './ui.js';

// ── AI provider switcher ─────────────────────────────────────────────
export function setAiProvider(provider) {
  if (provider !== 'anthropic' && provider !== 'gemini') return;
  state.aiProvider = provider;
  localStorage.setItem('ll_ai_provider', provider);
  updateAiUi();
}

export function initAiSettingsUi() {
  const sel = document.getElementById('ai-provider-select');
  if (sel) {
    sel.value = state.aiProvider;
    sel.addEventListener('change', e => setAiProvider(e.target.value));
  }
  updateAiUi();
}

function updateAiUi() {
  const anth = document.getElementById('anthropic-key-row');
  const gem  = document.getElementById('gemini-key-row');
  if (anth) anth.style.display = state.aiProvider === 'anthropic' ? '' : 'none';
  if (gem)  gem.style.display  = state.aiProvider === 'gemini'    ? '' : 'none';

  const anthStatus = document.getElementById('key-status');
  const gemStatus  = document.getElementById('gemini-key-status');
  if (anthStatus) anthStatus.textContent = state.anthropicKey ? '✓ Anthropic key saved' : '';
  if (gemStatus)  gemStatus.textContent  = state.geminiKey    ? '✓ Gemini key saved'    : '';
}

// ── Anthropic ────────────────────────────────────────────────────────
export function saveApiKey() {
  const k = document.getElementById('api-key-input').value.trim();
  if (!k.startsWith('sk-ant-')) { toast('Anthropic key should start with sk-ant-'); return; }
  state.anthropicKey = k;
  localStorage.setItem('ll_key', k);
  document.getElementById('api-key-input').value = '';
  document.getElementById('key-status').textContent = '✓ Anthropic key saved';
  toast('Anthropic key saved');
}

// ── Gemini ───────────────────────────────────────────────────────────
export function saveGeminiKey() {
  const k = document.getElementById('gemini-key-input').value.trim();
  if (!k) { toast('Paste a Gemini key first'); return; }
  state.geminiKey = k;
  localStorage.setItem('ll_gemini_key', k);
  document.getElementById('gemini-key-input').value = '';
  document.getElementById('gemini-key-status').textContent = '✓ Gemini key saved';
  toast('Gemini key saved');
}

// ── Deepgram (voice) ─────────────────────────────────────────────────
export function saveDgKey() {
  const k = document.getElementById('dg-key-input').value.trim();
  if (!k) { toast('Paste a Deepgram key first'); return; }
  state.dgKey = k;
  localStorage.setItem('ll_dg_key', k);
  document.getElementById('dg-key-input').value = '';
  document.getElementById('dg-key-status').textContent = '✓ Deepgram key saved — voice will use Deepgram';
  toast('Deepgram key saved');
}

export function clearDgKey() {
  state.dgKey = '';
  localStorage.removeItem('ll_dg_key');
  document.getElementById('dg-key-input').value = '';
  document.getElementById('dg-key-status').textContent = '';
  toast('Deepgram key cleared — voice will use the browser');
}
