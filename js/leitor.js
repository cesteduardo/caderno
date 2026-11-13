/* =====================================================================
   Ler: biblioteca e leitor
   ---------------------------------------------------------------------
   EPUB e TXT: página que se ajusta à tela (colunas CSS, sem rolagem).
   A posição é guardada por caractere: muda a letra, a página muda,
   mas o lugar no texto continua o mesmo. Destaques também são
   guardados por caractere (seção + início + fim).
   O PDF tem o seu motor em js/pdf.js; a moldura (barras, painel,
   ajustes, seleção) é a mesma.
   ===================================================================== */
'use strict';

/* ---------- Ajustes de leitura ---------- */
const RS_KEY = 'caderno-leitor';
const RS = { font: 'serif', size: 19, lh: 1.6, margin: 'm', just: true, theme: 'papel', awake: true };
try { Object.assign(RS, JSON.parse(localStorage.getItem(RS_KEY) || '{}')); } catch (e) {}
const saveRS = () => { try { localStorage.setItem(RS_KEY, JSON.stringify(RS)); } catch (e) {} };
const THEMES = [
  { id: 'papel', name: 'Papel' },
  { id: 'sepia', name: 'Sépia' },
  { id: 'noite', name: 'Noite' },
  { id: 'eink',  name: 'E-ink' },
  { id: 'sol',   name: 'Sol' },
];

/* ---------- Biblioteca ---------- */
let haveFile = new Set();
async function refreshHave(){
  const k = [...await DB.keys('cont:'), ...await DB.keys('arq:')];
  haveFile = new Set(k.map(x => x.replace(/^(cont|arq):/, '')));
}
const hlOf = bookId => live('hl').filter(x => x.book === bookId);
const booksSorted = () => live('books').sort((a, b) => (b.last || b.added || 0) - (a.last || a.added || 0));

async function renderBooks(){
  await refreshHave();
  const list = booksSorted();
  $('#bookCount').textContent = list.length || '';
  const box = $('#library');
  if (!list.length){
    box.replaceChildren(h('div', { class: 'empty card' },
      h('h2', { text: 'Nenhum livro ainda.' }),
      h('p', { text: 'Toque em “Adicionar livros” e escolha arquivos EPUB, PDF ou TXT do aparelho. Eles ficam guardados aqui, funcionam sem internet e não vão para o GitHub; o que sincroniza entre PC e celular são a posição de leitura, os destaques e as notas.' })));
  } else {
    const cur = list.find(b => b.last && haveFile.has(b.id));
    box.replaceChildren(
      cur ? h('section', { class: 'card resume', onclick: () => openBook(cur.id) },
        coverEl(cur, 'cover big'),
        h('div', { class: 'resume-txt' },
          h('span', { class: 'eyebrow', text: 'Continuar lendo' }),
          h('h2', { text: cur.title }),
          cur.author ? h('p', { class: 'muted', text: cur.author }) : null,
          h('div', { class: 'bar' }, h('i', { style: { width: Math.round((cur.pct || 0) * 100) + '%' } })),
          h('p', { class: 'muted small', text: `${Math.round((cur.pct || 0) * 100)}% · ${plural(hlOf(cur.id).length, 'destaque', 'destaques')}` }))) : null,
      h('div', { class: 'shelf' }, list.map(bookTile)));
  }
  inkCheck();
}
function bookTile(b){
  const has = haveFile.has(b.id);
  const n = hlOf(b.id).length;
  return h('article', { class: 'book' + (has ? '' : ' missing') },
    h('button', { class: 'book-open', type: 'button', 'aria-label': 'Abrir ' + b.title, onclick: () => openBook(b.id) }, coverEl(b)),
    h('div', { class: 'book-meta' },
      h('b', { text: b.title }),
      h('span', { text: b.author || ' ' }),
      h('span', { class: 'book-line' },
        h('i', { class: 'tag', text: b.type }),
        has ? `${Math.round((b.pct || 0) * 100)}%` : 'arquivo noutro aparelho',
        n ? ` · ${n} ✎` : '')),
    h('button', { class: 'x book-more', type: 'button', 'aria-label': 'Opções', text: '⋯', onclick: e => bookMenu(b, e.currentTarget) }));
}
function bookMenu(b, btn){
  const r = btn.getBoundingClientRect();
  selbar.show(r, [
    { label: 'Destaques', onclick: () => { selbar.hide(); go('notas', 'livro:' + b.id); } },
    { label: 'Renomear', onclick: () => { selbar.hide(); renameBook(b); } },
    { label: 'Remover', cls: 'danger', onclick: async () => {
      selbar.hide();
      if (!await confirmBox(`Remover “${b.title}” deste aparelho e da biblioteca? Os destaques e notas continuam em Notas.`, 'Remover')) return;
      await DB.del('cont:' + b.id); await DB.del('arq:' + b.id);
      delI('books', b.id); renderBooks();
    } },
  ]);
}
function renameBook(b){
  const t = h('input', { type: 'text', value: b.title, 'aria-label': 'Título' });
  const a = h('input', { type: 'text', value: b.author || '', placeholder: 'Autor', 'aria-label': 'Autor' });
  modal('Título e autor', h('div', { class: 'form' }, h('label', {}, 'Título', t), h('label', {}, 'Autor', a)), [
    { label: 'Cancelar' },
    { label: 'Salvar', primary: true, onclick: () => { b.title = t.value.trim() || b.title; b.author = a.value.trim(); putI('books', b); renderBooks(); } },
  ]);
}

