/* =====================================================================
   Ler: biblioteca e leitor
   ---------------------------------------------------------------------
   Três motores, a mesma moldura (barras, lateral, Aa, seleção):
   · EPUB, MOBI/AZW3, FB2 e CBZ: foliate-js (js/folio.js), com o arquivo
     original guardado; posição e marcações em EPUB CFI.
   · PDF: js/pdf.js, sobre o pdf.js 5.
   · TXT, livros importados antes do foliate e os do INK: o motor antigo
     (FlowEngine, aqui embaixo), que trabalha com o texto convertido;
     posição e marcações por caractere (seção + início + fim).
   ===================================================================== */
'use strict';

/* ---------- Ajustes de leitura ---------- */
const RS_KEY = 'caderno-leitor';
const RS = { font: 'serif', size: 19, lh: 1.6, margin: 'm', just: true, theme: 'papel', awake: true, layout: 'pagina', measure: 'm', trTo: 'pt-BR', trOnline: true, trDock: false, trPos: null };
try { Object.assign(RS, JSON.parse(localStorage.getItem(RS_KEY) || '{}')); } catch (e) {}
/* v2 da moldura: a tradução abre ao lado do texto (solta continua opção)
   e a barra lateral lembra a aba em que ficou. */
if (!RS.moldura2){ RS.moldura2 = 1; RS.trDock = true; RS.lado = ''; }
/* v3: o tema Auto acompanha o modo claro/escuro do Caderno */
if (!RS.moldura3){ RS.moldura3 = 1; if (RS.theme === 'papel') RS.theme = 'auto'; }
const saveRS = () => { try { localStorage.setItem(RS_KEY, JSON.stringify(RS)); } catch (e) {} };
const THEMES = [
  { id: 'auto',  name: 'Auto' },
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

/* A moldura no desenho do Escritor: barra fina de vidro com o título no
   meio; à esquerda, voltar; à direita, as ferramentas de estudo (ícone e
   nome, o nome some em tela estreita). Sumário, Marcações e Buscar abrem
   numa barra lateral que EMPURRA o texto: dá para percorrer as marcações
   ou o sumário sem parar de ler. A tradução fica do outro lado (ou solta,
   numa janela que se arrasta) e o Aa desce do próprio botão. No celular,
   lateral e Aa viram folhas que sobem de baixo. */
function rdFerr(id, icone, rotulo, titulo, acao){
  return h('button', { class: 'rd-ferr', type: 'button', id, title: titulo, 'aria-label': rotulo, onclick: acao }, ico(icone), h('span', { class: 'rot', text: rotulo }));
}
function buildReader(){
  const el = RD.el;
  el.replaceChildren(
    h('header', { class: 'rd-top' },
      h('div', { class: 'rd-esq' },
        h('button', { class: 'rd-ferr rd-voltar', type: 'button', title: 'Voltar à biblioteca', 'aria-label': 'Voltar à biblioteca', onclick: () => popLayer() }, ico('chevron-left'), h('span', { class: 'rot', text: 'Biblioteca' }))),
      h('div', { class: 'rd-title' }, h('b', { id: 'rdTitle' }), h('span', { id: 'rdChap' })),
      h('div', { class: 'rd-dir' },
        rdFerr('rdBtoc', 'list-tree', 'Sumário', 'Sumário', () => lado('toc')),
        rdFerr('rdBhl', 'highlighter', 'Marcações', 'Marcações e notas do livro', () => lado('hl')),
        rdFerr('rdBbusca', 'search', 'Buscar', 'Buscar no livro (Ctrl+F)', () => lado('busca')),
        h('span', { class: 'rd-sep', 'aria-hidden': 'true' }),
        /* OCR: só nos PDFs; o ícone acende quando a página na tela é escaneada e ainda não foi lida */
        h('button', { class: 'rd-ferr', type: 'button', id: 'rdBocr', hidden: true, title: 'Reconhecer o texto (OCR)', 'aria-label': 'OCR', onclick: () => RD.eng && RD.eng.menuOcr && RD.eng.menuOcr() }, ico('scan-text'), h('span', { class: 'rot', text: 'OCR' })),
        rdFerr('rdBtr', 'languages', 'Traduzir', 'Traduzir a página', () => traducao()),
        h('button', { class: 'rd-ferr rd-aa-btn', type: 'button', id: 'rdBaa', title: 'Ajustes de leitura', 'aria-label': 'Ajustes de leitura', onclick: () => aaAbrir() }, h('span', { class: 'ico-aa', text: 'Aa' })))),
    h('aside', { class: 'rd-lado', id: 'rdLado', hidden: true, 'aria-label': 'Barra lateral' }),
    h('div', { class: 'rd-stage', id: 'rdStage' }),
    h('aside', { class: 'rd-tr', id: 'rdTr', hidden: true, 'aria-label': 'Tradução' }),
    h('footer', { class: 'rd-bot' },
      h('input', { type: 'range', id: 'rdRange', min: 0, max: 1000, value: 0, 'aria-label': 'Posição no livro' }),
      h('span', { id: 'rdPos' })),
    h('div', { class: 'rd-aa', id: 'rdAa', hidden: true, role: 'dialog', 'aria-label': 'Ajustes de leitura' }),
    h('div', { class: 'rd-veu', id: 'rdVeu', hidden: true, 'aria-hidden': 'true', onclick: () => popLayer() }),
    h('div', { class: 'rd-flash', id: 'rdFlash' }));
  $('#rdRange').addEventListener('change', e => RD.eng.gotoPct(e.target.value / 1000));
  $('#rdRange').addEventListener('input', e => { $('#rdPos').textContent = Math.round(e.target.value / 10) + '%'; });
  RD.lado = ''; RD.tr = false; RD.aa = false; RD.folha = '';
  rdLayout.ultima = undefined;
}

function applyRS(){
  const el = RD.el;
  const tema = RS.theme === 'auto' ? (typeof escuroAtivo === 'function' && escuroAtivo() ? 'noite' : 'papel') : RS.theme;
  el.dataset.theme = tema;
  document.body.dataset.rdtheme = tema;
  el.style.setProperty('--rd-size', (RS.size + (RS.theme === 'sol' ? 1 : 0)) + 'px');
  el.style.setProperty('--rd-lh', RS.lh);
  el.style.setProperty('--rd-mx', { s: '14px', m: '26px', l: '48px' }[RS.margin] || '26px');
  el.dataset.font = RS.font;
  el.dataset.layout = RS.layout;
  el.style.setProperty('--rd-measure', Math.round(RS.size * ({ s: 28, m: 35, l: 44 }[RS.measure] || 35)) + 'px');
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
  /* PDF no motor de PDF; EPUB, MOBI, FB2 e CBZ com arquivo guardado no
     foliate (js/folio.js); o resto (TXT, livros antigos e os do INK) no
     leitor antigo, que trabalha com o texto já convertido. */
  const temArq = b.eng === 'folio' && !!(await DB.get('arq:' + b.id));
  RD.eng = b.type === 'PDF' ? PdfEngine : temArq ? FolioEngine : FlowEngine;
  try { await RD.eng.open(b); }
  catch (e) { toast('Não consegui abrir: ' + (e.message || e)); popLayer(); return; }
  if (RD.eng === FlowEngine && b.type === 'EPUB' && !b.avisoNovo){
    b.avisoNovo = 1; putI('books', b);
    setTimeout(() => toast('Este livro está no leitor antigo. Adicione o mesmo arquivo EPUB de novo para abrir no leitor novo: posição e marcações vêm junto.', 'Escolher arquivo', () => $('#bookFile').click()), 900);
  }
  if (RS.awake) wantAwake(true);
  showChrome(true);
  if (RS.lado && RS.lado !== 'busca' && !estreito()) lado(RS.lado, true);
}
function closeReader(){
  try { RD.eng && RD.eng.close(); } catch (e) {}
  if (RD.book){ RD.book.last = Date.now(); putI('books', RD.book); }
  RD.el.hidden = true; RD.el.replaceChildren(); RD.el.classList.remove('dividido', 'com-lado', 'com-tr');
  delete document.body.dataset.rdtheme;
  RD.book = null; RD.eng = null;
  document.body.classList.remove('reading');
  selbar.hide();
  wantAwake(false);
  document.querySelector('meta[name="theme-color"]').content = typeof escuroAtivo === 'function' && escuroAtivo() ? '#191a1c' : '#ffffff';
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

/* ---------- Painéis do leitor ----------
   lado(tab)   barra lateral: Sumário, Marcações, Buscar
   traducao()  tradução ao lado do texto ou numa janela solta
   aaAbrir()   ajustes de leitura, descendo do botão Aa
   Em tela larga a lateral e a tradução são ferramentas fixas: não
   escurecem nada, o texto se ajusta ao espaço que sobra. No celular
   (ou janela estreita) viram folhas sobre o texto e entram na pilha do
   Voltar. */
const estreito = () => innerWidth < 760;
const LADO_ABAS = [['toc', 'Sumário'], ['hl', 'Marcações'], ['busca', 'Buscar']];
const LADO_FN = () => ({ toc: panelToc, hl: panelHl, busca: panelSearch });

function lado(tab, quieto){
  const p = $('#rdLado'); if (!p) return;
  if (RD.lado === tab && !quieto){ ladoFechar(); return; }
  const novo = !RD.lado;
  RD.lado = tab;
  if (!estreito()){ RS.lado = tab; saveRS(); }
  const abas = h('div', { class: 'rl-abas', role: 'tablist' }, LADO_ABAS.map(([k, l]) =>
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === tab), class: k === tab ? 'on' : '', text: l, onclick: () => { if (k !== RD.lado) lado(k); } })));
  p.replaceChildren(
    h('div', { class: 'rl-head' }, abas,
      h('button', { class: 'rd-x', type: 'button', 'aria-label': 'Fechar a barra lateral', title: 'Fechar (Esc)', onclick: () => ladoFechar() }, ico('x'))),
    h('div', { class: 'rl-body' }, LADO_FN()[tab]()));
  p.hidden = false; p.dataset.tab = tab;
  if (estreito()){ if (novo){ RD.folha = 'lado'; folhaAbrir(() => ladoFechar(true)); } }
  rdLayout();
  if (tab === 'toc') requestAnimationFrame(() => p.querySelector('.toc li.on')?.scrollIntoView({ block: 'center' }));
}
function ladoFechar(doVoltar){
  const p = $('#rdLado'); if (!p || !RD.lado) return;
  if (RD.folha === 'lado' && !doVoltar){ popLayer(); return; }
  RD.lado = ''; p.hidden = true; p.replaceChildren();
  if (RD.folha === 'lado') folhaFechar();
  if (!estreito()){ RS.lado = ''; saveRS(); }
  rdLayout();
}
/* Depois de pular para um trecho: no celular a folha sai; na tela larga
   a lateral fica, para o próximo pulo. */
