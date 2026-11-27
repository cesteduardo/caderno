/* =====================================================================
   Motor de livros: foliate-js (MIT, de John Factotum, o motor do Foliate)
   ---------------------------------------------------------------------
   Abre EPUB, MOBI/AZW3, FB2 e CBZ como o livro foi feito: o CSS da
   editora fica, e os seus ajustes (letra, tamanho, entrelinha, margens,
   tema) vão por cima. Cada capítulo é desenhado num iframe pelo
   paginador do foliate (colunas de verdade, arrastar com o dedo, duas
   páginas lado a lado, rolagem contínua).

   Posição e marcações usam EPUB CFI, o endereço padrão de um ponto do
   livro: independe da letra, da tela e do aparelho. As marcações são
   desenhadas numa camada SVG por cima do texto (marca-texto, sublinhado,
   ondulado e tachado), sem mexer no texto do livro.

   Livros importados antes desta versão continuam no leitor antigo
   (js/leitor.js, FlowEngine), porque dele só ficou a versão convertida,
   não o arquivo. Adicionar o mesmo arquivo de novo troca o motor: a
   posição e as marcações vêm junto (migra(), que reencontra cada trecho
   pelo texto marcado).

   O código do foliate fica em vendor/foliate, sem alterações além de uma
   linha (ver vendor/foliate/LEIA.md).
   ===================================================================== */
'use strict';

const FOLIO = new URL('vendor/foliate/', document.baseURI).href;
let folioP = null;
function folioLib(){
  folioP ||= Promise.all([import(FOLIO + 'view.js'), import(FOLIO + 'overlayer.js')])
    .then(([v, o]) => {
      /* o contorno da busca (e do "pisca" ao pular para uma marcação) vem
         vermelho no foliate; aqui fica âmbar, mais discreto */
      const contorno = o.Overlayer.outline;
      o.Overlayer.outline = (rects, opts = {}) => contorno(rects, { color: '#f5a623', width: 2, padding: 2, radius: 4, ...opts });
      return { makeBook: v.makeBook, Overlayer: o.Overlayer };
    });
  folioP.catch(() => { folioP = null; });
  return folioP;
}

/* Rótulos do foliate vêm como texto ou como { pt: '…', en: '…' } */
const folioTxt = x => !x ? '' : typeof x === 'string' ? x : x.name ? folioTxt(x.name) : folioTxt(x[Object.keys(x)[0]]);
const folioAutor = a => Array.isArray(a) ? a.map(folioTxt).filter(Boolean).join(', ') : folioTxt(a);
function folioToc(toc, d = 0, out = []){
  for (const t of toc || []){
    const l = String(t.label || '').replace(/\s+/g, ' ').trim();
    if (l && t.href) out.push({ l: l.slice(0, 120), href: t.href, d: Math.min(3, d) });
    if (t.subitems && t.subitems.length) folioToc(t.subitems, d + 1, out);
  }
  return out;
}

/* Na importação: título, autor, capa e sumário saem do próprio foliate */
async function folioInfo(file){
  const { makeBook } = await folioLib();
  const book = await makeBook(file);
  let cover = null;
  try { const bl = await book.getCover?.(); if (bl) cover = await smallCover(await blobToImg(bl)); } catch (e) {}
  const nome = (file.name || '').toLowerCase();
  const type = /\.cbz$/.test(nome) ? 'CBZ' : /\.(fb2|fbz|fb2\.zip)$/.test(nome) ? 'FB2' : (await sniff(file)) === 'MOBI' ? 'MOBI' : 'EPUB';
  const chars = (book.sections || []).reduce((s, x) => s + (x.linear !== 'no' ? x.size || 0 : 0), 0);
  return {
    type, title: folioTxt(book.metadata?.title).trim(), author: folioAutor(book.metadata?.author).trim(),
    cover, toc: folioToc(book.toc), chars, lang: folioTxt(book.metadata?.language),
  };
}

/* Cores das marcações: preenchimento (marca-texto) e traço (os outros) */
const FOLIO_COR = {
  am: ['#ffce00', '#e8b400'], vd: ['#40be6e', '#2fa862'], az: ['#468cff', '#3b82f6'],
  rs: ['#ff5c96', '#ec4f8f'], lj: ['#ff8c28', '#f07a1a'], rx: ['#9664ff', '#8b5cf6'],
};
const FOLIO_COR_NOITE = {
  am: ['#f5c518', '#f5c518'], vd: ['#4ade80', '#4ade80'], az: ['#60a5fa', '#60a5fa'],
  rs: ['#f472b6', '#f472b6'], lj: ['#fb923c', '#fb923c'], rx: ['#a78bfa', '#a78bfa'],
};
const SVGNS = 'http://www.w3.org/2000/svg';