$('#bookFile').addEventListener('change', async e => {
  const files = [...e.target.files];
  e.target.value = '';
  const errs = [];
  let ok = 0;
  for (let i = 0; i < files.length; i++){
    const f = files[i];
    const tag = files.length > 1 ? ` (${i + 1} de ${files.length})` : '';
    toast(`Importando ${f.name}${tag}…`);
    try {
      const r = await importBook(f, (k, n) => { if (k % 5 === 0) toast(`Lendo ${clip(f.name, 40)}${tag}: ${Math.round(100 * k / n)}%`); });
      ok++;
      if (r.was) toast(`“${r.book.title}” reencontrado: destaques e posição de leitura voltaram.`);
    } catch (err) { errs.push([f.name, err.message || String(err)]); }
  }
  if (ok && !errs.length) toast(ok === 1 ? 'Livro adicionado.' : `${ok} livros adicionados.`);
  if (errs.length) modal('Não deu para abrir', h('ul', { class: 'errs' }, errs.map(([n, m]) => h('li', {}, h('b', { text: n }), h('span', { text: m })))), [{ label: 'OK', primary: true }]);
  else document.querySelector('.toast')?.remove();
  renderBooks();
});

async function inkCheck(){
  const btn = $('#fromInk');
  const list = (await inkList()).filter(m => !getI('books', 'ink' + m.id.slice(2)));
  btn.hidden = !list.length;
  btn.textContent = `Trazer ${plural(list.length, 'livro', 'livros')} do INK`;
  btn.onclick = async () => {
    let n = 0;
    for (const m of list) if (await inkImport(m)) n++;
    toast(n ? `${plural(n, 'livro veio', 'livros vieram')} do INK, com a posição de leitura.` : 'Nada novo no INK.');
    renderBooks();
  };
}

/* =====================================================================
   Leitor: moldura comum
   ===================================================================== */
const RD = { book: null, eng: null, el: $('#reader'), chromeTimer: 0 };

function buildReader(){
  const el = RD.el;
  el.replaceChildren(
    h('header', { class: 'rd-top' },
      h('button', { class: 'rd-btn', type: 'button', 'aria-label': 'Voltar à biblioteca', text: '←', onclick: () => popLayer() }),
      h('div', { class: 'rd-title' }, h('b', { id: 'rdTitle' }), h('span', { id: 'rdChap' })),
      h('button', { class: 'rd-btn', type: 'button', text: 'Sumário', onclick: () => panel('toc') }),
      h('button', { class: 'rd-btn', type: 'button', text: 'Notas', onclick: () => panel('hl') }),
      h('button', { class: 'rd-btn', type: 'button', text: 'Buscar', onclick: () => panel('busca') }),
      h('button', { class: 'rd-btn', type: 'button', text: 'Aa', 'aria-label': 'Ajustes de leitura', onclick: () => panel('aa') })),
    h('div', { class: 'rd-stage', id: 'rdStage' }),
    h('footer', { class: 'rd-bot' },
      h('input', { type: 'range', id: 'rdRange', min: 0, max: 1000, value: 0, 'aria-label': 'Posição no livro' }),
      h('span', { id: 'rdPos' })),
    h('aside', { class: 'rd-panel', id: 'rdPanel', hidden: true }),
    h('div', { class: 'rd-flash', id: 'rdFlash' }));
  $('#rdRange').addEventListener('change', e => RD.eng.gotoPct(e.target.value / 1000));
  $('#rdRange').addEventListener('input', e => { $('#rdPos').textContent = Math.round(e.target.value / 10) + '%'; });
}