function rdNavegou(){ if (RD.folha === 'lado') popLayer(); }
/* Redesenha uma aba aberta (marcação nova, nota editada, página virada) */
function rdRefresh(tab){
  if (tab === 'tr'){
    if (!RD.tr) return;
    const corpo = $('#rdTr .rt-body'), velho = corpo && corpo.querySelector('.tr-page');
    if (!corpo || !velho){ traducao(true); return; }
    corpo.replaceChildren(panelTr(velho));
    return;
  }
  if (RD.lado === tab){ const st = $('#rdLado .rl-body')?.scrollTop || 0; lado(tab, true); const b = $('#rdLado .rl-body'); if (b) b.scrollTop = st; }
}
const panelSwap = k => k === 'tr' ? rdRefresh('tr') : k === 'aa' ? aaAbrir(true) : rdRefresh(k);

/* Tradução: ao lado (padrão) ou solta */
function traducao(refazer){
  const p = $('#rdTr'); if (!p) return;
  if (RD.tr && !refazer){ trFechar(); return; }
  const novo = !RD.tr;
  RD.tr = true;
  const solta = !RS.trDock;
  const head = h('div', { class: 'rt-head' },
    h('b', { text: 'Tradução' }),
    h('div', { class: 'rt-acts' },
      h('button', { class: 'rd-ferr', type: 'button', title: solta ? 'Pôr ao lado do texto' : 'Soltar numa janela que se arrasta', 'aria-label': solta ? 'Ao lado' : 'Soltar',
        onclick: () => { RS.trDock = !RS.trDock; saveRS(); traducao(true); } }, ico(solta ? 'columns-2' : 'picture-in-picture-2'), h('span', { class: 'rot', text: solta ? 'Ao lado' : 'Soltar' })),
      h('button', { class: 'rd-x', type: 'button', 'aria-label': 'Fechar a tradução', title: 'Fechar', onclick: () => trFechar() }, ico('x'))));
  p.replaceChildren(head, h('div', { class: 'rt-body' }, panelTr()));
  p.hidden = false;
  p.classList.toggle('solta', solta);
  if (solta){
    const pos = RS.trPos;
    if (pos){ p.style.left = Math.max(8, Math.min(innerWidth - 320, pos.x)) + 'px'; p.style.top = Math.max(8, Math.min(innerHeight - 160, pos.y)) + 'px'; }
    else { p.style.left = ''; p.style.top = ''; }
    arrastavel(p, head, pos => { RS.trPos = pos; saveRS(); });
  } else { p.style.left = ''; p.style.top = ''; head.onpointerdown = null; }
  rdLayout();
}
function trFechar(){
  const p = $('#rdTr'); if (!p || !RD.tr) return;
  RD.tr = false; p.hidden = true; p.replaceChildren();
  rdLayout();
}

