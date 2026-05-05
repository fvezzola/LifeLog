// Settings panel actions — saving / clearing API keys.

import { state } from './state.js';
import { toast } from './ui.js';

export function saveApiKey() {
  const k = document.getElementById('api-key-input').value.trim();
  if (!k.startsWith('sk-ant-')) { toast('Key should start with sk-ant-'); return; }
  state.apiKey = k;
  localStorage.setItem('ll_key', k);
  document.getElementById('api-key-input').value = '';
  document.getElementById('key-status').textContent = '✓ Key saved';
  toast('API key saved');
}

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
