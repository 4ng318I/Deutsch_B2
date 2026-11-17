// Sprachausgabe über die SpeechSynthesis des Geräts. Keine Aussprachebewertung.
import { S } from './store.js';
import { h } from './dom.js';

export const hasTTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let voices = [];

function loadVoices() {
  voices = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith('de'));
}
if (hasTTS) {
  loadVoices();
  if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

export const deVoices = () => { if (hasTTS && !voices.length) loadVoices(); return voices; };

export function speak(text) {
  if (!hasTTS) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  const v = deVoices().find(x => x.name === S.settings.stimme) || voices[0];
  if (v) u.voice = v;
  u.rate = S.settings.tempo || 1;
  speechSynthesis.speak(u);
}

export const stopSpeaking = () => { if (hasTTS) speechSynthesis.cancel(); };

export const speakBtn = text => hasTTS
  ? h('button', { class: 'icon', title: 'Anhören', 'aria-label': 'Anhören', onclick: e => { e.stopPropagation(); speak(text); } }, '▶')
  : null;
