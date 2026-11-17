// Kleine DOM-Helfer, damit die Ansichten ohne Framework lesbar bleiben.
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : String(c));
  }
  return el;
}

// Wie el.append / el.replaceChildren, aber Arrays werden aufgelöst und null/false übersprungen.
// (Das native append schreibt sonst "null" oder "[object HTMLDivElement]" in die Seite.)
const clean = kids => kids.flat(Infinity).filter(k => k != null && k !== false);
export const add = (el, ...kids) => el.append(...clean(kids));
export const put = (el, ...kids) => el.replaceChildren(...clean(kids));

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export const pct = (ok, n) => (n ? Math.round((ok / n) * 100) : 0);

export const rerender = () => window.dispatchEvent(new Event('hashchange'));