/* Nota de rodapé? (os mesmos sinais que o foliate usa: epub:type, role,
   sobrescrito ou um número curto entre colchetes) */
function folioEhNota(a){
  const tipos = new Set((a.getAttributeNS('http://www.idpf.org/2007/ops', 'type') || '').split(/\s+/));
  const papeis = new Set((a.getAttribute('role') || '').split(/\s+/));
  if (['noteref', 'biblioref', 'glossref'].some(t => tipos.has(t)) || ['doc-noteref', 'doc-biblioref', 'doc-glossref'].some(t => papeis.has(t))) return true;
  if (tipos.has('backlink') || papeis.has('doc-backlink')) return false;
  const sob = el => el && (el.matches('sup') || /super|top/.test(el.ownerDocument.defaultView.getComputedStyle(el).verticalAlign));
  return sob(a) || (a.children.length === 1 && sob(a.children[0])) || sob(a.parentElement) || /^\[?\(?\d{1,3}\)?\]?$|^[*†‡§]$/.test(a.textContent.trim());
}
function folioBlocoNota(el){
  if (!el) return null;
  if (el.startContainer) el = el.startContainer.nodeType === 1 ? el.startContainer : el.startContainer.parentElement;
  const alvo = el;
  const li = el.closest('li, aside, [role~="doc-footnote"], [role~="doc-endnote"]');
  if (li) return li;
  while (el.matches('a, span, sup, sub, em, strong, i, b, small, big') && el.parentElement) el = el.parentElement;
  if (el === el.ownerDocument.body){ const s = alvo.nextElementSibling; return s || null; }
  return el;
}

/* Texto sem espaços nem hífens moles, com o mapa de volta para os nós:
   é assim que uma marcação do leitor antigo é reencontrada no livro,
   mesmo que um lado tenha quebras de linha e o outro não. */
function folioPlano(doc){
  const w = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT);
  const nos = [], offs = [];
  let plain = '', n;
  while ((n = w.nextNode())){
    const d = n.data;
    for (let i = 0; i < d.length; i++){
      const c = d[i];
      if (c === '­' || /\s/.test(c)) continue;
      plain += c; nos.push(n); offs.push(i);
    }
  }
  return { plain, nos, offs };
}
const folioAgulha = s => String(s || '').replace(/[\s­]+/g, '');

