// Voice input — Web Speech API (free, Chrome/Edge) with Deepgram WebSocket
// streaming as a cross-browser fallback when a Deepgram key is saved.

import { state } from './state.js';
import { toast, openSheet, setMicState } from './ui.js';

// Module-internal state — these don't need to be visible to other modules.
let recognition       = null;
let voiceStartedFlag  = false;
let voiceWatchdog     = null;
let mediaRecorder     = null;
let recordedStream    = null;
let dgSocket          = null;
let dgFinalText       = '';

const indicator = () => document.getElementById('voice-indicator');

// ── Web Speech API setup ──────────────────────────────────────────────
export function initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  recognition = new SR();
  recognition.continuous     = true;
  recognition.interimResults = true;
  recognition.lang           = 'en-US';

  recognition.onstart       = () => { voiceStartedFlag = true; indicator().textContent = '● ready — start speaking'; };
  recognition.onaudiostart  = () => { indicator().textContent = '● mic open — speak now'; };
  recognition.onspeechstart = () => { indicator().textContent = '● hearing you...'; };
  recognition.onspeechend   = () => { indicator().textContent = '● processing...'; };

  recognition.onresult = e => {
    let interim = '';
    state.voiceFinalText = '';
    for (let i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) state.voiceFinalText += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    document.getElementById('entry-textarea').value = state.voiceFinalText + interim;
    if (state.voiceFinalText || interim) indicator().textContent = '● listening... tap mic to stop';
  };

  // Mobile browsers auto-stop after silence; resume if we're still recording.
  // Small delay avoids InvalidStateError from immediate restart.
  recognition.onend = () => {
    if (!state.isRecording) return;
    setTimeout(() => {
      if (!state.isRecording) return;
      try { recognition.start(); }
      catch (_) {
        state.isRecording = false;
        setMicState(false);
        indicator().textContent = '';
      }
    }, 250);
  };

  recognition.onerror = e => {
    const messages = {
      'not-allowed': 'Microphone blocked. Enable it for this site in browser settings.',
      'service-not-allowed': 'Microphone blocked. Enable it for this site in browser settings.',
      'audio-capture': 'No microphone found on this device.',
      'no-speech': 'No speech detected — keep talking or tap mic to stop.',
      'network': 'Speech recognition needs internet — check your connection.',
      'aborted': 'Voice was aborted. Tap mic again to retry.',
      'language-not-supported': 'Language not supported by your browser.'
    };
    const msg = e.error in messages ? messages[e.error] : `Voice error: ${e.error}`;
    if (msg) toast(msg);
    if (e.error !== 'no-speech') {
      state.isRecording = false;
      if (voiceWatchdog) { clearTimeout(voiceWatchdog); voiceWatchdog = null; }
      setMicState(false);
      indicator().textContent = '';
    }
  };
}

// ── Public toggle: try Web Speech first, auto-fall-back to Deepgram ──
export async function toggleVoice() {
  if (!window.isSecureContext) { toast('Voice requires HTTPS. Open the site over https://'); return; }

  // STOP path — works for whichever backend is active
  if (state.isRecording) {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      try { mediaRecorder.stop(); } catch (_) {}
      return;
    }
    state.isRecording = false;
    if (voiceWatchdog) { clearTimeout(voiceWatchdog); voiceWatchdog = null; }
    try { recognition && recognition.stop(); } catch (_) {}
    setMicState(false);
    indicator().textContent = '';
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  // No Web Speech API at all → straight to Deepgram if we have a key
  if (!SR) {
    if (state.dgKey) return startVoiceDeepgram();
    toast('Voice input not supported here. Add a Deepgram key in Settings to use any browser.');
    return;
  }

  if (!recognition) initVoice();
  if (!recognition) {
    if (state.dgKey) return startVoiceDeepgram();
    toast('Voice unavailable');
    return;
  }

  // First-time-only: probe getUserMedia to force the OS permission prompt
  if (!localStorage.getItem('ll_mic_ok') && navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      localStorage.setItem('ll_mic_ok', '1');
      await new Promise(r => setTimeout(r, 200));
    } catch (_) {
      toast('Microphone permission denied. Allow it in browser settings.');
      return;
    }
  }

  openSheet();
  document.getElementById('entry-textarea').value = '';
  state.voiceFinalText = '';
  indicator().textContent = '● starting...';
  voiceStartedFlag = false;
  if (voiceWatchdog) { clearTimeout(voiceWatchdog); voiceWatchdog = null; }
  try {
    recognition.start();
    state.isRecording = true;
    setMicState(true);
    // If onstart doesn't fire in 800ms (browser blocking it — Brave Shields,
    // Opera, Firefox, etc.) auto-fall-back to Deepgram when a key is saved.
    voiceWatchdog = setTimeout(() => {
      if (voiceStartedFlag || !state.isRecording) return;
      state.isRecording = false;
      try { recognition.abort(); } catch (_) {}
      setMicState(false);
      if (state.dgKey) {
        indicator().textContent = '● switching to Deepgram...';
        startVoiceDeepgram();
      } else {
        indicator().textContent = '';
        toast("Browser speech didn't respond. Add a Deepgram key in Settings to use any browser.");
      }
    }, 800);
  } catch (err) {
    if (state.dgKey) return startVoiceDeepgram();
    toast(`Could not start voice: ${err.message || 'unknown error'}`);
    indicator().textContent = '';
  }
}

