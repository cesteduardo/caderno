/* =====================================================================
   Base do estudo
   ---------------------------------------------------------------------
   DB      IndexedDB (arquivos de livros, áudio das aulas, estado)
   E       estado do estudo: livros, destaques, notas, cartões, aulas
           Cada item tem id e u (hora da última mudança). Apagar deixa
           uma lápide {id, u, del:1}, para a exclusão chegar ao outro
           aparelho na sincronização.
   UI      janela, barra de seleção, baixar arquivo, datas
   ===================================================================== */
'use strict';

/* replaceChildren(null) escreveria "null" na tela: aqui null, false e
   listas aninhadas são tratados como em h() (ignorados / achatados). */
{
  const rc = Element.prototype.replaceChildren;
  Element.prototype.replaceChildren = function(...k){ return rc.apply(this, k.flat(Infinity).filter(x => x != null && x !== false)); };
}

const FRACO = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

/* ---------- IndexedDB: chave → valor (aceita Blob) ---------- */
const DB = (() => {
  let db = null;
  const mem = new Map();
  const ready = new Promise(res => {
    try {
      const q = indexedDB.open('caderno', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('kv');
      q.onsuccess = () => { db = q.result; res(); };
      q.onerror = q.onblocked = () => res();
    } catch (e) { res(); }
  });
  const run = (mode, fn) => new Promise(res => {
    try {
      const t = db.transaction('kv', mode), r = fn(t.objectStore('kv'));
      t.oncomplete = () => res(r ? r.result : undefined);
      t.onerror = t.onabort = () => res(undefined);
    } catch (e) { res(undefined); }
  });
  const range = p => IDBKeyRange.bound(p, p + '￿');
  return {
    ready,
    async get(k){ await ready; return db ? run('readonly', s => s.get(k)) : mem.get(k); },
    async set(k, v){ await ready; if (!db){ mem.set(k, v); return; } return run('readwrite', s => { s.put(v, k); }); },
    async del(k){ await ready; if (!db){ mem.delete(k); return; } return run('readwrite', s => { s.delete(k); }); },
    async delPrefix(p){ await ready; if (!db){ for (const k of [...mem.keys()]) if (k.startsWith(p)) mem.delete(k); return; } return run('readwrite', s => { s.delete(range(p)); }); },
    async keys(p){ await ready; if (!db) return [...mem.keys()].filter(k => k.startsWith(p)); return (await run('readonly', s => s.getAllKeys(range(p)))) || []; },
  };
})();

/* ---------- Estado do estudo ---------- */
const COLS = ['books', 'hl', 'notes', 'cards', 'lessons'];
const emptyE = () => ({ books: {}, hl: {}, notes: {}, cards: {}, lessons: {}, revlog: {}, prefs: {} });
let E = emptyE();
const DEVICE = (() => { try { let d = localStorage.getItem('caderno-device'); if (!d){ d = uid(); localStorage.setItem('caderno-device', d); } return d; } catch (e) { return 'x'; } })();

async function loadE(){
  const v = await DB.get('estudo');
  if (v && typeof v === 'object') E = { ...emptyE(), ...v };
  for (const c of COLS) E[c] ||= {};
}
let eTimer;
function saveE(now){
  clearTimeout(eTimer);
  const go_ = () => { DB.set('estudo', E); if (typeof schedulePush === 'function') schedulePush(); };
  if (now) go_(); else eTimer = setTimeout(go_, 400);
}
addEventListener('pagehide', () => { if (eTimer){ clearTimeout(eTimer); DB.set('estudo', E); } });

const live = col => Object.values(E[col]).filter(x => !x.del);
const getI = (col, id) => { const x = E[col][id]; return x && !x.del ? x : null; };
function putI(col, item){ item.u = Date.now(); E[col][item.id] = item; saveE(); return item; }
function delI(col, id){ E[col][id] = { id, u: Date.now(), del: 1 }; saveE(); }

/* Mescla dois estados: por item, vale o de u maior. Revisões por dia
   ficam por aparelho (somar duas vezes o mesmo dia inflaria a conta). */
function mergeE(a, b){
  const out = emptyE();
  for (const c of COLS){
    const ids = new Set([...Object.keys(a[c] || {}), ...Object.keys(b[c] || {})]);
    for (const id of ids){
      const x = (a[c] || {})[id], y = (b[c] || {})[id];
      out[c][id] = !y ? x : !x ? y : ((y.u || 0) > (x.u || 0) ? y : x);
    }
  }
  const days = new Set([...Object.keys(a.revlog || {}), ...Object.keys(b.revlog || {})]);
  for (const d of days){
    const x = (a.revlog || {})[d] || {}, y = (b.revlog || {})[d] || {}, o = {};
    for (const dev of new Set([...Object.keys(x), ...Object.keys(y)])) o[dev] = Math.max(x[dev] || 0, y[dev] || 0);
    out.revlog[d] = o;
  }
  out.prefs = { ...(a.prefs || {}), ...(b.prefs || {}) };
  return out;
}

/* Chamado pela sincronização (rotina.js): mescla o que veio do Gist e
   devolve o texto a enviar, ou null se o Gist já está igual. */
let afterRemoteMerge = null;
function estudoForSync(remote){
  const merged = remote ? mergeE(E, remote) : E;
  const m = JSON.stringify(merged);
  if (m !== JSON.stringify(E)){ E = merged; saveE(true); afterRemoteMerge && afterRemoteMerge(); }
  return remote && m === JSON.stringify(remote) ? null : m;
}

/* ---------- Datas e textos ---------- */
const DAY_MS = 864e5;
const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const fmtDate = t => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
const fmtDay = t => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
const fmtClock = ms => { ms = Math.max(0, Math.round(ms / 1000)); const hh = Math.floor(ms / 3600), mm = Math.floor(ms % 3600 / 60), ss = ms % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); };
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
const clip = (s, n) => (s = String(s || '').replace(/\s+/g, ' ').trim()).length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
const stripAcc = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => stripAcc(s).toLowerCase();
const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- Baixar arquivo ---------- */
function download(name, content, type = 'text/markdown'){
  const blob = content instanceof Blob ? content : new Blob([content], { type: type + ';charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const fileSafe = s => String(s || 'arquivo').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

/* ---------- Camadas e botão Voltar (Android) ----------
   Leitor, revisão e janelas entram na pilha; o Voltar fecha a de cima. */
const layers = [];
function pushLayer(close){
  layers.push(close);
  try { history.pushState({ layer: layers.length }, '', location.hash); } catch (e) {}
}
function popLayer(){ if (layers.length) history.back(); }
/* Navegar de dentro de uma janela: espera ela sair do histórico, senão o
   history.back() do fechamento desfaz a navegação recém-feita. */
const afterPop = [];
function whenClosed(fn){ if (layers.length) afterPop.push(fn); else fn(); }
addEventListener('popstate', e => {
  const d = (e.state && e.state.layer) || 0;
  let closed = false;
  while (layers.length > d){ layers.pop()(); closed = true; }
  if (closed){
    e.stopImmediatePropagation();
    if (!layers.length && afterPop.length){ const f = afterPop.splice(0); setTimeout(() => f.forEach(x => x()), 0); }
  }
}, true);

/* ---------- Janela ---------- */
function modal(title, body, actions = [], opts = {}){
  const m = $('#modal'), box = m.firstElementChild;
  const close = () => popLayer();
  box.className = 'modal-box' + (opts.wide ? ' wide' : '');
  box.replaceChildren(
    h('div', { class: 'modal-head' }, h('h2', { text: title }), h('button', { class: 'x', type: 'button', 'aria-label': 'Fechar', text: '×', onclick: close })),
    h('div', { class: 'modal-body' }, body),
    actions.length ? h('div', { class: 'modal-actions' }, actions.map(a =>
      h('button', { class: a.primary ? 'btn' : a.danger ? 'btn danger' : 'btn ghost', type: 'button', text: a.label, onclick: async () => { if (await a.onclick?.() !== false) close(); } }))) : null);
  m.hidden = false;
  pushLayer(() => { m.hidden = true; box.replaceChildren(); opts.onclose && opts.onclose(); });
  requestAnimationFrame(() => box.querySelector('[autofocus],textarea,input')?.focus());
  return close;
}
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') popLayer(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) popLayer(); });

function confirmBox(msg, ok = 'Apagar'){
  return new Promise(res => {
    let v = false;
    modal('Confirmar', h('p', { text: msg }), [
      { label: 'Cancelar' },
      { label: ok, danger: true, onclick: () => { v = true; } },
    ], { onclose: () => res(v) });
  });
}

/* ---------- Barra de seleção ----------
   Aparece logo abaixo do trecho selecionado (o menu do Android fica
   acima). actions: [{label, cls, title, onclick}] ; {br:1} quebra a
   linha. card(rect, el) mostra um cartão no mesmo lugar (tradução). */
const selbar = {
  el: $('#selbar'),
  place(rect){
    const el = this.el;
    const W = el.offsetWidth, H = el.offsetHeight, vw = innerWidth, vh = innerHeight;
    // a tradução fixada pelo usuário abre sempre no mesmo lugar
    const fixo = el.classList.contains('card-mode') && typeof RS !== 'undefined' && RS.trcFixo;
    if (fixo){
      el.style.transform = `translate(${Math.round(Math.max(8, Math.min(vw - W - 8, fixo.x)))}px,${Math.round(Math.max(8, Math.min(vh - H - 8, fixo.y)))}px)`;
      return;
    }
    let x = Math.max(8, Math.min(vw - W - 8, rect.left + rect.width / 2 - W / 2));
    let y = rect.bottom + 12;
    if (y + H > vh - 8) y = Math.max(8, rect.top - H - 12);
    el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  },
  show(rect, actions, within){
    const el = this.el;
    const list = actions.filter(Boolean);
    el.className = 'selbar' + (list.some(a => a.br) ? ' multi' : '');
    el.replaceChildren(...list.map(a => a.br ? h('span', { class: 'sb-br', 'aria-hidden': 'true' }) :
      h('button', { type: 'button', class: a.cls || '', title: a.title || null, 'aria-label': a.title || a.label, 'aria-pressed': a.on == null ? null : String(!!a.on),
        onmousedown: e => e.preventDefault(),
        onclick: e => { e.stopPropagation(); a.onclick(); } }, a.html ? a.html() : a.label)));
    el.hidden = false;
    this.rect = rect;
    this.place(rect);
    this.within = within || null;
  },
  card(rect, node){
    const el = this.el;
    el.className = 'selbar card-mode';
    el.replaceChildren(node);
    el.hidden = false;
    this.rect = rect || this.rect;
    this.place(this.rect);
  },
  hide(){ this.el.hidden = true; this.within = null; },
};
document.addEventListener('mousedown', e => { if (!selbar.el.hidden && !selbar.el.contains(e.target)) setTimeout(() => { const s = getSelection(); if (!s || s.isCollapsed || selbar.el.classList.contains('card-mode')) selbar.hide(); }, 0); });

/* ---------- Marcações: cores e estilos ----------
   Cada marcação tem cor (color) e estilo (style). Os nomes das cores
   podem ganhar sentido (“Azul = conceito”) e vão junto na sincronização
   (E.prefs.hlNames). A caneta guarda o último estilo usado. */
const HL_COLORS = [
  { id: 'am', name: 'Amarelo' },
  { id: 'vd', name: 'Verde' },
  { id: 'az', name: 'Azul' },
  { id: 'rs', name: 'Rosa' },
  { id: 'lj', name: 'Laranja' },
  { id: 'rx', name: 'Roxo' },
];
const HL_STYLES = [
  { id: 'marca', name: 'Marca-texto' },
  { id: 'sub', name: 'Sublinhado' },
  { id: 'ond', name: 'Ondulado' },
  { id: 'risco', name: 'Tachado' },
];
const PEN = { color: 'am', style: 'marca' };
try { Object.assign(PEN, JSON.parse(localStorage.getItem('caderno-caneta') || '{}')); } catch (e) {}
const savePen = () => { try { localStorage.setItem('caderno-caneta', JSON.stringify(PEN)); } catch (e) {} };
const hlColorName = id => ((E.prefs && E.prefs.hlNames) || {})[id] || (HL_COLORS.find(c => c.id === id) || {}).name || '';
const hlStyleName = id => (HL_STYLES.find(s => s.id === (id || 'marca')) || HL_STYLES[0]).name;
const hlClass = x => 'hl c-' + (x.color || 'am') + ' s-' + (x.style || 'marca') + (x.note ? ' has-note' : '') + (x.tr ? ' has-tr' : '');
const colorDots = (cur, pick) => HL_COLORS.map(c => ({ label: '', cls: 'dot c-' + c.id + (cur === c.id ? ' on' : ''), title: hlColorName(c.id), onclick: () => pick(c.id) }));
/* Botão que mostra o estilo atual com uma amostra */
const styleBtn = (cur, onclick) => ({ label: hlStyleName(cur), cls: 'sty', title: 'Estilo: ' + hlStyleName(cur), html: () => [h('span', { class: 'sty-ab s-' + (cur || 'marca'), text: 'ab' }), h('span', { class: 'sty-t', text: hlStyleName(cur) })], onclick });
const styleRow = (cur, pick, back) => [
  { label: '←', title: 'Voltar', onclick: back },
  ...HL_STYLES.map(s => ({ label: s.name, cls: 'sty' + ((cur || 'marca') === s.id ? ' on' : ''), title: s.name, html: () => [h('span', { class: 'sty-ab s-' + s.id, text: 'ab' }), h('span', { class: 'sty-t', text: s.name })], onclick: () => pick(s.id) })),
];

/* Remove marcações com “Desfazer” no aviso */
function removeHls(list, msg, extra){
  list = list.filter(Boolean);
  if (!list.length) return;
  const keep = list.map(x => ({ ...x }));
  for (const x of list) delI('hl', x.id);
  const after = () => {
    if (typeof RD !== 'undefined' && RD.eng) RD.eng.repaint();
    if (currentView === 'notas') renderNotes();
    if (currentView === 'aula' && typeof renderLesson === 'function') renderLesson(curLesson, true);
    if (typeof rdRefresh === 'function' && typeof RD !== 'undefined' && RD.eng) rdRefresh('hl');
  };
  after();
  toast(msg || (list.length === 1 ? 'Marcação removida.' : `${list.length} marcações removidas.`), 'Desfazer', () => {
    for (const k of keep) putI('hl', { ...k });
    if (extra) extra();
    after();
  });
}

/* ---------- Editor de nota ---------- */
function editNote(initial, onSave, title = 'Nota'){
  const ta = h('textarea', { class: 'note-ta', rows: 6, placeholder: 'O que este trecho diz para você? Uma pergunta, uma ligação com outra leitura…' });
  ta.value = initial || '';
  modal(title, ta, [{ label: 'Cancelar' }, { label: 'Salvar', primary: true, onclick: () => onSave(ta.value.trim()) }]);
}

/* ---------- Ícone de livro sem capa ---------- */
function coverEl(b, cls = 'cover'){
  if (b.cover) return h('img', { class: cls, src: b.cover, alt: '', loading: 'lazy' });
  return h('div', { class: cls + ' cover-blank', style: { '--c': hueOf(b.title) } },
    h('b', { text: clip(b.title, 60) }), b.author ? h('span', { text: clip(b.author, 40) }) : null);
}
function hueOf(s){ let x = 0; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return `hsl(${x % 360} 30% 42%)`; }

/* Impressão digital do arquivo: o mesmo livro tem o mesmo id em todo
   aparelho, então destaques e posição se reencontram. */
async function fingerprint(file){
  const head = await file.slice(0, 1 << 20).arrayBuffer();
  try {
    if (crypto.subtle){
      const d = await crypto.subtle.digest('SHA-256', head);
      return 'b' + [...new Uint8Array(d).slice(0, 8)].map(x => x.toString(16).padStart(2, '0')).join('') + file.size.toString(36);
    }
  } catch (e) {}
  const u = new Uint8Array(head); let a = 2166136261;
  for (let i = 0; i < u.length; i++){ a ^= u[i]; a = Math.imul(a, 16777619) >>> 0; }
  return 'b' + a.toString(16) + file.size.toString(36);
}

/* Tela acesa enquanto lê ou grava */
let wakeLock = null;
async function keepAwake(on){
  try {
    if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock){ await wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}
let wakeWanted = false;
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wakeWanted) keepAwake(true); });
function wantAwake(on){ wakeWanted = on; keepAwake(on); }