function applyRS(){
  const el = RD.el;
  el.dataset.theme = RS.theme;
  el.style.setProperty('--rd-size', (RS.size + (RS.theme === 'sol' ? 1 : 0)) + 'px');
  el.style.setProperty('--rd-lh', RS.lh);
  el.style.setProperty('--rd-mx', { s: '14px', m: '26px', l: '48px' }[RS.margin] || '26px');
  el.dataset.font = RS.font;
  el.dataset.just = RS.just ? '1' : '0';
  const tc = getComputedStyle(el).getPropertyValue('--rd-bg').trim();
  document.querySelector('meta[name="theme-color"]').content = tc || '#ffffff';
}

async function openBook(id){
  const b = getI('books', id);
  if (!b) return;
  if (!haveFile.has(id)) await refreshHave();
  if (!haveFile.has(id)){
    modal('Arquivo noutro aparelho', h('p', { text: `“${b.title}” foi adicionado em outro aparelho. Os destaques e a posição já estão aqui; falta só o arquivo. Adicione o mesmo arquivo neste aparelho e ele se encaixa sozinho.` }),
      [{ label: 'Fechar' }, { label: 'Escolher arquivo', primary: true, onclick: () => $('#bookFile').click() }]);
    return;
  }
  RD.book = b;
  buildReader();
  applyRS();
  RD.el.hidden = false;
  document.body.classList.add('reading');
  $('#rdTitle').textContent = b.title;
  pushLayer(closeReader);
  RD.eng = b.type === 'PDF' ? PdfEngine : FlowEngine;
  try { await RD.eng.open(b); }
  catch (e) { toast('Não consegui abrir: ' + (e.message || e)); popLayer(); return; }
  if (RS.awake) wantAwake(true);
  showChrome(true);
}
function closeReader(){
  try { RD.eng && RD.eng.close(); } catch (e) {}
  if (RD.book){ RD.book.last = Date.now(); putI('books', RD.book); }
  RD.el.hidden = true; RD.el.replaceChildren();
  RD.book = null; RD.eng = null;
  document.body.classList.remove('reading');
  selbar.hide();
  wantAwake(false);
  document.querySelector('meta[name="theme-color"]').content = '#ffffff';
  if (currentView === 'ler') renderBooks();
  if (currentView === 'hoje') renderStudyToday();
}

function showChrome(on){
  RD.el.classList.toggle('bare', !on);
  clearTimeout(RD.chromeTimer);
}
const toggleChrome = () => showChrome(RD.el.classList.contains('bare'));

function savePos(pos, pct, label){
  const b = RD.book;
  if (!b) return;
  b.pos = pos; b.pct = Math.max(0, Math.min(1, pct)); b.last = Date.now();
  clearTimeout(savePos.t);
  savePos.t = setTimeout(() => putI('books', b), 800);
  $('#rdRange').value = Math.round(b.pct * 1000);
  $('#rdPos').textContent = label || Math.round(b.pct * 100) + '%';
}

function flash(){
  if (RS.theme !== 'eink') return;
  const f = $('#rdFlash');
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}

/* ---------- Painel lateral: sumário, notas, busca, ajustes ---------- */
function panel(tab){
  const p = $('#rdPanel');
  if (!p.hidden && p.dataset.tab === tab){ popLayer(); return; }
  const wasOpen = !p.hidden;
  p.dataset.tab = tab;
  const tabs = [['toc', 'Sumário'], ['hl', 'Notas'], ['busca', 'Buscar'], ['aa', 'Ajustes']];
  p.replaceChildren(
    h('div', { class: 'rp-tabs' }, tabs.map(([k, l]) => h('button', { type: 'button', class: k === tab ? 'on' : '', text: l, onclick: () => { p.hidden = true; panelSwap(k); } })),
      h('button', { class: 'x', type: 'button', text: '×', 'aria-label': 'Fechar', onclick: () => popLayer() })),
    h('div', { class: 'rp-body' }, ({ toc: panelToc, hl: panelHl, busca: panelSearch, aa: panelAa })[tab]()));
  p.hidden = false;
  if (!wasOpen) pushLayer(() => { p.hidden = true; });
}
function panelSwap(k){ const p = $('#rdPanel'); p.hidden = false; p.dataset.tab = ''; panel(k); }

function panelToc(){
  const toc = RD.book.toc || [];
  if (!toc.length) return h('p', { class: 'muted pad', text: 'Este arquivo não traz sumário.' });
  const act = RD.eng.tocActive();
  return h('ol', { class: 'rp-list toc' }, toc.map((t, i) => h('li', { class: (i === act ? 'on ' : '') + 'd' + (t.d || 0) },
    h('button', { type: 'button', onclick: () => { popLayer(); RD.eng.gotoToc(t); } }, h('span', { text: t.l }), t.p ? h('i', { text: t.p }) : null))));
}