// ── Deepgram live streaming path (works in any browser with a mic) ──
async function startVoiceDeepgram() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (_) {
    toast('Microphone permission denied. Allow it in browser settings.');
    return;
  }

  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  const mime = candidates.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if (!mime) {
    stream.getTracks().forEach(t => t.stop());
    toast('Browser cannot record an audio format Deepgram understands.');
    return;
  }

  recordedStream = stream;
  dgFinalText = '';

  openSheet();
  document.getElementById('entry-textarea').value = '';
  indicator().textContent = '● connecting...';

  // Authenticate the WebSocket via subprotocol — browsers can't set headers on WS.
  const url = 'wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&interim_results=true';
  try {
    dgSocket = new WebSocket(url, ['token', state.dgKey]);
  } catch (err) {
    stream.getTracks().forEach(t => t.stop());
    indicator().textContent = '';
    toast(`Could not open Deepgram socket: ${err.message}`);
    return;
  }

  dgSocket.onopen = () => {
    indicator().textContent = '● live — tap mic to stop';
    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
    } catch (err) {
      stream.getTracks().forEach(t => t.stop());
      try { dgSocket.close(); } catch (_) {}
      toast(`MediaRecorder failed: ${err.message}`);
      return;
    }
    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0 && dgSocket && dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.send(e.data);
      }
    };
    mediaRecorder.onstop = () => {
      if (recordedStream) { recordedStream.getTracks().forEach(t => t.stop()); recordedStream = null; }
      state.isRecording = false;
      setMicState(false);
      // Tell Deepgram no more audio is coming so it sends final results, then close.
      if (dgSocket && dgSocket.readyState === WebSocket.OPEN) {
        try { dgSocket.send(JSON.stringify({ type: 'CloseStream' })); } catch (_) {}
        setTimeout(() => { try { dgSocket && dgSocket.close(); } catch (_) {} }, 1500);
      }
    };
    mediaRecorder.start(250); // 250ms chunks → low-latency streaming
    state.isRecording = true;
    setMicState(true);
  };

  dgSocket.onmessage = (msg) => {
    let data;
    try { data = JSON.parse(msg.data); } catch (_) { return; }
    if (data.type !== 'Results') return;
    const alt = data.channel?.alternatives?.[0];
    const transcript = (alt?.transcript || '').trim();
    if (!transcript) return;
    if (data.is_final) {
      dgFinalText += (dgFinalText ? ' ' : '') + transcript;
      document.getElementById('entry-textarea').value = dgFinalText;
      state.voiceFinalText = dgFinalText;
    } else {
      document.getElementById('entry-textarea').value =
        (dgFinalText ? dgFinalText + ' ' : '') + transcript;
    }
  };

  dgSocket.onerror = () => {
    toast('Deepgram connection error.');
    try { mediaRecorder && mediaRecorder.state === 'recording' && mediaRecorder.stop(); } catch (_) {}
  };

  dgSocket.onclose = (e) => {
    indicator().textContent = '';
    if (recordedStream) { recordedStream.getTracks().forEach(t => t.stop()); recordedStream = null; }
    if (mediaRecorder && mediaRecorder.state === 'recording') { try { mediaRecorder.stop(); } catch (_) {} }
    state.isRecording = false;
    setMicState(false);
    if (e.code !== 1000 && e.code !== 1005) {
      const reason = e.reason || (e.code === 1008 ? 'auth failed — check Deepgram key' : `code ${e.code}`);
      toast(`Deepgram closed: ${reason}`);
    }
    dgSocket = null;
  };
}
