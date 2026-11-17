// Oberfläche auf Deutsch. Spanisch ist eine Hilfe, die man in drei Stufen zurücknimmt:
//  2 = spanische Glossen unter den Beschriftungen, Übersetzung der Sätze sichtbar
//  1 = keine Glossen, Übersetzung nur auf Knopfdruck
//  0 = kein Spanisch in den Übungen (Grammatik-Erklärungen und Anruf-Aufgaben bleiben spanisch)
import { C } from './content.js';
import { S } from './store.js';
import { h } from './dom.js';

export const T = key => (C.ui[key] && C.ui[key].de) || key;

export function G(key) {
  if (S.settings.spanisch < 2 || !C.ui[key] || !C.ui[key].es) return null;
  return h('span', { class: 'gl' }, C.ui[key].es);
}

// Beschriftung mit optionaler Glosse
export const L = key => [T(key), G(key)];

// Spanische Übersetzung eines Satzes je nach Stufe
export function cue(es) {
  if (!es || S.settings.spanisch === 0) return null;
  if (S.settings.spanisch === 2) return h('p', { class: 'cue' }, es);
  const p = h('p', { class: 'cue' });
  p.append(h('button', { class: 'btn small', onclick: () => p.replaceChildren(es) }, T('uebersetzung_zeigen')));
  return p;
}