function panelHl(){
  const list = hlOf(RD.book.id).sort((a, b) => RD.book.type === 'PDF' ? (a.page - b.page) || (a.y || 0) - (b.y || 0) : (a.s - b.s) || (a.a - b.a));
  const notes = live('notes').filter(n => n.src && n.src.t === 'livro' && n.src.id === RD.book.id);
  return h('div', {},
    h('div', { class: 'rp-actions' },
      h('button', { class: 'btn small', type: 'button', text: '+ Nota do livro', onclick: () => { popLayer(); bookNote(); } }),
      list.length ? h('button', { class: 'btn ghost small', type: 'button', text: 'Exportar .md', onclick: () => exportBookMd(RD.book) }) : null),
    notes.map(n => h('div', { class: 'rp-note' }, h('b', { text: n.title || 'Nota' }), h('p', { text: n.body }))),
    list.length ? h('ol', { class: 'rp-list hls' }, list.map(x => h('li', { class: 'c-' + x.color },
      h('button', { type: 'button', class: 'hl-go', onclick: () => { popLayer(); RD.eng.gotoHl(x); } },
        h('span', { class: 'hl-txt', text: clip(x.text, 280) }),
        x.note ? h('span', { class: 'hl-note', text: x.note }) : null,
        h('i', { text: x.page ? 'p. ' + x.page : '' })),
      h('div', { class: 'hl-acts' },
        h('button', { type: 'button', text: 'Nota', onclick: () => editNote(x.note, v => { x.note = v; putI('hl', x); RD.eng.repaint(); panelSwap('hl'); }) }),
        h('button', { type: 'button', text: 'Cartão', onclick: () => cardFromHl(x) }),
        h('button', { type: 'button', class: 'danger', text: 'Apagar', onclick: () => { delI('hl', x.id); RD.eng.repaint(); panelSwap('hl'); } }))))) :
      h('p', { class: 'muted pad', text: 'Selecione um trecho do texto para destacar. No celular: toque e segure numa palavra e arraste as alças.' }));
}

function panelSearch(){
  const inp = h('input', { type: 'search', placeholder: 'Palavra ou trecho', 'aria-label': 'Buscar no livro', autofocus: true });
  const out = h('ol', { class: 'rp-list hits' });
  let run = 0;
  const doSearch = async () => {
    const q = inp.value.trim();
    const my = ++run;
    out.replaceChildren();
    if (q.length < 2) return;
    out.append(h('li', { class: 'muted pad', text: 'Procurando…' }));
    let n = 0;
    await RD.eng.search(q, hit => {
      if (my !== run) return false;
      if (!n) out.replaceChildren();
      n++;
      out.append(h('li', {}, h('button', { type: 'button', onclick: () => { popLayer(); RD.eng.gotoHit(hit); } },
        h('span', {}, hit.pre, h('mark', { text: hit.mid }), hit.post), hit.label ? h('i', { text: hit.label }) : null)));
      return n < 200;
    });
    if (my === run && !n) out.replaceChildren(h('li', { class: 'muted pad', text: 'Nada encontrado.' }));
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  let t; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(doSearch, 450); });
  setTimeout(() => inp.focus(), 50);
  return h('div', {}, h('div', { class: 'rp-search' }, inp), out);
}