/* O texto ocupa o que sobra entre a lateral e a tradução */
function rdLayout(){
  const el = RD.el; if (!el) return;
  const larga = !estreito();
  el.classList.toggle('com-lado', !!RD.lado && larga);
  el.classList.toggle('com-tr', RD.tr && !!RS.trDock);
  el.classList.toggle('dividido', RD.tr && !!RS.trDock);
  for (const [id, on] of [['rdBtoc', RD.lado === 'toc'], ['rdBhl', RD.lado === 'hl'], ['rdBbusca', RD.lado === 'busca'], ['rdBtr', RD.tr], ['rdBaa', RD.aa]]){
    const b = document.getElementById(id); if (b) b.setAttribute('aria-pressed', String(on));
  }
  /* os motores refazem as páginas sozinhos (ResizeObserver no palco);
     o texto some por um instante enquanto isso, em vez de pular à vista */
  const assin = (RD.lado && larga ? 'L' : '') + (RD.tr && RS.trDock ? 'T' : '');
  /* só o leitor antigo repagina aos saltos; PDF e foliate ajustam no lugar */
  if (RD.eng === FlowEngine && rdLayout.ultima !== undefined && rdLayout.ultima !== assin){
    const st = $('#rdStage');
    if (st){ st.classList.add('refaz'); clearTimeout(rdLayout.f); rdLayout.f = setTimeout(() => st.classList.remove('refaz'), 380); }
  }
  rdLayout.ultima = assin;
}
addEventListener('resize', () => { if (RD.eng){ clearTimeout(rdLayout.t); rdLayout.t = setTimeout(rdLayout, 120); } });

/* Folha (celular): véu leve, entra no Voltar */
function folhaAbrir(fechar){
  const v = $('#rdVeu'); if (v) v.hidden = false;
  pushLayer(() => { fechar(); });
}
function folhaFechar(){ RD.folha = ''; const v = $('#rdVeu'); if (v && !RD.aa) v.hidden = true; }

/* Aa: desce do botão (na tela larga) ou sobe de baixo (no celular) */
function aaAbrir(refazer){
  const p = $('#rdAa'), b = $('#rdBaa'); if (!p) return;
  if (RD.aa && !refazer){ popLayer(); return; }
  const st = p.querySelector('.aa')?.scrollTop || 0;
  p.replaceChildren(panelAa());
  const mod = p.querySelector('#aaModelos');
  if (mod) import(new URL('js/bergamot.mjs', document.baseURI).href).then(m => m.guardado())
    .then(n => { mod.textContent = n ? (n / 1048576).toFixed(n > 1e8 ? 0 : 1).replace('.', ',') + ' MB' : 'nenhum'; }).catch(() => { mod.textContent = '—'; });
  const novo = !RD.aa;
  RD.aa = true; p.hidden = false;
  p.querySelector('.aa').scrollTop = st;
  if (!estreito() && b){
    const r = b.getBoundingClientRect();
    p.style.top = (r.bottom + 6) + 'px';
    p.style.right = Math.max(8, innerWidth - r.right - 6) + 'px';
  } else { p.style.top = ''; p.style.right = ''; }
  if (novo){
    if (estreito()) $('#rdVeu').hidden = false;
    pushLayer(() => { RD.aa = false; p.hidden = true; p.replaceChildren(); if (!RD.folha) $('#rdVeu').hidden = true; rdLayout(); });
  }
  rdLayout();
}
/* Chave do Claude: só neste aparelho, nunca na sincronização */
function aaClaude(){
  const lib = () => import(new URL('js/claude.mjs', document.baseURI).href);
  const inp = h('input', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', 'aria-label': 'Chave da API do Claude' });
  const st = h('span', { class: 'muted small', text: '…' });
  lib().then(m => { const k = m.chave(); inp.value = k; st.textContent = k ? 'chave guardada neste aparelho' : 'sem chave'; });
  return h('div', { class: 'form aa-libre' },
    inp,
    h('div', { class: 'aa-row' }, st,
      h('button', { type: 'button', class: 'btn ghost small', text: 'Guardar e testar', onclick: async () => {
        const m = await lib(); m.guardaChave(inp.value); st.textContent = 'testando…';
        try { const t = await m.testa(); st.textContent = 'funcionando: “Bom dia.” → “' + t + '”'; }
        catch (e) { st.textContent = e.status === 401 ? 'chave inválida' : 'não deu: ' + (e.message || e); }
      } })),
    h('p', { class: 'muted small aa-tip', text: 'Tradução literária com contexto: o Claude (Opus 5.5) recebe o trecho com o parágrafo em volta e o título do livro, e resolve quem fala, gênero e a quem pertence o quê. O trecho sai do aparelho para a Anthropic e cada tradução custa uns centavos na sua conta da API (console.anthropic.com). A chave fica só neste navegador. Sem internet, ou se falhar, cai para o tradutor no aparelho.' }));
}
/* clicar fora do Aa fecha (sem virar a página por engano) */
document.addEventListener('pointerdown', e => {
  if (!RD.aa || estreito()) return;
  if (e.target.closest('#rdAa,#rdBaa,#modal,.toast')) return;
  e.preventDefault(); e.stopPropagation();
  popLayer();
}, true);
/* algo cobre o texto? então cliques e setas não viram a página */
const rdSobreposto = () => RD.aa || !!RD.folha;

/* Arrastar uma janela pelo cabeçalho (mouse, dedo ou caneta) */
function arrastavel(el, alca, aoSoltar){
  alca.onpointerdown = (e) => {
    if (e.button !== 0 || e.target.closest('button,select,input')) return;
    e.preventDefault();
    const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    el.classList.add('arrastando');
    alca.setPointerCapture(e.pointerId);
    const mover = (ev) => {
      const x = Math.max(8, Math.min(innerWidth - r.width - 8, ev.clientX - dx));
      const y = Math.max(8, Math.min(innerHeight - 60, ev.clientY - dy));
      el.style.left = x + 'px'; el.style.top = y + 'px';
    };
    const soltar = () => {
      alca.removeEventListener('pointermove', mover);
      el.classList.remove('arrastando');
      const q = el.getBoundingClientRect();
      aoSoltar && aoSoltar({ x: Math.round(q.left), y: Math.round(q.top) });
    };
    alca.addEventListener('pointermove', mover);
    alca.addEventListener('pointerup', soltar, { once: true });
    alca.addEventListener('pointercancel', soltar, { once: true });
  };
}

function panelToc(){
  const toc = (RD.eng && RD.eng.toc) || RD.book.toc || [];
  if (!toc.length) return h('p', { class: 'muted pad', text: 'Este arquivo não traz sumário.' });
  const act = RD.eng.tocActive();
  return h('ol', { class: 'rp-list toc' }, toc.map((t, i) => h('li', { class: (i === act ? 'on ' : '') + 'd' + (t.d || 0) },
    h('button', { type: 'button', onclick: () => { rdNavegou(); RD.eng.gotoToc(t); } }, h('span', { text: t.l }), t.p ? h('i', { text: t.p }) : null))));
}

let hlFilter = '';
function panelHl(){
  const b = RD.book;
  const all = hlOf(b.id).sort(hlOrdem(b));
  const list = hlFilter ? all.filter(x => x.color === hlFilter) : all;
  const notes = live('notes').filter(n => n.src && n.src.t === 'livro' && n.src.id === b.id).sort((x, y) => (y.u || 0) - (x.u || 0));
  const count = c => all.filter(x => x.color === c).length;
  return h('div', {},
    h('div', { class: 'rp-actions' },
      h('button', { class: 'btn small', type: 'button', text: '+ Nota do livro', onclick: () => bookNote() }),
      all.length ? h('button', { class: 'btn ghost small', type: 'button', text: 'Fichamento', title: 'Uma nota com todas as marcações, para escrever em cima', onclick: () => fichamento(b) }) : null,
      all.length ? h('button', { class: 'btn ghost small', type: 'button', text: 'Exportar .md', onclick: () => exportBookMd(b) }) : null),
    notes.length ? h('ol', { class: 'rp-list rp-notes' }, notes.map(n => h('li', {}, h('button', { type: 'button', onclick: () => openNote(n.id) },
      h('span', {}, h('b', { text: noteTitle(n) }), h('br'), h('small', { text: snippet(noteRest(n), 90) })), h('i', { text: fmtDay(n.u || n.created) }))))) : null,
    all.length ? h('div', { class: 'rp-filter' },
      h('button', { type: 'button', class: 'cf-all' + (!hlFilter ? ' on' : ''), text: `Todas ${all.length}`, onclick: () => { hlFilter = ''; panelSwap('hl'); } }),
      HL_COLORS.filter(c => count(c.id)).map(c => h('button', { type: 'button', class: 'cf-n dot-' + c.id + (hlFilter === c.id ? ' on' : ''), title: hlColorName(c.id), onclick: () => { hlFilter = hlFilter === c.id ? '' : c.id; panelSwap('hl'); } }, h('i'), String(count(c.id)))),
      h('button', { type: 'button', class: 'cf-clear', text: 'Remover…', onclick: () => clearMarks(b, list) })) : null,
    list.length ? h('ol', { class: 'rp-list hls' }, list.map(x => h('li', { class: 'c-' + x.color + ' s-' + (x.style || 'marca') },
      h('button', { type: 'button', class: 'hl-go', onclick: () => { rdNavegou(); RD.eng.gotoHl(x); } },
        h('span', { class: 'hl-txt', text: clip(x.text, 280) }),
        x.tr ? h('span', { class: 'hl-tr', text: x.tr }) : null,
        x.note ? h('span', { class: 'hl-note', text: x.note }) : null,
        h('i', {}, h('span', { class: 'sty-mini s-' + (x.style || 'marca'), text: 'ab' }), [hlColorName(x.color), hlStyleName(x.style), x.page ? 'p. ' + x.page : ''].filter(Boolean).join(' · '))),
      h('div', { class: 'hl-acts' },
        h('button', { type: 'button', text: x.note ? 'Editar nota' : 'Nota', onclick: () => editNote(x.note, v => { x.note = v; putI('hl', x); RD.eng.repaint(); panelSwap('hl'); }) }),
        h('button', { type: 'button', text: 'Cartão', onclick: () => cardFromHl(x) }),
        h('button', { type: 'button', class: 'danger', text: 'Remover', onclick: () => removeHls([x]) }))))) :
      h('p', { class: 'muted pad', text: all.length ? 'Nenhuma marcação nesta cor.' : 'Selecione um trecho do texto para marcar. No celular: toque e segure numa palavra e arraste as alças.' }));
}
/* Ordem das marcações no livro: página no PDF; posição (0 a 1) no
   foliate; seção e caractere no leitor antigo */
function hlOrdem(b){
  return (x, y) => b.type === 'PDF' ? (x.page - y.page) || (x.y || 0) - (y.y || 0)
    : (x.f != null && y.f != null) ? x.f - y.f
    : ((x.s ?? 1e9) - (y.s ?? 1e9)) || ((x.a || 0) - (y.a || 0)) || ((x.f ?? 0) - (y.f ?? 0));
}
/* Remover várias de uma vez: da cor escolhida, do capítulo ou do livro */
function clearMarks(b, shown){
  const all = hlOf(b.id);
  const opts = [];
  if (hlFilter) opts.push([`As ${shown.length} em ${hlColorName(hlFilter).toLowerCase()}`, shown]);
  if (b.type !== 'PDF' && RD.eng && RD.eng.sec != null){
    const here = all.filter(x => RD.eng.noCapitulo ? RD.eng.noCapitulo(x) : x.s === RD.eng.sec);
    if (here.length) opts.push([`As ${here.length} deste capítulo`, here]);
  } else if (b.type === 'PDF' && RD.eng.cur){
    const here = all.filter(x => x.page === RD.eng.cur);
    if (here.length) opts.push([`As ${here.length} desta página`, here]);
  }
  opts.push([`Todas as ${all.length} do livro`, all]);
  let pick = 0;
  const box = h('div', { class: 'form' }, opts.map(([l], i) => h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'clr', checked: i === 0, onchange: () => { pick = i; } }), l)),
    h('p', { class: 'muted small', text: 'Dá para desfazer logo em seguida, no aviso que aparece embaixo.' }));
  modal('Remover marcações', box, [{ label: 'Cancelar' }, { label: 'Remover', danger: true, onclick: () => { whenClosed(() => removeHls(opts[pick][1])); } }]);
}