const FolioEngine = {
  get scroll(){ return RS.layout === 'rolar'; },
  get paged(){ return !this.scroll; },

  async open(b){
    this.b = b;
    this.lib = await folioLib();
    const blob = await DB.get('arq:' + b.id);
    if (!blob) throw new Error('arquivo não encontrado');
    const file = blob instanceof File ? blob : new File([blob], b.file || 'livro.epub', { type: blob.type || '' });
    const stage = $('#rdStage');
    stage.className = 'rd-stage folio';
    const view = document.createElement('foliate-view');
    view.className = 'folio-view chegando';   // surge suave na primeira página, em vez de piscar
    stage.replaceChildren(view);
    this.view = view;
    this.desenhadas = new Map();
    this.idxCache = new Map();
    this.loc = null;
    await view.open(file);
    this.book = view.book;
    this.toc = folioToc(this.book.toc);
    view.addEventListener('load', e => this.onLoad(e.detail));
    view.addEventListener('relocate', e => this.onRelocate(e.detail));
    view.addEventListener('create-overlay', e => this.pintaSecao(e.detail.index, true));
    view.addEventListener('draw-annotation', e => this.desenha(e.detail));
    view.addEventListener('link', e => this.onLink(e));
    this.ajusta();
    const p = b.pos;
    try {
      if (p && p.cfi) await view.init({ lastLocation: p.cfi });
      else if (b.pct > 0) await view.goToFraction(b.pct);
      else await view.init({ showTextStart: true });
    } catch (e) { await view.init({ showTextStart: true }); }
    this.migra().catch(e => console.warn('migração', e));
  },
  close(){
    try { this.view && this.view.close(); } catch (e) {}
    this.view && this.view.remove();
    this.view = null; this.book = null; this.loc = null;
  },

  /* ---------- aparência ---------- */
  ajusta(){
    const r = this.view && this.view.renderer;
    if (!r) return;
    const cols = RS.layout === 'dupla' ? 2 : 1;
    const medida = Math.round(RS.size * ({ s: 28, m: 35, l: 44 }[RS.measure] || 35));
    /* cada atributo que muda refaz a página inteira: só mexe no que mudou */
    const põe = (k, v) => { if (r.getAttribute(k) !== v) r.setAttribute(k, v); };
    põe('flow', this.scroll ? 'scrolled' : 'paginated');
    põe('max-column-count', String(cols));
    põe('max-inline-size', (cols > 1 ? Math.round(RS.size * 31) : medida) + 'px');
    põe('gap', { s: '4%', m: '7%', l: '12%' }[RS.margin] || '7%');
    põe('margin', estreito() ? '26px' : '38px');
    if (RS.theme === 'eink' || RS.anim === false) r.removeAttribute('animated'); else if (!r.hasAttribute('animated')) r.setAttribute('animated', '');
    const css = this.css();
    if (css !== this.cssAtual){ this.cssAtual = css; r.setStyles(css); }
  },
  relayout(){ this.ajusta(); clearTimeout(this.rpT); this.rpT = setTimeout(() => this.repaint(), 160); },
  css(){
    const cs = getComputedStyle(RD.el), v = (k, d) => cs.getPropertyValue(k).trim() || d;
    const bg = v('--rd-bg', '#fff'), ink = v('--rd-ink', '#151515'), mute = v('--rd-mute', '#8a8a87');
    const tema = RD.el.dataset.theme || 'papel';
    const escuro = tema === 'noite';
    /* no tema Papel o livro mantém as cores da editora; nos outros, texto
       e fundo seguem o tema (senão um livro com fundo branco fura o Noite) */
    const forca = tema !== 'papel';
    const fonte = RS.font === 'livro' ? '' : RS.font === 'sans' ? '"Inter", ui-sans-serif, system-ui, sans-serif'
      : '"Iowan Old Style", "Palatino Linotype", Palatino, "Noto Serif", "Source Serif Pro", "Book Antiqua", Georgia, serif';
    const inter = n => `url("${new URL('fonts/Inter-' + n + '.woff2', document.baseURI).href}") format("woff2")`;
    return `
@namespace epub "http://www.idpf.org/2007/ops";
@font-face{font-family:"Inter";src:${inter('Regular')};font-weight:400;font-display:fallback}
@font-face{font-family:"Inter";src:${inter('Medium')};font-weight:500;font-display:fallback}
@font-face{font-family:"Inter";src:${inter('SemiBold')};font-weight:600 800;font-display:fallback}
html{--theme-bg-color:${bg};color-scheme:${escuro ? 'dark' : 'light'};color:${ink};background:${bg} !important;font-size:${RS.size + (RS.theme === 'sol' ? 1 : 0)}px !important;
  -webkit-text-size-adjust:none;text-size-adjust:none;
  --overlayer-highlight-opacity:${escuro ? .3 : .42};--overlayer-highlight-blend-mode:${escuro ? 'screen' : 'multiply'}}
body{background:transparent !important;${fonte ? `font-family:${fonte} !important;` : ''}${tema === 'sol' ? 'font-weight:500;-webkit-font-smoothing:auto;' : ''}}
${fonte ? `body :is(p,li,blockquote,dd,dt,div,span,td,th,figcaption,em,i,b,strong,small,a,cite,q,section,article):not(code,pre,kbd,samp,code *,pre *){font-family:inherit !important}` : ''}
p,li,blockquote,dd{line-height:${RS.lh} !important;text-align:${RS.just ? 'justify' : 'start'};hyphens:auto;-webkit-hyphens:auto;widows:2;orphans:2;hanging-punctuation:allow-end last}
[align="left"]{text-align:left}[align="right"]{text-align:right}[align="center"]{text-align:center}[align="justify"]{text-align:justify}
${forca ? `body *:not(svg *){color:inherit !important;background-color:transparent !important;border-color:color-mix(in srgb,${ink} 25%,transparent) !important}` : ''}
a:link,a:visited{color:inherit !important;text-decoration-color:${mute}}
pre{white-space:pre-wrap !important}
${escuro ? 'img{opacity:.88}' : ''}
aside[epub|type~="endnote"],aside[epub|type~="footnote"],aside[epub|type~="note"],aside[epub|type~="rearnote"]{display:none}
::selection{background:rgba(0,110,255,.26)}`;
  },

  /* ---------- eventos de cada capítulo (iframe) ---------- */
  onLoad({ doc, index }){
    doc.addEventListener('keydown', rdTecla);
    doc.addEventListener('selectionchange', () => { clearTimeout(this.selT); this.selT = setTimeout(() => this.onSelect(doc, index), 260); });
    doc.addEventListener('click', e => this.onClick(e, doc, index));
  },
  onRelocate(d){
    if (!this.loc && this.view) requestAnimationFrame(() => this.view && this.view.classList.remove('chegando'));
    this.loc = d;
    const t = d.time || {};
    const fmtT = m => m < 90 ? Math.max(1, Math.round(m)) + ' min' : Math.round(m / 60) + ' h';
    const rot = `${Math.round(100 * (d.fraction || 0))}%` + (t.section > 1 ? ` · ${fmtT(t.section)} no capítulo` : '') + (t.total > 1 ? ` · ~${fmtT(t.total)} para acabar` : '');
    savePos({ cfi: d.cfi }, d.fraction || 0, rot);
    const chap = $('#rdChap'); if (chap) chap.textContent = (d.tocItem && d.tocItem.label || '').replace(/\s+/g, ' ').trim();
    if (this.paged && d.reason === 'page') flash();
    trFollow();
  },
  /* retângulo na tela (fora do iframe) de um trecho */
  telaRect(range, doc){
    const rs = range.getClientRects(), q = rs[rs.length - 1] || range.getBoundingClientRect();
    const fr = doc.defaultView.frameElement.getBoundingClientRect();
    return { left: fr.left + q.left, right: fr.left + q.right, top: fr.top + q.top, bottom: fr.top + q.bottom, width: q.width, height: q.height };
  },
  onClick(e, doc, index){
    const s = doc.getSelection();
    if (s && !s.isCollapsed) return;
    if (rdSobreposto()) return;
    if (e.target.closest && e.target.closest('a[href]')) return;      // o foliate cuida dos links
    const c = this.view.renderer.getContents().find(x => x.doc === doc);
    if (c && c.overlayer){
      const [val, range] = c.overlayer.hitTest(e);
      const x = val && this.porCfi(val);
      if (x){ selbar.show(this.telaRect(range, doc), hlActions(x)); return; }
    }
    if (!selbar.el.hidden){ selbar.hide(); return; }
    if (!this.paged){ toggleChrome(); return; }
    const fr = doc.defaultView.frameElement.getBoundingClientRect(), st = $('#rdStage').getBoundingClientRect();
    const x = (fr.left + e.clientX - st.left) / st.width;
    if (x < .28) this.prev(); else if (x > .72) this.next(); else toggleChrome();
  },

  /* ---------- navegação ---------- */
  async next(){ selbar.hide(); await this.view.next(); if (this.paged) showChrome(false); },
  async prev(){ selbar.hide(); await this.view.prev(); },
  gotoPct(p){ return this.view.goToFraction(p); },
  gotoToc(t){ return t.href ? this.view.goTo(t.href) : this.gotoPct(t.f || 0); },
  tocActive(){ const href = this.loc && this.loc.tocItem && this.loc.tocItem.href; return href ? this.toc.findIndex(t => t.href === href) : -1; },
  get sec(){ return this.loc ? this.loc.section && this.loc.section.current : null; },
  noCapitulo(x){ return x.cfi && this.idx(x) === this.sec; },
  async gotoHl(x){
    if (!x.cfi){ if (x.f != null) await this.gotoPct(x.f); return; }
    await this.view.goTo(x.cfi);
    /* pisca: um contorno por um instante */
    const v = 'foliate-search:' + x.cfi;
    try { await this.view.addAnnotation({ value: v }); setTimeout(() => this.view && this.view.deleteAnnotation({ value: v }).catch(() => {}), 1600); } catch (e) {}
  },
  link(){},
  onLink(e){
    const { a, href } = e.detail;
    if (!a || !folioEhNota(a)) return;
    e.preventDefault();
    this.nota(href);
  },
  async nota(href){
    try {
      const { index, anchor } = await this.book.resolveHref(href);
      const doc = await this.book.sections[index].createDocument();
      const bloco = folioBlocoNota(anchor(doc));
      const txt = (bloco && bloco.textContent || '').replace(/\s+/g, ' ').trim();
      if (txt.length < 2) throw new Error('vazia');
      modal('Nota', h('p', { class: 'fn-text', text: txt }), [{ label: 'Ir até a nota', onclick: () => this.view.goTo(href) }, { label: 'Fechar', primary: true }]);
    } catch (err) { this.view.goTo(href); }
  },

  /* ---------- marcações ---------- */
  idx(x){
    if (!x.cfi) return -1;
    if (!this.idxCache.has(x.cfi)){ let i = -1; try { i = this.view.resolveCFI(x.cfi).index; } catch (e) {} this.idxCache.set(x.cfi, i); }
    return this.idxCache.get(x.cfi);
  },
  porCfi(cfi){ return hlOf(this.b.id).find(x => x.cfi === cfi) || null; },
  daSecao(i){ return hlOf(this.b.id).filter(x => x.cfi && this.idx(x) === i); },
  faixa(x, doc){ try { return this.view.resolveCFI(x.cfi).anchor(doc); } catch (e) { return null; } },
  /* Cada marcação desenhada guarda uma assinatura (cor, estilo, nota,
     tradução, tema). Redesenhar só mexe no que mudou: marcar um trecho
     novo não faz as outras piscarem. */
  assina(x){ return [x.color, x.style, !!x.note, !!x.tr, RD.el.dataset.theme].join('|'); },
  pintaSecao(i, tudo){
    const antes = tudo ? new Map() : (this.desenhadas.get(i) || new Map()), agora = new Map();
    for (const x of this.daSecao(i)){
      const a = this.assina(x);
      agora.set(x.cfi, a);
      if (antes.get(x.cfi) !== a) this.view.addAnnotation({ value: x.cfi, x }).catch(() => {});
    }
    for (const v of antes.keys()) if (!agora.has(v)) this.view.deleteAnnotation({ value: v }).catch(() => {});
    this.desenhadas.set(i, agora);
  },
  repaint(tudo){
    if (!this.view || !this.view.renderer) return;
    for (const { index } of this.view.renderer.getContents()) this.pintaSecao(index, tudo === true);
  },
  desenha({ draw, annotation }){
    const x = annotation.x;
    if (!x) return;
    const O = this.lib.Overlayer;
    const tema = RD.el.dataset.theme;
    const pb = tema === 'eink' || tema === 'sol';
    const [fill, line] = pb ? ['#b8b8b8', '#000'] : ((tema === 'noite' ? FOLIO_COR_NOITE : FOLIO_COR)[x.color] || FOLIO_COR.am);
    const st = x.style || 'marca';
    const f = st === 'sub' ? O.underline : st === 'ond' ? O.squiggly : st === 'risco' ? O.strikethrough : O.highlight;
    const opt = st === 'marca' ? { color: fill, padding: 1 } : st === 'sub' ? { color: line, width: 2.4, padding: 2 } : st === 'ond' ? { color: line, width: 1.6, padding: 3 } : { color: line, width: 2 };
    draw((rects, o) => {
      const g = f(rects, o);
      /* ponto no fim: cheio = tem nota; vazado = tem tradução guardada */
      if ((x.note || x.tr) && rects.length){
        const r = rects[rects.length - 1], c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('cx', r.right + 5); c.setAttribute('cy', r.top + 4); c.setAttribute('r', 3.4);
        if (x.note) c.setAttribute('fill', line); else { c.setAttribute('fill', 'none'); c.setAttribute('stroke', line); c.setAttribute('stroke-width', 1.5); }
        c.style.opacity = '1';
        const wrap = document.createElementNS(SVGNS, 'g'); wrap.append(g, c); return wrap;
      }
      return g;
    }, opt);
  },
  /* posição no livro (0 a 1) de um trecho: para ordenar as marcações */
  fracDe(i, range, doc){
    const fr = this.view.getSectionFractions(), a = fr[i] || 0, z = fr[i + 1] != null ? fr[i + 1] : 1;
    try {
      const pre = doc.createRange(); pre.setStart(doc.body, 0); pre.setEnd(range.startContainer, range.startOffset);
      const tot = (doc.body.textContent || '').length || 1;
      return +(a + (z - a) * Math.min(1, pre.toString().length / tot)).toFixed(6);
    } catch (e) { return a; }
  },
  capDe(i, range){ try { const t = this.view.getProgressOf(i, range).tocItem; return t ? String(t.label || '').replace(/\s+/g, ' ').trim() : ''; } catch (e) { return ''; } },
  deselect(){ try { this.view && this.view.deselect(); } catch (e) {} },
  onSelect(doc, i){
    if (!doc) return;
    const s = doc.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return;
    const r = s.getRangeAt(0);
    const text = s.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 2) return;
    const antes = (n1, o1, n2, o2) => { const t = doc.createRange(); t.setStart(n1, o1); return t.comparePoint(n2, o2) > 0; };
    const overlaps = this.daSecao(i).filter(x => {
      const a = this.faixa(x, doc);
      return a && antes(a.startContainer, a.startOffset, r.endContainer, r.endOffset) && antes(r.startContainer, r.startOffset, a.endContainer, a.endOffset);
    });
    const sel = r.cloneRange();
    selbar.show(this.telaRect(r, doc), selActions({ text, overlaps, ctx: contextoDe(r.commonAncestorContainer), erase: () => this.erase(i, doc, sel, overlaps),
      make: (color, style) => {
        const x = newHl({ cfi: this.view.getCFI(i, sel), i, f: this.fracDe(i, sel, doc), chap: this.capDe(i, sel), text, color, style });
        this.repaint(); return x;
      } }));
  },
  /* Apaga as marcações só no trecho selecionado: o que sobra dos lados fica */
  erase(i, doc, sel, hit){
    const keep = hit.map(x => ({ ...x })), made = [];
    const le = (n1, o1, n2, o2) => { const t = doc.createRange(); t.setStart(n1, o1); return t.comparePoint(n2, o2) >= 0; };
    const grava = (x, range) => {
      x.text = range.toString().replace(/\s+/g, ' ').trim();
      if (x.text.length < 2) return false;
      x.cfi = this.view.getCFI(i, range); x.f = this.fracDe(i, range, doc);
      return true;
    };
    let gone = 0;
    for (const x of hit){
      const a = this.faixa(x, doc);
      if (!a){ continue; }
      const cobreIni = le(sel.startContainer, sel.startOffset, a.startContainer, a.startOffset);
      const cobreFim = le(a.endContainer, a.endOffset, sel.endContainer, sel.endOffset);
      if (cobreIni && cobreFim){ delI('hl', x.id); gone++; continue; }
      const esq = doc.createRange(); esq.setStart(a.startContainer, a.startOffset); esq.setEnd(sel.startContainer, sel.startOffset);
      const dir = doc.createRange(); dir.setStart(sel.endContainer, sel.endOffset); dir.setEnd(a.endContainer, a.endOffset);
      if (!cobreIni && !cobreFim){
        const novo = { ...x, id: uid() + uid(), created: Date.now() };
        if (grava(novo, dir)) made.push(putI('hl', novo).id);
        if (grava(x, esq)) putI('hl', x); else { delI('hl', x.id); gone++; }
      } else if (!cobreIni){ if (grava(x, esq)) putI('hl', x); else { delI('hl', x.id); gone++; } }
      else { if (grava(x, dir)) putI('hl', x); else { delI('hl', x.id); gone++; } }
    }
    this.idxCache.clear();
    this.repaint();
    rdRefresh('hl');
    toast(gone && gone === hit.length ? (gone === 1 ? 'Marcação removida.' : `${gone} marcações removidas.`) : 'Trecho desmarcado.', 'Desfazer', () => {
      for (const id of made) delI('hl', id);
      for (const k of keep) putI('hl', { ...k });
      this.repaint(); rdRefresh('hl');
    });
  },

  /* Marcações do leitor antigo (seção + caractere) ganham um CFI. Cada
     trecho é procurado pelo texto, começando pelo capítulo onde ele
     deveria estar; se aparece mais de uma vez, vale o mais perto. */
  async migra(){
    const velhas = hlOf(this.b.id).filter(x => !x.cfi && x.text && x.s != null);
    if (!velhas.length) return;
    const cont = await DB.get('cont:' + this.b.id);
    let antes = null, total = 1;
    if (cont && cont.lens){ antes = [0]; for (const n of cont.lens) antes.push(antes[antes.length - 1] + n); total = antes[antes.length - 1] || 1; }
    const fr = this.view.getSectionFractions();
    const secs = this.book.sections;
    const planos = new Map();
    const plano = i => { if (!planos.has(i)) planos.set(i, secs[i].createDocument().then(doc => ({ doc, ...folioPlano(doc) }))); return planos.get(i); };
    let ok = 0, falta = 0;
    for (const x of velhas){
      const alvo = antes ? Math.min(1, (antes[x.s] + (x.a || 0)) / total) : (this.b.pct || 0);
      const ag = folioAgulha(x.text);
      if (ag.length < 2){ falta++; continue; }
      const dist = i => { const a = fr[i] || 0, z = fr[i + 1] != null ? fr[i + 1] : 1; return alvo >= a && alvo <= z ? 0 : Math.min(Math.abs(alvo - a), Math.abs(alvo - z)); };
      const ordem = secs.map((s, i) => i).filter(i => secs[i].createDocument && secs[i].linear !== 'no').sort((p, q) => dist(p) - dist(q));
      let achou = null;
      for (const i of ordem){
        const T = await plano(i);
        let k = T.plain.indexOf(ag), best = -1, bd = Infinity;
        while (k > -1){
          const f = (fr[i] || 0) + ((fr[i + 1] != null ? fr[i + 1] : 1) - (fr[i] || 0)) * (k / (T.plain.length || 1));
          if (Math.abs(f - alvo) < bd){ bd = Math.abs(f - alvo); best = k; }
          k = T.plain.indexOf(ag, k + 1);
        }
        if (best > -1){ achou = { i, k: best, T }; break; }
      }
      if (!achou){ x.f = alvo; putI('hl', x); falta++; continue; }
      const { i, k, T } = achou, fim = k + ag.length - 1;
      const range = T.doc.createRange();
      range.setStart(T.nos[k], T.offs[k]); range.setEnd(T.nos[fim], T.offs[fim] + 1);
      x.cfi = this.view.getCFI(i, range); x.i = i; x.f = this.fracDe(i, range, T.doc); x.chap = this.capDe(i, range);
      putI('hl', x); ok++;
    }
    this.idxCache.clear();
    this.repaint();
    rdRefresh('hl');
    if (!falta && cont) await DB.del('cont:' + this.b.id);
    toast(`${plural(ok, 'marcação veio', 'marcações vieram')} do leitor antigo` + (falta ? `; ${plural(falta, 'não foi reencontrada', 'não foram reencontradas')} no arquivo e ${falta === 1 ? 'continua' : 'continuam'} na lista de Marcações.` : '.'));
  },

  /* ---------- tradução da página ---------- */
  visibleBlocks(){
    const c = this.view && this.view.renderer.getContents()[0], vis = this.loc && this.loc.range;
    if (!c || !vis) return [];
    const doc = c.doc, sel = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,figcaption,dt,dd,td,th';
    const out = [];
    for (const b of doc.querySelectorAll(sel)){
      if (b.querySelector(sel)) continue;
      try { if (!vis.intersectsNode(b)) continue; } catch (e) { continue; }
      const r = doc.createRange(); r.selectNodeContents(b);
      if (r.compareBoundaryPoints(Range.START_TO_START, vis) < 0) r.setStart(vis.startContainer, vis.startOffset);
      if (r.compareBoundaryPoints(Range.END_TO_END, vis) > 0) r.setEnd(vis.endContainer, vis.endOffset);
      const t = r.toString().replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
    }
    if (!out.length){ const t = vis.toString().replace(/\s+/g, ' ').trim().slice(0, 1600); if (t) out.push(t); }
    return out;
  },

  /* ---------- busca no livro todo ---------- */
  async search(q, emit){
    for await (const r of this.view.search({ query: q, matchCase: false, matchDiacritics: false, matchWholeWords: false })){
      if (r === 'done') return;
      if (!r.subitems) continue;
      for (const it of r.subitems){
        const ex = it.excerpt || {};
        if (emit({ cfi: it.cfi, pre: '…' + (ex.pre || ''), mid: ex.match || q, post: (ex.post || '') + '…', label: clip(r.label || '', 30) }) === false) return;
      }
    }
  },
  async gotoHit(hit){
    await this.view.goTo(hit.cfi);
    clearTimeout(this.limpaT);
    this.limpaT = setTimeout(() => this.view && this.view.clearSearch(), 5000);
  },
};