function panelAa(){
  const seg = (opts, cur, set) => h('div', { class: 'seg' }, opts.map(([v, l]) => h('button', { type: 'button', class: v === cur ? 'on' : '', text: l, onclick: () => { set(v); saveRS(); applyRS(); RD.eng.relayout(); panelSwap('aa'); } })));
  const pdf = RD.book.type === 'PDF';
  return h('div', { class: 'aa' },
    h('h3', { text: 'Tema' }),
    seg(THEMES.map(t => [t.id, t.name]), RS.theme, v => {
      RS.theme = v;
      if (v === 'sol' && !RS.solTip){ RS.solTip = 1; setTimeout(() => toast('Modo Sol: contraste máximo e letra mais grossa. Suba o brilho do celular no máximo; a tela não fica menos refletiva, mas o texto vence o reflexo.'), 400); }
    }),
    pdf ? null : h('h3', { text: 'Letra' }),
    pdf ? null : seg([['serif', 'Serifa'], ['sans', 'Inter']], RS.font, v => { RS.font = v; }),
    pdf ? null : h('div', { class: 'aa-row' }, h('span', { text: 'Tamanho' }),
      h('button', { class: 'round', type: 'button', text: 'A−', onclick: () => { RS.size = Math.max(13, RS.size - 1); saveRS(); applyRS(); RD.eng.relayout(); } }),
      h('button', { class: 'round', type: 'button', text: 'A+', onclick: () => { RS.size = Math.min(34, RS.size + 1); saveRS(); applyRS(); RD.eng.relayout(); } })),
    pdf ? null : h('h3', { text: 'Entrelinha' }),
    pdf ? null : seg([[1.4, 'Justa'], [1.6, 'Normal'], [1.85, 'Folgada']], RS.lh, v => { RS.lh = v; }),
    pdf ? null : h('h3', { text: 'Margens' }),
    pdf ? null : seg([['s', 'Estreitas'], ['m', 'Médias'], ['l', 'Largas']], RS.margin, v => { RS.margin = v; }),
    pdf ? null : h('h3', { text: 'Alinhamento' }),
    pdf ? null : seg([[true, 'Justificado'], [false, 'À esquerda']], RS.just, v => { RS.just = v; }),
    h('h3', { text: 'Tela' }),
    seg([[true, 'Sempre acesa'], [false, 'Normal']], RS.awake, v => { RS.awake = v; wantAwake(v); }),
    RS.theme === 'sol' || RS.theme === 'eink' ? h('p', { class: 'muted small aa-tip', text: 'Ao sol: brilho no máximo e, se puder, película fosca. Nenhum programa muda o vidro da tela; o que dá para fazer daqui é tirar todo cinza, engrossar a letra e deixar o fundo branco puro, que é o que mais rende contra o reflexo.' }) : null);
}

/* ---------- Selecionar e destacar ---------- */
function selActions(base){
  // base: { text, make(color) → hl } — cria o destaque e devolve
  return [
    ...colorDots(null, c => { base.make(c); selbar.hide(); getSelection().removeAllRanges(); }),
    { label: 'Nota', onclick: () => { const x = base.make('am'); selbar.hide(); getSelection().removeAllRanges(); editNote('', v => { x.note = v; putI('hl', x); RD.eng && RD.eng.repaint(); }); } },
    { label: 'Cartão', onclick: () => { const x = base.make('am'); selbar.hide(); getSelection().removeAllRanges(); cardFromHl(x); } },
    { label: 'Copiar', onclick: () => { navigator.clipboard?.writeText(base.text); selbar.hide(); toast('Copiado.'); } },
  ];
}
function hlActions(x){
  return [
    ...colorDots(x.color, c => { x.color = c; putI('hl', x); RD.eng.repaint(); selbar.hide(); }),
    { label: x.note ? 'Ver nota' : 'Nota', onclick: () => { selbar.hide(); editNote(x.note, v => { x.note = v; putI('hl', x); RD.eng.repaint(); }); } },
    { label: 'Cartão', onclick: () => { selbar.hide(); cardFromHl(x); } },
    { label: 'Apagar', cls: 'danger', onclick: () => { selbar.hide(); delI('hl', x.id); RD.eng.repaint(); } },
  ];
}
function newHl(fields){
  return putI('hl', { id: uid() + uid(), book: RD.book.id, created: Date.now(), note: '', ...fields });
}
function cardFromHl(x){
  const b = getI('books', x.book);
  openCardEditor({ kind: 'cloze', text: x.text, deck: b ? b.title : 'Leituras', src: { t: 'hl', id: x.id, book: x.book, label: (b ? b.title : '') + (x.page ? ', p. ' + x.page : '') }, hint: x.note });
}
function bookNote(){
  const t = h('input', { type: 'text', placeholder: 'Título (opcional)', 'aria-label': 'Título' });
  const ta = h('textarea', { class: 'note-ta', rows: 7, placeholder: 'Ideia, resumo de capítulo, pergunta para a próxima aula…' });
  modal('Nota sobre ' + clip(RD.book.title, 40), h('div', { class: 'form' }, t, ta), [
    { label: 'Cancelar' },
    { label: 'Salvar', primary: true, onclick: () => { if (!ta.value.trim()) return false; putI('notes', { id: uid() + uid(), title: t.value.trim(), body: ta.value.trim(), created: Date.now(), src: { t: 'livro', id: RD.book.id, label: RD.book.title } }); toast('Nota salva.'); } },
  ]);
}
function exportBookMd(b){
  const list = hlOf(b.id).sort((x, y) => b.type === 'PDF' ? (x.page - y.page) : (x.s - y.s) || (x.a - y.a));
  const notes = live('notes').filter(n => n.src && n.src.id === b.id);
  let md = `# ${b.title}\n\n` + (b.author ? `Autor: [[${b.author}]]\n\n` : '');
  if (notes.length) md += '## Notas\n\n' + notes.map(n => (n.title ? `### ${n.title}\n\n` : '') + n.body + '\n').join('\n') + '\n';
  md += '## Destaques\n\n' + list.map(x => `> ${x.text.replace(/\n+/g, ' ')}` + (x.page ? ` (p. ${x.page})` : '') + (x.note ? `\n\n${x.note}` : '') + '\n').join('\n');
  download(fileSafe(b.title) + '.md', md);
}