/* Traduzir a página que está na tela */
function panelTr(anterior){
  const to = RS.trTo || 'pt-BR';
  /* ao virar a página, a tradução anterior fica (esmaecida) até a nova
     chegar: nada de piscar "Traduzindo…" a cada página */
  const out = anterior || h('div', { class: 'tr-page' }, h('p', { class: 'muted pad', text: 'Traduzindo a página…' }));
  if (anterior) out.classList.add('atualizando');
  const sel = h('select', { 'aria-label': 'Traduzir para', onchange: e => { RS.trTo = e.target.value; saveRS(); rdRefresh('tr'); } },
    TR_LANGS.map(([c, n]) => h('option', { value: c, selected: c === to, text: n })));
  const nav = (dir) => async () => { await (dir > 0 ? RD.eng.next() : RD.eng.prev()); rdRefresh('tr'); };
  const blocks = RD.eng.visibleBlocks ? RD.eng.visibleBlocks() : [];
  (async () => {
    if (!blocks.length){ out.replaceChildren(h('p', { class: 'muted pad', text: 'Não achei texto nesta página. Se for um PDF escaneado, ele não tem texto para traduzir.' })); return; }
    try {
      const r = await translateMany(blocks, to, undefined, {});
      out.classList.remove('atualizando');
      out.replaceChildren(
        h('p', { class: 'muted small pad-x', text: r.via === 'mesma' ? `O texto já está em ${trLangName(to)}.` : `${trLangName(r.from)} → ${trLangName(to)} · ${r.via}` }),
        ...blocks.map((b0, i) => h('div', { class: 'tr-pair' },
          h('p', { class: 'tr-o', text: b0 }),
          h('p', { class: 'tr-t', text: r.out[i] }))));
    } catch (e) {
      out.classList.remove('atualizando');
      out.replaceChildren(h('p', { class: 'muted pad', text: e.message && !/fetch|network/i.test(e.message) ? e.message : 'Sem internet, e este navegador não tem tradutor no aparelho.' }));
    }
  })();
  return h('div', {},
    h('div', { class: 'rp-actions tr-bar' },
      sel,
      RD.eng.paged || RD.book.type === 'PDF' ? h('span', { class: 'tr-nav pdf-zoom', role: 'group' },
        h('button', { type: 'button', title: 'Página anterior', 'aria-label': 'Página anterior', onclick: nav(-1) }, ico('chevron-left')),
        h('button', { type: 'button', title: 'Próxima página', 'aria-label': 'Próxima página', onclick: nav(1) }, ico('chevron-right'))) : null),
    out);
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
      out.append(h('li', {}, h('button', { type: 'button', onclick: () => { rdNavegou(); RD.eng.gotoHit(hit); } },
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
    /* temas como amostras: o papel e a tinta de cada um */
    h('div', { class: 'aa-temas', role: 'radiogroup', 'aria-label': 'Tema' }, THEMES.map(t => h('button', { type: 'button', role: 'radio', 'aria-checked': String(t.id === RS.theme), class: 'aa-tema tm-' + t.id + (t.id === RS.theme ? ' on' : ''),
      onclick: () => {
        RS.theme = t.id; saveRS(); applyRS(); RD.eng.relayout(); panelSwap('aa');
        if (t.id === 'sol' && !RS.solTip){ RS.solTip = 1; setTimeout(() => toast('Modo Sol: contraste máximo e letra mais grossa. Suba o brilho do celular no máximo; a tela não fica menos refletiva, mas o texto vence o reflexo.'), 400); }
      } }, h('i', { text: 'Aa' }), h('span', { text: t.name })))),
    pdf ? null : h('div', { class: 'aa-tam' },
      h('button', { type: 'button', class: 'aa-menor', 'aria-label': 'Letra menor', text: 'A', onclick: () => { RS.size = Math.max(13, RS.size - 1); saveRS(); applyRS(); RD.eng.relayout(); $('#aaTam').textContent = RS.size + ' px'; } }),
      h('span', { id: 'aaTam', text: RS.size + ' px' }),
      h('button', { type: 'button', class: 'aa-maior', 'aria-label': 'Letra maior', text: 'A', onclick: () => { RS.size = Math.min(34, RS.size + 1); saveRS(); applyRS(); RD.eng.relayout(); $('#aaTam').textContent = RS.size + ' px'; } })),
    pdf ? null : h('h3', { text: 'Letra' }),
    pdf ? null : seg(RD.eng === FolioEngine ? [['livro', 'Do livro'], ['serif', 'Serifa'], ['sans', 'Inter']] : [['serif', 'Serifa'], ['sans', 'Inter']], RD.eng !== FolioEngine && RS.font === 'livro' ? 'serif' : RS.font, v => { RS.font = v; }),
    pdf ? null : h('h3', { text: 'Entrelinha' }),
    pdf ? null : seg([[1.4, 'Justa'], [1.6, 'Normal'], [1.85, 'Folgada']], RS.lh, v => { RS.lh = v; }),
    pdf ? null : h('h3', { text: 'Margens' }),
    pdf ? null : seg([['s', 'Estreitas'], ['m', 'Médias'], ['l', 'Largas']], RS.margin, v => { RS.margin = v; }),
    pdf ? null : h('h3', { text: 'Alinhamento' }),
    pdf ? null : seg([[true, 'Justificado'], [false, 'À esquerda']], RS.just, v => { RS.just = v; }),
    pdf ? null : h('h3', { text: 'Página' }),
    pdf ? null : seg([['pagina', 'Uma página'], ['dupla', 'Duas lado a lado'], ['rolar', 'Rolagem']], RS.layout, v => { RS.layout = v; }),
    pdf ? null : RS.layout === 'dupla' ? h('p', { class: 'muted small aa-tip', text: 'Duas páginas só aparecem em tela larga (a partir de uns 900 px). No celular continua uma.' }) : null,
    RD.eng === FolioEngine && RS.layout !== 'rolar' ? h('h3', { text: 'Virar a página' }) : null,
    RD.eng === FolioEngine && RS.layout !== 'rolar' ? seg([[true, 'Deslizando'], [false, 'Direto']], RS.anim !== false, v => { RS.anim = v; }) : null,
    pdf || RS.layout === 'dupla' ? null : h('h3', { text: 'Largura da linha' }),
    pdf || RS.layout === 'dupla' ? null : seg([['s', 'Estreita'], ['m', 'Média'], ['l', 'Larga']], RS.measure, v => { RS.measure = v; }),
    h('h3', { text: 'Tela' }),
    seg([[true, 'Sempre acesa'], [false, 'Normal']], RS.awake, v => { RS.awake = v; wantAwake(v); }),
    pdf ? h('h3', { text: 'Páginas escaneadas (OCR)' }) : null,
    pdf ? seg([[true, 'Ler sozinho'], [false, 'Só quando eu pedir']], !!RS.ocrAuto, v => { RS.ocrAuto = v; }) : null,
    pdf ? h('div', { class: 'aa-row' }, h('span', { text: 'Idioma do livro' }),
      h('select', { 'aria-label': 'Idioma para o OCR', onchange: e => { RS.ocrLang = e.target.value; saveRS(); toast('Vale para as próximas páginas lidas.'); } },
        [['por+eng', 'Português e inglês'], ['por', 'Português'], ['eng', 'Inglês'], ['spa', 'Espanhol'], ['fra', 'Francês'], ['ita', 'Italiano'], ['deu', 'Alemão'], ['lat', 'Latim']]
          .map(([c, n]) => h('option', { value: c, selected: c === (RS.ocrLang || 'por+eng'), text: n })))) : null,
    pdf ? h('p', { class: 'muted small aa-tip', text: 'O OCR lê a imagem da página aqui no aparelho, sem enviar para ninguém, e guarda o resultado: cada página é lida uma vez. Na primeira vez baixa o leitor e o idioma (alguns MB).' }) : null,
    pdf ? h('button', { type: 'button', class: 'btn ghost small', text: 'Ler de novo esta página', title: 'Apaga o OCR guardado desta página e lê outra vez, em alta resolução', onclick: () => { popLayer(); RD.eng.relerOcr(); } }) : null,
    h('h3', { text: 'Tradução' }),
    h('div', { class: 'aa-row' }, h('span', { text: 'Para' }),
      h('select', { 'aria-label': 'Traduzir para', onchange: e => { RS.trTo = e.target.value; saveRS(); } }, TR_LANGS.map(([c, n]) => h('option', { value: c, selected: c === RS.trTo, text: n })))),
    h('p', { class: 'muted small aa-tip', text: 'No aparelho, com o Bergamot (o tradutor local do Firefox): português, inglês, espanhol, francês, italiano, alemão, russo e outros. Cada par baixa uma vez (20 a 30 MB) e depois funciona sem internet; o texto não sai do aparelho.' + ('Translator' in self ? ' Este Chrome também traduz sozinho e entra primeiro quando já tem o par.' : '') }),
    h('h3', { text: 'Motor' }),
    seg([['local', 'No aparelho'], ['claude', 'Claude']], RS.trMotor === 'claude' ? 'claude' : 'local', v => { RS.trMotor = v; }),
    RS.trMotor === 'claude' ? aaClaude() : null,
    h('div', { class: 'aa-row' }, h('span', { text: 'Modelos guardados' }), h('span', { class: 'muted', id: 'aaModelos', text: '…' }),
      h('button', { type: 'button', class: 'btn ghost small', text: 'Apagar', onclick: async () => { const m = await import(new URL('js/bergamot.mjs', document.baseURI).href); await m.esquece(); bergP = null; toast('Modelos de tradução apagados. Baixam de novo quando precisar.'); panelSwap('aa'); } })),
    h('h3', { text: 'Online, para o que o aparelho não cobre' }),
    seg([['', 'Não'], ['mymemory', 'MyMemory'], ['libre', 'LibreTranslate'], ['google', 'Google']], trOnlineVia(), v => { RS.trVia = v; }),
    trOnlineVia() === 'libre' ? h('div', { class: 'form aa-libre' },
      h('input', { type: 'text', value: RS.trLibre || '', placeholder: 'https://seu-servidor-libretranslate', 'aria-label': 'Endereço do LibreTranslate', onchange: e => { RS.trLibre = e.target.value.trim(); saveRS(); } }),
      h('input', { type: 'text', value: RS.trLibreKey || '', placeholder: 'Chave (se o servidor pedir)', 'aria-label': 'Chave do LibreTranslate', onchange: e => { RS.trLibreKey = e.target.value.trim(); saveRS(); } })) : null,
    h('p', { class: 'muted small aa-tip', text: 'Só entra quando nenhum modelo local cobre o par (latim, japonês, chinês) e o trecho sai do aparelho. MyMemory é gratuito e limitado; LibreTranslate é código aberto, no servidor que você indicar; o Google usa um endereço não oficial, que pode parar sem aviso.' }),
    h('h3', { text: 'O que cada cor quer dizer' }),
    h('div', { class: 'hl-names' }, HL_COLORS.map(c => h('label', { class: 'hl-name' }, h('i', { class: 'dot-' + c.id }),
      h('input', { type: 'text', value: ((E.prefs && E.prefs.hlNames) || {})[c.id] || '', placeholder: c.name, maxlength: 28, 'aria-label': 'Nome para ' + c.name,
        onchange: e => { E.prefs.hlNames = { ...(E.prefs.hlNames || {}), [c.id]: e.target.value.trim() }; if (!e.target.value.trim()) delete E.prefs.hlNames[c.id]; saveE(); } })))),
    RS.theme === 'sol' || RS.theme === 'eink' ? h('p', { class: 'muted small aa-tip', text: 'Ao sol: brilho no máximo e, se puder, película fosca. Nenhum programa muda o vidro da tela; o que dá para fazer daqui é tirar todo cinza, engrossar a letra e deixar o fundo branco puro, que é o que mais rende contra o reflexo.' }) : null);
}

/* ---------- Selecionar e marcar ----------
   Barra em duas linhas: cores (um toque marca com a caneta) e estilo;
   embaixo nota, cartão, traduzir, copiar e, se o trecho já tem
   marcações, Remover. */
function selActions(base){
  const done = () => { selbar.hide(); getSelection().removeAllRanges(); RD.eng && RD.eng.deselect && RD.eng.deselect(); };
  const mk = c => { PEN.color = c; savePen(); const x = base.make(c, PEN.style); setTimeout(() => rdRefresh('hl'), 0); return x; };
  return [
    ...colorDots(null, c => { mk(c); done(); }),
    styleBtn(PEN.style, () => selbar.show(selbar.rect, styleRow(PEN.style, st => { PEN.style = st; savePen(); mk(PEN.color); done(); }, () => selbar.show(selbar.rect, selActions(base))))),
    { br: 1 },
    { label: 'Nota', onclick: () => { const x = mk(PEN.color); done(); editNote('', v => { x.note = v; putI('hl', x); RD.eng && RD.eng.repaint(); }); } },
    { label: 'Cartão', onclick: () => { const x = mk(PEN.color); done(); cardFromHl(x); } },
    { label: 'Traduzir', onclick: () => translateCard(base.text, { rect: selbar.rect, ctx: base.ctx ? { contexto: base.ctx } : null, save: tr => { const x = mk(PEN.color); x.tr = tr; putI('hl', x); RD.eng && RD.eng.repaint(); getSelection().removeAllRanges(); RD.eng && RD.eng.deselect && RD.eng.deselect(); } }) },
    { label: 'Copiar', onclick: () => { navigator.clipboard?.writeText(base.text); selbar.hide(); toast('Copiado.'); } },
    base.overlaps && base.overlaps.length ? { label: 'Remover', cls: 'danger', title: 'Remover as marcações deste trecho', onclick: () => { done(); base.erase(); } } : null,
  ];
}
function hlActions(x){
  const redo = () => RD.eng && RD.eng.repaint();
  return [
    ...colorDots(x.color, c => { x.color = c; PEN.color = c; savePen(); putI('hl', x); redo(); selbar.hide(); }),
    styleBtn(x.style, () => selbar.show(selbar.rect, styleRow(x.style, st => { x.style = st; PEN.style = st; savePen(); putI('hl', x); redo(); selbar.hide(); }, () => selbar.show(selbar.rect, hlActions(x))))),
    { br: 1 },
    { label: x.note ? 'Ver nota' : 'Nota', onclick: () => { selbar.hide(); editNote(x.note, v => { x.note = v; putI('hl', x); redo(); }); } },
    { label: 'Cartão', onclick: () => { selbar.hide(); cardFromHl(x); } },
    { label: 'Traduzir', onclick: () => translateCard(x.text, { rect: selbar.rect, saved: !!x.tr, save: tr => { x.tr = tr; putI('hl', x); redo(); } }) },
    { label: 'Copiar', onclick: () => { navigator.clipboard?.writeText(x.text); selbar.hide(); toast('Copiado.'); } },
    { label: 'Remover', cls: 'danger', onclick: () => { selbar.hide(); removeHls([x]); } },
  ];
}
/* Contexto de um trecho para o tradutor: o bloco onde ele está e os
   vizinhos (parágrafo anterior e seguinte), até uns 2.500 caracteres */
function contextoDe(no){
  let el = no && (no.nodeType === 1 ? no : no.parentElement);
  el = el && el.closest('p,li,blockquote,dd,dt,h1,h2,h3,h4,figcaption,td,div');
  if (!el) return '';
  const txt = e => (e && e.textContent || '').replace(/\s+/g, ' ').trim();
  return [txt(el.previousElementSibling), txt(el), txt(el.nextElementSibling)].filter(Boolean).join('\n\n').slice(0, 2500);
}
function newHl(fields){
  return putI('hl', { id: uid() + uid(), book: RD.book.id, created: Date.now(), note: '', style: PEN.style, ...fields });
}
function cardFromHl(x){
  const b = getI('books', x.book);
  openCardEditor({ kind: 'cloze', text: x.text, deck: b ? b.title : 'Leituras', src: { t: 'hl', id: x.id, book: x.book, label: (b ? b.title : '') + (x.page ? ', p. ' + x.page : '') }, hint: x.note || x.tr });
}
/* Nota do livro: abre no Escritor, ligada ao livro */
function bookNote(){
  const b = RD.book;
  newNote(`# Notas: ${b.title}\n\n[[${b.title}]]${b.author ? ' · ' + b.author : ''}\n\n`, { t: 'livro', id: b.id, label: b.title });
}
function fichamento(b){
  const list = hlOf(b.id).sort(hlOrdem(b));
  let md = `# Fichamento: ${b.title}\n\n[[${b.title}]]${b.author ? ' · ' + b.author : ''} #fichamento\n\n`;
  let chap = null;
  for (const x of list){
    if (x.chap){ if (x.chap !== chap){ chap = x.chap; md += `## ${x.chap}\n\n`; } }
    else if (b.type !== 'PDF' && b.toc && x.s != null){ let t = null; for (const c of b.toc) if (c.s < x.s || (c.s === x.s && c.c <= x.a)) t = c; if (t && t.l !== chap){ chap = t.l; md += `## ${t.l}\n\n`; } }
    md += hlMd(x) + '\n';
  }
  newNote(md, { t: 'livro', id: b.id, label: b.title });
}
function exportBookMd(b){
  const notes = live('notes').filter(n => n.src && n.src.id === b.id);
  let md = marksMdOf('livro', b) || `# ${b.title}\n\n`;
  if (notes.length) md += '\n## Notas\n\n' + notes.map(n => `### ${noteTitle(n)}\n\n${noteRest(n)}\n`).join('\n');
  download(fileSafe(b.title) + '.md', md);
}

/* Com a aba Traduzir aberta, virar a página traduz a nova */
function trFollow(){
  if (RD.lado === 'toc'){
    clearTimeout(trFollow.tt);
    trFollow.tt = setTimeout(() => {
      const act = RD.eng && RD.eng.tocActive(), lis = document.querySelectorAll('#rdLado .toc > li');
      lis.forEach((li, i) => li.classList.toggle('on', i === act));
      lis[act]?.scrollIntoView({ block: 'nearest' });
    }, 300);
  }
  if (!RD.tr) return;
  clearTimeout(trFollow.t); trFollow.t = setTimeout(() => { if (RD.tr) rdRefresh('tr'); }, 500);
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
    if (rdSobreposto()) return;
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
function rdTecla(e){
  if (!RD.eng || !$('#modal').hidden || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'f'){ e.preventDefault(); lado('busca', RD.lado === 'busca'); setTimeout(() => $('#rdLado input[type=search]')?.focus(), 30); return; }
  if (e.key === 'Escape'){ if (RD.aa || RD.folha) popLayer(); else if (RD.lado) ladoFechar(); else if (RD.tr) trFechar(); return; }
  if (rdSobreposto()) return;
  if (['ArrowRight', 'PageDown', ' '].includes(e.key) && (RD.eng.paged || (RD.eng.scroll && e.key !== 'ArrowRight'))){ e.preventDefault(); RD.eng.next(); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key) && (RD.eng.paged || (RD.eng.scroll && e.key !== 'ArrowLeft'))){ e.preventDefault(); RD.eng.prev(); }
}
document.addEventListener('keydown', rdTecla);
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
  /* Uma página (padrão), duas lado a lado (tela larga) ou rolagem */
  get scroll(){ return RS.layout === 'rolar'; },
  get paged(){ return !this.scroll; },
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
    stage.replaceChildren(h('div', { class: 'rd-page', id: 'rdPage' },
      h('button', { class: 'rd-chnav up', id: 'rdPrevCh', type: 'button', text: '↑ Capítulo anterior', onclick: () => this.prevSec() }),
      h('div', { class: 'rd-sec', id: 'rdSec' }),
      h('button', { class: 'rd-chnav down', id: 'rdNextCh', type: 'button', text: 'Próximo capítulo ↓', onclick: () => this.nextSec() })));
    stage.className = 'rd-stage flow';
    stageInput(stage, this);
    let st;
    $('#rdPage').addEventListener('scroll', () => { if (!this.scroll) return; if (!selbar.el.classList.contains('card-mode')) selbar.hide(); clearTimeout(st); st = setTimeout(() => this.track(), 140); }, { passive: true });
    this.ro = new ResizeObserver(() => { clearTimeout(this.rt); this.rt = setTimeout(() => this.relayout(), 150); });
    this.ro.observe(stage);
    const p = b.pos || { s: 0, c: 0 };
    if (p.cfi && b.pct > 0){ await this.load(0, 0); this.gotoPct(b.pct); return; }   // posição veio do leitor novo, noutro aparelho
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
    if (this.scroll){
      this.scrollToChar(toEnd ? this.len : c || 0);
      this.track();
      return;
    }
    this.page = toEnd ? this.pages - 1 : this.charToPage(c || 0);
    this.draw();
  },
  nextSec(){ if (this.sec < this.c.sections.length - 1) return this.load(this.sec + 1, 0); toast('Fim do livro.'); },
  prevSec(){ if (this.sec > 0) return this.load(this.sec - 1, 0, true); },
  chnav(){
    const p = $('#rdPrevCh'), n = $('#rdNextCh');
    if (!p || !n) return;
    p.hidden = !this.scroll || this.sec <= 0;
    n.hidden = !this.scroll;
    n.textContent = this.sec < this.c.sections.length - 1 ? 'Próximo capítulo ↓' : 'Fim do livro';
  },
  /* Rolagem: qual caractere está no alto da tela */
  visibleChar(){
    const pg = $('#rdPage');
    if (!pg || !this.tn.length) return 0;
    const top = pg.getBoundingClientRect().top + 6;
    const r = document.createRange();
    const bottomOf = (n, a, b) => { r.setStart(n, a); r.setEnd(n, b); const rs = r.getClientRects(); return rs.length ? rs[rs.length - 1].bottom : -Infinity; };
    let lo = 0, hi = this.tn.length - 1;
    while (lo < hi){ const m = (lo + hi) >> 1, n = this.tn[m]; if (bottomOf(n, 0, n.data.length) > top) hi = m; else lo = m + 1; }
    const n = this.tn[lo];
    let a = 0, b = n.data.length;
    while (a < b){ const m = (a + b) >> 1; if (bottomOf(n, m, Math.min(m + 1, n.data.length)) > top) b = m; else a = m + 1; }
    return this.ts[lo] + Math.min(a, Math.max(0, n.data.length - 1));
  },
  scrollToChar(c){
    const pg = $('#rdPage');
    if (!pg) return;
    if (!c || c <= 0 || !this.tn.length){ pg.scrollTop = 0; return; }
    if (c >= this.len){ pg.scrollTop = pg.scrollHeight; return; }
    const [node, off] = this.locate(c);
    const r = document.createRange();
    r.setStart(node, Math.min(off, node.data.length - 1)); r.setEnd(node, Math.min(off + 1, node.data.length));
    const rect = r.getClientRects()[0] || r.getBoundingClientRect();
    pg.scrollTop += rect.top - pg.getBoundingClientRect().top - 14;
  },
  here(){ return this.scroll ? this.visibleChar() : this.charAt(this.page || 0); },
  track(){
    const c = this.visibleChar(), g = this.before[this.sec] + c, chap = this.chapter(this.sec, c);
    $('#rdChap').textContent = chap ? chap.l : '';
    savePos({ s: this.sec, c }, g / this.total, `${Math.round(100 * g / this.total)}%`);
    trFollow();
  },
  layout(){
    const pg = $('#rdPage'), el = $('#rdSec');
    if (!pg || !el) return;
    const W = pg.clientWidth, H = pg.clientHeight;
    this.chnav();
    if (this.scroll){
      Object.assign(el.style, { columnWidth: '', columnGap: '', height: '', width: '', transform: '' });
      el.style.setProperty('--img-h', (H - 8) + 'px');
      this.step = 0; this.pages = 1; this.mode = 'scroll';
      this.index();
      return;
    }
    this.mode = 'paged';
    pg.scrollTop = 0;
    const cpv = RS.layout === 'dupla' && W >= 900 ? 2 : 1, G = cpv > 1 ? 64 : 40;
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
    const c = this.mode === 'scroll' ? this.visibleChar() : this.charAt(this.page || 0);
    this.layout();
    if (this.scroll){ this.scrollToChar(c); this.track(); return; }
    $('#rdPage').scrollTop = 0;
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
    // quem estuda quer saber quanto falta: no capítulo (páginas) e no livro (minutos)
    const falta = this.pages - this.page - 1;
    const min = Math.round((this.total - g) / 1100);
    const rot = `${Math.round(100 * g / this.total)}%` + (falta > 0 ? ` · ${falta} pág. no capítulo` : ' · fim do capítulo') + (min > 1 ? ` · ~${min < 90 ? min + ' min' : Math.round(min / 60) + ' h'} para acabar` : '');
    savePos({ s: this.sec, c }, g / this.total, rot);
    if (!silent) flash();
    trFollow();
  },
  chapter(s, c){ let last = null; for (const t of this.b.toc || []) if (t.s < s || (t.s === s && t.c <= c)) last = t; return last; },
  tocActive(){ const t = this.chapter(this.sec, this.here()); return t ? (this.b.toc || []).indexOf(t) : -1; },
  async next(){
    selbar.hide();
    if (this.scroll){ const pg = $('#rdPage'); if (pg.scrollTop + pg.clientHeight >= pg.scrollHeight - 4) await this.nextSec(); else pg.scrollBy({ top: pg.clientHeight * .9 }); return; }
    if (this.page < this.pages - 1){ this.page++; this.draw(); showChrome(false); }
    else if (this.sec < this.c.sections.length - 1){ await this.load(this.sec + 1, 0); showChrome(false); }
    else toast('Fim do livro.');
  },
  async prev(){
    selbar.hide();
    if (this.scroll){ const pg = $('#rdPage'); if (pg.scrollTop <= 2) await this.prevSec(); else pg.scrollBy({ top: -pg.clientHeight * .9 }); return; }
    if (this.page > 0){ this.page--; this.draw(); }
    else if (this.sec > 0) await this.load(this.sec - 1, 0, true);
  },
  async goto(s, c){
    if (s !== this.sec) await this.load(s, c);
    else if (this.scroll){ this.scrollToChar(c); this.track(); }
    else { this.page = this.charToPage(c); this.draw(); }
  },
  gotoPct(p){
    const g = Math.round(p * this.total);
    let s = 0; while (s < this.c.lens.length - 1 && this.before[s + 1] <= g) s++;
    this.goto(s, g - this.before[s]);
  },
  gotoToc(t){ this.goto(t.s, t.c); },
  async gotoHl(x){ if (x.s == null){ if (x.f != null) this.gotoPct(x.f); return; } await this.goto(x.s, x.a); this.blink(x.id); },
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
      const ms = wrapOffsets(el, x.a, x.b, () => {
        const m = document.createElement('mark');
        m.className = hlClass(x);
        m.dataset.h = x.id;
        return m;
      });
      if (ms.length) ms[ms.length - 1].classList.add('end');
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
    const overlaps = hlOf(this.b.id).filter(x => x.s === this.sec && x.a < b && x.b > a);
    selbar.show(last, selActions({ text, overlaps, ctx: contextoDe(r.commonAncestorContainer), erase: () => this.erase(a, b),
      make: (color, style) => { const x = newHl({ s: this.sec, a, b, text, color, style }); this.repaint(); return x; } }));
  },
  /* Apaga as marcações só no trecho [a, b): o que sobra dos lados fica */
  erase(a, b){
    const full = $('#rdSec').textContent;
    const textOf = (x, y) => full.slice(x, y).replace(/\s+/g, ' ').trim();
    const hit = hlOf(this.b.id).filter(x => x.s === this.sec && x.a < b && x.b > a);
    const keep = hit.map(x => ({ ...x })), made = [];
    let gone = 0;
    for (const x of hit){
      if (x.a >= a && x.b <= b){ delI('hl', x.id); gone++; continue; }
      if (x.a < a && x.b > b){
        const right = { ...x, id: uid() + uid(), a: b, text: textOf(b, x.b), created: Date.now() };
        made.push(putI('hl', right).id);
        x.b = a;
      } else if (x.a < a) x.b = a;
      else x.a = b;
      x.text = textOf(x.a, x.b);
      if (x.text.length < 2){ delI('hl', x.id); gone++; } else putI('hl', x);
    }
    this.repaint();
    toast(gone && gone === hit.length ? (gone === 1 ? 'Marcação removida.' : `${gone} marcações removidas.`) : 'Trecho desmarcado.', 'Desfazer', () => {
      for (const id of made) delI('hl', id);
      for (const k of keep) putI('hl', { ...k });
      this.repaint();
    });
  },
  /* Blocos de texto na tela (para traduzir a página) */
  visibleBlocks(){
    const el = $('#rdSec'), pg = $('#rdPage');
    if (!el || !pg) return [];
    const box = pg.getBoundingClientRect();
    const sel = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,figcaption,dt,dd,td,th';
    const cand = [...el.querySelectorAll(sel)].filter(b => !b.querySelector(sel));
    const out = [];
    for (const b of cand){
      const rs = [...b.getClientRects()].filter(r => r.width > 1 && r.right > box.left + 2 && r.left < box.right - 2 && r.bottom > box.top + 2 && r.top < box.bottom - 2);
      if (!rs.length) continue;
      // só o pedaço do bloco que está nesta página
      let t = b.textContent;
      if (this.paged && rs.length < b.getClientRects().length){
        const rg = document.createRange(); rg.selectNodeContents(b);
        const tn = [], w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) tn.push(n);
        let first = -1, last = -1, pos = 0;
        for (const n2 of tn){
          for (let i = 0; i < n2.data.length; i += 24){
            rg.setStart(n2, i); rg.setEnd(n2, Math.min(i + 1, n2.data.length));
            const q = rg.getClientRects()[0];
            if (q && q.left >= box.left - 2 && q.right <= box.right + 2){ if (first < 0) first = pos + i; last = pos + i; }
          }
          pos += n2.data.length;
        }
        if (first >= 0){
          const s0 = t.lastIndexOf(' ', first) + 1, e0 = t.indexOf(' ', last + 24);
          t = t.slice(s0, e0 < 0 ? undefined : e0);
        }
      }
      t = t.replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
    }
    if (!out.length){ const c = this.here(); const t = el.textContent.slice(c, c + 1600).replace(/\s+/g, ' ').trim(); if (t) out.push(t); }
    return out;
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
  const made = [];
  for (const [node, s, e] of parts){
    let t = node;
    if (s > 0) t = t.splitText(s);
    if (e - s < t.data.length) t.splitText(e - s);
    if (!t.data.trim() && parts.length > 1) continue;
    const m = mk();
    t.parentNode.insertBefore(m, t);
    m.appendChild(t);
    made.push(m);
  }
  return made;
}
