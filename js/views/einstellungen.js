import { h, rerender, today, add } from '../dom.js';
import { C } from '../content.js';
import { S, save, exportJSON, importJSON, resetAll } from '../store.js';
import { deVoices, speak, hasTTS } from '../speech.js';
import { L, T } from '../i18n.js';

const set = (k, v) => { S.settings[k] = v; save(); rerender(); };

function seg(key, options) {
  return h('div', { class: 'row' }, options.map(([val, label]) =>
    h('button', { class: 'btn' + (S.settings[key] === val ? ' on' : ''), onclick: () => set(key, val) }, label)));
}

export function einstellungenView(root) {
  const msg = h('p', { class: 'small', role: 'status' });
  const voices = deVoices();
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  let mode = 'zusammenfuehren';
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    try {
      importJSON(await file.files[0].text(), mode);
      rerender();
      setTimeout(() => alert('Import abgeschlossen.'), 50);
    } catch (e) { msg.textContent = 'Import fehlgeschlagen: ' + e.message; }
    file.value = '';
  });

  add(root, 
    h('h1', {}, '⚙️ ', L('einstellungen')),
    h('div', { class: 'field' }, h('div', { class: 'lbl' }, L('spanisch')),
      seg('spanisch', [[2, 'Viel'], [1, 'Wenig'], [0, 'Keine']]),
      h('div', { class: 'muted small' }, T('spanisch_hinweis'))),
    h('div', { class: 'field' }, h('div', { class: 'lbl' }, L('rundenlaenge')),
      seg('runde', [[5, '5'], [10, '10'], [20, '20']])),
    h('div', { class: 'field' }, h('div', { class: 'lbl' }, L('design')),
      seg('theme', [['dark', 'Dunkel'], ['light', 'Hell']])),
    h('div', { class: 'field' }, h('div', { class: 'lbl' }, L('stimme')),
      !hasTTS ? h('div', { class: 'note' }, 'Dieses Gerät bietet keine Sprachausgabe.')
      : !voices.length ? h('div', { class: 'note' }, 'Keine deutsche Stimme gefunden. In den Systemeinstellungen des Geräts lässt sich eine deutsche Sprachausgabe nachinstallieren. Falls die Liste nur noch nicht geladen ist: Seite neu öffnen.')
      : h('select', { onchange: e => set('stimme', e.target.value) },
          h('option', { value: '' }, 'Standard'),
          voices.map(v => h('option', { value: v.name, selected: v.name === S.settings.stimme }, `${v.name} (${v.lang})${v.localService ? '' : ' – online'}`))),
      hasTTS ? [seg('tempo', [[0.8, 'Langsam'], [1, 'Normal'], [1.15, 'Schnell']]),
        h('div', {}, h('button', { class: 'btn', onclick: () => speak('Guten Tag, ich rufe wegen des Wartungstermins an.') }, 'Stimme testen'))] : null),
    h('div', { class: 'field' }, h('div', { class: 'lbl' }, L('daten')),
      h('div', { class: 'muted small' }, T('daten_hinweis')),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' })),
            download: `deutschb2-fortschritt-${today()}.json` });
          document.body.append(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } }, 'Exportieren'),
        h('button', { class: 'btn', onclick: () => { mode = 'zusammenfuehren'; file.click(); } }, 'Importieren und zusammenführen'),
        h('button', { class: 'btn', onclick: () => {
          if (confirm('Der gesamte Fortschritt auf diesem Gerät wird durch die Datei ersetzt. Fortfahren?')) { mode = 'ersetzen'; file.click(); }
        } }, 'Importieren und ersetzen')),
      file, msg,
      h('div', {}, h('button', { class: 'btn', onclick: () => {
        if (confirm('Den gesamten Fortschritt auf diesem Gerät löschen? Das lässt sich nicht rückgängig machen.')) { resetAll(); rerender(); }
      } }, 'Fortschritt löschen'))),
    h('p', { class: 'muted small' },
      `Datenbank v${C.index.version}: ${C.saetze.length} Sätze, ${C.items.length} Aufgaben, ${C.wortschatz.length} Vokabeln, ` +
      `${C.redemittel.length} Redemittel, ${C.anrufe.length} Anrufe, ${C.grammatik.length} Regeln.`));
}