/* ---------- toques, gestos e teclado (comuns) ---------- */
function stageInput(stage, eng){
  let sx = 0, sy = 0, st = 0;
  stage.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (!eng.paged) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    const s = getSelection();
    if (s && !s.isCollapsed) return;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 60 && Date.now() - st < 600){ dx < 0 ? eng.next() : eng.prev(); e.preventDefault(); }
  });
  stage.addEventListener('click', e => {
    const s = getSelection();
    if (s && !s.isCollapsed) return;
    if (!$('#rdPanel').hidden) return;
    const a = e.target.closest('a');
    if (a){ e.preventDefault(); if (a.dataset.href) eng.link(a.dataset.href, a); else if (a.href) window.open(a.href, '_blank', 'noopener'); return; }
    const m = e.target.closest('[data-h]');
    if (m){ const x = getI('hl', m.dataset.h); if (x){ selbar.show(m.getBoundingClientRect(), hlActions(x)); return; } }
    const ph = eng.hitHl && eng.hitHl(e);
    if (ph){ selbar.show(ph[1] ? ph[1].getBoundingClientRect() : { left: e.clientX, top: e.clientY, bottom: e.clientY, width: 0 }, hlActions(ph[0])); return; }
    if (!selbar.el.hidden){ selbar.hide(); return; }
    if (!eng.paged){ toggleChrome(); return; }
    const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    if (x < .28) eng.prev(); else if (x > .72) eng.next(); else toggleChrome();
  });
}
document.addEventListener('keydown', e => {
  if (!RD.eng || !$('#modal').hidden || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (!$('#rdPanel').hidden) return;
  if (['ArrowRight', 'PageDown', ' '].includes(e.key) && RD.eng.paged){ e.preventDefault(); RD.eng.next(); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key) && RD.eng.paged){ e.preventDefault(); RD.eng.prev(); }
});
let selT;
document.addEventListener('selectionchange', () => {
  if (!RD.eng) return;
  clearTimeout(selT);
  selT = setTimeout(() => RD.eng && RD.eng.onSelect(), 260);
});

/* =====================================================================
   Motor de texto corrido (EPUB, TXT)
   ===================================================================== */
const FlowEngine = {
  paged: true,
  async open(b){
    this.b = b;
    this.c = await DB.get('cont:' + b.id);
    if (!this.c || !this.c.sections) throw new Error('conteúdo não encontrado');
    this.urls = {};
    for (const [p, blob] of Object.entries(this.c.imgs || {})) this.urls[p] = URL.createObjectURL(blob);
    this.before = [0];
    for (const n of this.c.lens) this.before.push(this.before[this.before.length - 1] + n);
    this.total = this.before[this.before.length - 1] || 1;
    const stage = $('#rdStage');
    stage.replaceChildren(h('div', { class: 'rd-page', id: 'rdPage' }, h('div', { class: 'rd-sec', id: 'rdSec' })));
    stage.className = 'rd-stage flow';
    stageInput(stage, this);
    this.ro = new ResizeObserver(() => { clearTimeout(this.rt); this.rt = setTimeout(() => this.relayout(), 150); });
    this.ro.observe(stage);
    const p = b.pos || { s: 0, c: 0 };
    await this.load(Math.min(p.s || 0, this.c.sections.length - 1), p.c || 0);
  },
  close(){ this.ro && this.ro.disconnect(); for (const u of Object.values(this.urls || {})) URL.revokeObjectURL(u); this.urls = {}; },

  async load(i, c, toEnd){
    this.sec = i;
    const el = $('#rdSec');
    el.style.transform = '';
    el.innerHTML = this.c.sections[i];
    el.querySelectorAll('img[data-src]').forEach(im => { const u = this.urls[im.dataset.src]; if (u) im.src = u; else im.remove(); });
    this.paintHl();
    const imgs = [...el.querySelectorAll('img')];
    if (imgs.length) await Promise.race([Promise.all(imgs.map(im => im.decode ? im.decode().catch(() => {}) : null)), new Promise(r => setTimeout(r, 1500))]);
    this.layout();
    this.page = toEnd ? this.pages - 1 : this.charToPage(c || 0);
    this.draw();
  },
  layout(){
    const pg = $('#rdPage'), el = $('#rdSec');
    if (!pg || !el) return;
    const W = pg.clientWidth, H = pg.clientHeight;
    const cpv = W >= 900 ? 2 : 1, G = cpv > 1 ? 64 : 40;
    const colW = Math.floor((W - (cpv - 1) * G) / cpv);
    el.style.columnWidth = colW + 'px';
    el.style.columnGap = G + 'px';
    el.style.height = H + 'px';
    el.style.width = W + 'px';
    el.style.setProperty('--img-h', (H - 8) + 'px');
    this.step = W + G;
    const n = Math.max(1, Math.round((el.scrollWidth + G) / (colW + G)));
    this.pages = Math.max(1, Math.ceil(n / cpv));
    this.index();
  },
  relayout(){
    if (!$('#rdSec')) return;
    const c = this.charAt(this.page || 0);
    this.layout();
    this.page = this.charToPage(c);
    this.draw(true);
  },
  index(){
    const el = $('#rdSec');
    this.tn = []; this.ts = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n, pos = 0;
    while ((n = w.nextNode())){ this.tn.push(n); this.ts.push(pos); pos += n.data.length; }
    this.len = pos;
  },
  locate(c){
    const ts = this.ts;
    let lo = 0, hi = ts.length - 1;
    while (lo < hi){ const m = (lo + hi + 1) >> 1; if (ts[m] <= c) lo = m; else hi = m - 1; }
    return [this.tn[lo], c - ts[lo]];
  },
  charToPage(c){
    if (!this.tn.length || c <= 0) return 0;
    if (c >= this.len) return this.pages - 1;
    const [node, off] = this.locate(c);
    const r = document.createRange();
    r.setStart(node, Math.min(off, node.data.length - 1));
    r.setEnd(node, Math.min(off + 1, node.data.length));
    const rect = r.getClientRects()[0] || r.getBoundingClientRect();
    const base = $('#rdSec').getBoundingClientRect().left;
    return Math.max(0, Math.min(this.pages - 1, Math.floor((rect.left - base + 2) / this.step)));
  },
  charAt(p){
    if (p <= 0 || !this.tn.length) return 0;
    let lo = 0, hi = this.len;
    while (lo < hi){ const m = (lo + hi) >> 1; if (this.charToPage(m) >= p) hi = m; else lo = m + 1; }
    return lo;
  },
  draw(silent){
    const el = $('#rdSec');
    el.style.transform = `translateX(${-this.page * this.step}px)`;
    const c = this.charAt(this.page);
    const g = this.before[this.sec] + c;
    const chap = this.chapter(this.sec, c);
    $('#rdChap').textContent = chap ? chap.l : '';
    savePos({ s: this.sec, c }, g / this.total, `${Math.round(100 * g / this.total)}%`);
    if (!silent) flash();
  },
  chapter(s, c){ let last = null; for (const t of this.b.toc || []) if (t.s < s || (t.s === s && t.c <= c)) last = t; return last; },
  tocActive(){ const t = this.chapter(this.sec, this.charAt(this.page)); return t ? (this.b.toc || []).indexOf(t) : -1; },
  async next(){
    selbar.hide();
    if (this.page < this.pages - 1){ this.page++; this.draw(); showChrome(false); }
    else if (this.sec < this.c.sections.length - 1){ await this.load(this.sec + 1, 0); showChrome(false); }
    else toast('Fim do livro.');
  },
  async prev(){
    selbar.hide();
    if (this.page > 0){ this.page--; this.draw(); }
    else if (this.sec > 0) await this.load(this.sec - 1, 0, true);
  },
  async goto(s, c){ if (s !== this.sec) await this.load(s, c); else { this.page = this.charToPage(c); this.draw(); } },
  gotoPct(p){
    const g = Math.round(p * this.total);
    let s = 0; while (s < this.c.lens.length - 1 && this.before[s + 1] <= g) s++;
    this.goto(s, g - this.before[s]);
  },
  gotoToc(t){ this.goto(t.s, t.c); },
  async gotoHl(x){ await this.goto(x.s, x.a); this.blink(x.id); },
  blink(id){ $('#rdSec').querySelectorAll(`[data-h="${id}"]`).forEach(m => { m.classList.remove('blink'); void m.offsetWidth; m.classList.add('blink'); }); },
  link(href, a){
    const pos = this.c.anchors[href] || this.c.anchors[href.split('#')[0]];
    if (!pos) return;
    // nota de rodapé: mostra numa janela, sem sair da página
    const t = document.createElement('template');
    t.innerHTML = this.c.sections[pos[0]];
    const target = t.content.querySelector(`[data-a="${CSS.escape(href)}"]`);
    const block = target && (target.closest('.fn,li,p,aside,div') || target);
    const isNote = a.classList.contains('noteref') || (target && target.closest('.fn')) || /^\[?\d{1,3}\]?$|^[*†‡]$/.test(a.textContent.trim());
    if (isNote && block && block.textContent.trim().length > 1){
      modal('Nota', h('p', { class: 'fn-text', text: block.textContent.replace(/\s+/g, ' ').trim() }), [{ label: 'Ir até a nota', onclick: () => this.goto(pos[0], pos[1]) }, { label: 'Fechar', primary: true }]);
      return;
    }
    this.goto(pos[0], pos[1]);
  },

  /* destaques desta seção */
  paintHl(){
    const el = $('#rdSec');
    const list = hlOf(this.b.id).filter(x => x.s === this.sec).sort((a, b) => a.a - b.a);
    for (const x of list){
      wrapOffsets(el, x.a, x.b, () => {
        const m = document.createElement('mark');
        m.className = 'hl c-' + x.color + (x.note ? ' has-note' : '');
        m.dataset.h = x.id;
        return m;
      });
    }
  },
  repaint(){
    const el = $('#rdSec');
    if (!el) return;
    el.querySelectorAll('mark[data-h]').forEach(m => m.replaceWith(...m.childNodes));
    el.normalize();
    this.paintHl();
    this.index();
  },
  onSelect(){
    const s = getSelection(), el = $('#rdSec');
    if (!el || !s || s.isCollapsed || !s.rangeCount) return;
    const r = s.getRangeAt(0);
    if (!el.contains(r.commonAncestorContainer)) return;
    const text = s.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 2) return;
    const pre = document.createRange();
    pre.setStart(el, 0); pre.setEnd(r.startContainer, r.startOffset);
    const a = pre.toString().length, b = a + r.toString().length;
    const rects = r.getClientRects(), last = rects[rects.length - 1] || r.getBoundingClientRect();
    selbar.show(last, selActions({ text, make: color => { const x = newHl({ s: this.sec, a, b, text, color }); this.repaint(); return x; } }));
  },

  /* busca no livro todo */
  async search(q, emit){
    const nq = norm(q);
    this.plain ||= this.c.sections.map(html => { const t = document.createElement('template'); t.innerHTML = html; return t.content.textContent; });
    for (let s = 0; s < this.plain.length; s++){
      const txt = this.plain[s], low = norm(txt);
      let i = low.indexOf(nq);
      while (i > -1){
        const ch = this.chapter(s, i);
        if (emit({ s, c: i, len: q.length, pre: '…' + txt.slice(Math.max(0, i - 50), i), mid: txt.slice(i, i + q.length), post: txt.slice(i + q.length, i + q.length + 70) + '…', label: ch ? clip(ch.l, 30) : '' }) === false) return;
        i = low.indexOf(nq, i + nq.length);
      }
      if (s % 20 === 19) await new Promise(r => setTimeout(r));
    }
  },
  async gotoHit(hit){
    await this.goto(hit.s, hit.c);
    const el = $('#rdSec');
    wrapOffsets(el, hit.c, hit.c + hit.len, () => h('mark', { class: 'hit' }));
    this.index();
    setTimeout(() => { el.querySelectorAll('mark.hit').forEach(m => m.replaceWith(...m.childNodes)); el.normalize(); this.index(); }, 2600);
  },
};

/* Embrulha o trecho [a, b) do texto de root em elementos criados por mk() */
function wrapOffsets(root, a, b, mk){
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts = [];
  let n, pos = 0;
  while ((n = w.nextNode())){
    const L = n.data.length, s = Math.max(a, pos), e = Math.min(b, pos + L);
    if (s < e) parts.push([n, s - pos, e - pos]);
    pos += L;
    if (pos >= b) break;
  }
  for (const [node, s, e] of parts){
    let t = node;
    if (s > 0) t = t.splitText(s);
    if (e - s < t.data.length) t.splitText(e - s);
    if (!t.data.trim() && parts.length > 1) continue;
    const m = mk();
    t.parentNode.insertBefore(m, t);
    m.appendChild(t);
  }
}
