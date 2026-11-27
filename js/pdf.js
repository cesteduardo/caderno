/* =====================================================================
   Motor de PDF
   ---------------------------------------------------------------------
   O PDF abre como foi diagramado: cada página desenhada pelo pdf.js,
   com uma camada de texto invisível por cima para dar para selecionar
   (quando o PDF tem texto; se for escaneado, a página abre do mesmo
   jeito, só não seleciona). Só as páginas perto da tela ficam
   desenhadas, para caber na memória de um celular simples.
   Destaques: retângulos guardados em proporção da página (0 a 1),
   então continuam no lugar com qualquer zoom.
   ===================================================================== */
'use strict';

/* ---------- Texto do PDF ----------
   O pdf.js entrega pedaços soltos. Antes eles eram colados com espaço,
   o que deixava "infor- mação" no meio das frases e juntava a página
   inteira num bloco só. Aqui os pedaços viram linhas (pela altura na
   página e pelo fim de linha que o pdf.js marca), as linhas viram
   parágrafos (pela distância entre elas) e a palavra partida no fim da
   linha volta a ser uma. Busca e tradução ficam muito melhores. */
function textoDaPagina(tc){
  const linhas = [];
  let atual = null;
  for (const it of tc.items){
    if (it.str == null) continue;
    const y = it.transform ? it.transform[5] : 0, alt = Math.abs(it.height || (it.transform ? it.transform[3] : 10)) || 10;
    if (!atual || Math.abs(y - atual.y) > alt * .5){ atual = { y, alt, t: '' }; linhas.push(atual); }
    const t = it.str;
    atual.t += (atual.t ? ' ' : '') + t;
    if (it.hasEOL){ atual = null; }
  }
  const limpas = linhas.map(l => ({ ...l, t: l.t.replace(/\s+/g, ' ').replace(/ ([,.;:!?)\]»”])/g, '$1').trim() })).filter(l => l.t);
  if (!limpas.length) return { texto: '', paras: [] };
  const gaps = [];
  for (let i = 1; i < limpas.length; i++){ const g = Math.abs(limpas[i - 1].y - limpas[i].y); if (g > 0) gaps.push(g); }
  gaps.sort((a, b) => a - b);
  const normal = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 12;
  const paras = [];
  let par = limpas[0].t;
  for (let i = 1; i < limpas.length; i++){
    const ant = limpas[i - 1], l = limpas[i];
    const gap = Math.abs(ant.y - l.y);
    const quebra = gap > normal * 1.55 || (/[.:!?]["”»)]?$/.test(ant.t) && ant.t.length < 45);
    if (quebra){ paras.push(par); par = l.t; continue; }
    // "infor-" + "mação" vira "informação"; hífen de verdade ("guarda-chuva") fica
    if (/[A-Za-zÀ-ÿ]-$/.test(par) && /^[a-zà-ÿ]/.test(l.t)) par = par.slice(0, -1) + l.t;
    else par += ' ' + l.t;
  }
  paras.push(par);
  return { texto: paras.join(' '), paras };
}

/* ---------- OCR (PDF escaneado) ----------
   Página sem camada de texto é foto de papel: não dá para selecionar,
   buscar nem traduzir. O Tesseract (no próprio aparelho, sem mandar a
   página para ninguém) lê a imagem e devolve as palavras com a posição
   de cada uma; elas viram uma camada de texto invisível por cima da
   página, igual à de um PDF digital. O resultado fica guardado, então
   cada página é lida uma vez só. Na primeira vez o navegador baixa o
   leitor e o idioma (alguns MB). */
const OCR_JS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let ocrMotor = null;
function ocrTrabalhador(){
  if (ocrMotor) return ocrMotor;
  ocrMotor = (async () => {
    if (!self.Tesseract) await new Promise((ok, erro) => { const sc = document.createElement('script'); sc.src = OCR_JS; sc.onload = ok; sc.onerror = () => erro(new Error('sem internet para baixar o leitor de OCR')); document.head.append(sc); });
    const w = await Tesseract.createWorker(RS.ocrLang || 'por+eng');
    /* mantém o espaço entre palavras como está na página (sem colar nem dobrar) */
    try { await w.setParameters({ preserve_interword_spaces: '1' }); } catch (e) {}
    return w;
  })();
  ocrMotor.catch(() => { ocrMotor = null; });
  return ocrMotor;
}

/* ---------- OCR: iluminação por igual ----------
   Página fotografada ou com a sombra da lombada tem o papel mais escuro de
   um lado: o Tesseract lê a sombra como tinta e devolve lixo. Aqui o fundo
   do papel é estimado numa cópia 16 vezes menor (pegando o mais claro de
   cada vizinhança, que é papel e não letra, e depois suavizando) e cada
   ponto da página é dividido por ele: o papel fica branco por igual e a
   letra continua escura. d é RGBA com o cinza no canal R. */
function achataLuz(d, W, H){   // devolve se mexeu
  const f = 16, w = Math.max(4, Math.ceil(W / f)), hh = Math.max(4, Math.ceil(H / f));
  let bg = new Float32Array(w * hh);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++){       // média de cada quadradinho
    let s = 0, n = 0;
    for (let yy = y * f; yy < Math.min(H, y * f + f); yy += 2) for (let xx = x * f; xx < Math.min(W, x * f + f); xx += 2){ s += d[(yy * W + xx) * 4]; n++; }
    bg[y * w + x] = n ? s / n : 255;
  }
  const passa = (src, fn, r) => { const out = new Float32Array(src.length); for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++){ let acc = fn === 'max' ? 0 : 0, n = 0; for (let dy = -r; dy <= r; dy++){ const yy = y + dy; if (yy < 0 || yy >= hh) continue; for (let dx = -r; dx <= r; dx++){ const xx = x + dx; if (xx < 0 || xx >= w) continue; const v = src[yy * w + xx]; if (fn === 'max'){ if (v > acc) acc = v; } else { acc += v; n++; } } } out[y * w + x] = fn === 'max' ? acc : acc / n; } return out; };
  bg = passa(passa(bg, 'max', 2), 'max', 2);     // o mais claro em volta: papel, não tinta
  bg = passa(passa(bg, 'med', 2), 'med', 2);     // suaviza
  /* papel já por igual (scanner bom): não mexe, para não realçar o ruído */
  let mn = 255, mx = 0; for (const v of bg){ if (v < mn) mn = v; if (v > mx) mx = v; }
  if (mx - mn < (self.OCR_EXP && self.OCR_EXP.varia || 28)) return false;
  for (let y = 0; y < H; y++){
    const fy = Math.min(hh - 1.001, Math.max(0, y / f - .5)), y0 = fy | 0, ty = fy - y0;
    for (let x = 0; x < W; x++){
      const fx = Math.min(w - 1.001, Math.max(0, x / f - .5)), x0 = fx | 0, tx = fx - x0;
      const a = bg[y0 * w + x0], b = bg[y0 * w + x0 + 1], c = bg[(y0 + 1) * w + x0], e = bg[(y0 + 1) * w + x0 + 1];
      const fundo = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
      const i = (y * W + x) * 4;
      d[i] = Math.min(255, d[i] * 255 / Math.max(24, fundo)) | 0;
    }
  }
  return true;
}

/* ---------- OCR: o que é texto e o que é lixo ----------
   Linha com confiança média baixa, ou feita quase só de símbolos e letras
   soltas (borda da página, sombra, mancha), sai. */
function palavrasLimpas(data, W, H){
  const X = self.OCR_EXP || {};
  const ok = l => {
    const ws = (l.words || []).filter(p => p.text && p.text.trim());
    if (!ws.length) return false;
    const txt = ws.map(p => p.text).join(' ');
    const letras = (txt.match(/[\p{L}\p{N}]/gu) || []).length, tot = txt.replace(/\s/g, '').length || 1;
    const conf = ws.reduce((s, p) => s + p.confidence, 0) / ws.length;
    const longas = ws.filter(p => /[\p{L}]{3,}/u.test(p.text)).length;
    return conf >= (X.confLinha ?? 55) && letras / tot >= .6 && (longas >= 1 || conf >= 80);
  };
  const linhas = (data.lines && data.lines.length && X.lixo !== false) ? data.lines.filter(ok) : null;
  const fonte = linhas ? linhas.flatMap(l => l.words || []) : (data.words || []);
  /* palavra curta e incerta que não é palavra curta de verdade (mancha lida como "es", "Fo", "|") sai */
  const CURTAS = /^[«“"(\[—–-]*(a|à|ao|as|às|o|os|e|é|de|da|do|em|um|no|na|nos|nas|se|eu|me|te|lhe|já|só|há|tu|lá|cá|ou|ai|ui|oh|ah|i|y|of|an|in|on|at|to|is|it|by|or|as|if|we|he|me|my|no|so|up|us|be|do)[»”")\],.;:!?…—–-]*$/i;
  const curtaRuim = p => { const t = p.text.trim(), letras = t.replace(/[^\p{L}\p{N}]/gu, ''); if (!letras.length) return !/^[—–«»“”"'‘’…]+$/.test(t);   // travessão, aspas e reticências ficam; hífen solto é mancha
    return letras.length <= 2 && p.confidence < 70 && !CURTAS.test(t); };
  return fonte.filter(p => p.text && p.text.trim() && p.confidence > 35 && (X.curtas === false || !curtaRuim(p)))
    .map(p => [p.text, +(p.bbox.x0 / W).toFixed(4), +(p.bbox.y0 / H).toFixed(4), +((p.bbox.x1 - p.bbox.x0) / W).toFixed(4), +((p.bbox.y1 - p.bbox.y0) / H).toFixed(4)]);
}

/* ---------- OCR: linhas e parágrafos a partir das palavras ----------
   Cada palavra é [texto, x, y, largura, altura] em fração da página.
   Linhas: a palavra seguinte desce ou volta para a esquerda. Parágrafo:
   vão entre linhas bem maior que o normal da página, ou linha anterior
   curta terminando em ponto, ou recuo depois de ponto. Hífen no fim da
   linha junta a palavra. Os parágrafos do próprio Tesseract partiam no
   meio das frases, o que estragava cópia e tradução. */
function linhasOcr(P){
  const linhas = [];
  let cur = null;
  P.forEach((p, i) => {
    const ant = P[i - 1];
    if (!cur || !ant || p[2] > ant[2] + ant[4] * .6 || p[1] + .001 < ant[1]){ cur = { idx: [], x0: p[1], x1: p[1] + p[3], top: p[2], h: p[4] }; linhas.push(cur); }
    cur.idx.push(i); cur.x1 = Math.max(cur.x1, p[1] + p[3]); cur.h = Math.max(cur.h, p[4]);
  });
  const gaps = linhas.slice(1).map((l, i) => l.top - linhas[i].top).filter(g => g > 0).sort((a, b) => a - b);
  const med = gaps.length ? gaps[gaps.length >> 1] : .03;
  const larg = linhas.map(l => l.x1 - l.x0).sort((a, b) => a - b), cheia = larg.length ? larg[Math.floor(larg.length * .8)] : 1;
  const esq = linhas.map(l => l.x0).sort((a, b) => a - b)[Math.floor(linhas.length * .2)] || 0;
  linhas.forEach((l, i) => {
    const a = linhas[i - 1];
    if (!a){ l.novoPar = true; return; }
    const fimFrase = /[.!?:»”"…)]$/.test(P[a.idx[a.idx.length - 1]][0]);
    l.novoPar = (l.top - a.top) > med * 1.45 || (fimFrase && (a.x1 - a.x0) < cheia * .82) || (fimFrase && l.x0 > esq + .02);
  });
  return linhas;
}
function paragrafosOcr(P){
  const out = [];
  let par = '';
  for (const l of linhasOcr(P)){
    if (l.novoPar && par){ out.push(par); par = ''; }
    const t = l.idx.map(i => P[i][0]).join(' ');
    if (/[A-Za-zÀ-ÿ]-$/.test(par) && /^[a-zà-ÿ]/.test(t)) par = par.slice(0, -1) + t;
    else par += (par ? ' ' : '') + t;
  }
  if (par) out.push(par);
  return out;
}

const PdfEngine = {
  /* Rolagem contínua (padrão) ou "Uma por vez": a página inteira na tela,
     lado a lado, virando para os lados com a passagem escolhida em Aa */
  get paged(){ return RS.pdfPagina === 'uma'; },
  async open(b){
    this.b = b;
    const lib = await pdfLib();
    const file = await DB.get('arq:' + b.id);
    if (!file) throw new Error('arquivo não encontrado');
    this.doc = await lib.getDocument(pdfOpcoes(new Uint8Array(await file.arrayBuffer()))).promise;
    this.n = this.doc.numPages;
    if (b.pages !== this.n){ b.pages = this.n; putI('books', b); }
    this.zoom = b.zoom || 1;
    this.sizes = {};
    this.texts = {};
    this.paras = {};
    this.live = new Map();
    this.queue = Promise.resolve();
    const p1 = await this.doc.getPage(1);
    const v1 = p1.getViewport({ scale: 1 });
    this.ratio = v1.height / v1.width;
    this.sizes[1] = [v1.width, v1.height];

    const stage = $('#rdStage');
    stage.className = 'rd-stage pdf' + (this.paged ? ' pdf-uma' : '');
    this.modo = this.paged ? 'uma' : 'rolar';
    stage.replaceChildren(h('div', { class: 'pdf-scroll', id: 'pdfScroll' }, h('div', { class: 'pdf-pages', id: 'pdfPages' })));
    stageInput(stage, this);
    const bOcr = $('#rdBocr'); if (bOcr) bOcr.hidden = false;
    const bot = document.querySelector('.rd-bot');
    bot.append(h('div', { class: 'pdf-zoom', role: 'group', 'aria-label': 'Zoom da página' },
      h('button', { type: 'button', title: 'Diminuir', 'aria-label': 'Diminuir', onclick: () => this.setZoom(this.zoom / 1.2) }, ico('zoom-out')),
      h('button', { type: 'button', title: 'Ajustar à largura', onclick: () => this.setZoom(1) }, ico('move-horizontal'), h('span', { text: 'Ajustar' })),
      h('button', { type: 'button', title: 'Aumentar', 'aria-label': 'Aumentar', onclick: () => this.setZoom(this.zoom * 1.2) }, ico('zoom-in'))));

    const sc = $('#pdfScroll');
    this.observa();
    this.build();
    let t;
    sc.addEventListener('scroll', () => { selbar.hide(); clearTimeout(t); t = setTimeout(() => this.track(), 120); }, { passive: true });
    this.ro = new ResizeObserver(() => { clearTimeout(this.rt); this.rt = setTimeout(() => this.relayout(), 200); });
    this.ro.observe(stage);
    const p = (b.pos && b.pos.page) || 1;
    requestAnimationFrame(() => this.scrollTo(p, b.pos && b.pos.y));
  },
  close(){
    if (this.lendoLivro) this.lendoLivro.parar = true;
    clearTimeout(this.rt); clearTimeout(this.tt);
    this.io && this.io.disconnect();
    this.ro && this.ro.disconnect();
    try { this.doc && this.doc.destroy(); } catch (e) {}
    this.doc = null; this.live = new Map();
  },
  /* só as páginas perto da tela são desenhadas: perto em altura na rolagem, em largura na página única */
  observa(){
    const sc = $('#pdfScroll');
    this.io && this.io.disconnect();
    this.io = new IntersectionObserver(es => es.forEach(en => {
      const n = +en.target.dataset.n;
      if (en.isIntersecting) this.want(n); else this.drop(n);
    }), { root: sc, rootMargin: this.paged ? '0px 120%' : '120% 0px' });
  },
  cssW(){
    const st = $('#rdStage'), w = st.clientWidth;
    /* página única: cabe inteira na tela (altura e largura) */
    if (this.paged) return Math.round(Math.max(120, Math.min(w - (w > 700 ? 64 : 14), (st.clientHeight - 30) / (this.ratio || 1.414))) * this.zoom);
    return Math.round(Math.min(w - (w > 700 ? 48 : 12), 980) * this.zoom);
  },
  build(){
    const box = $('#pdfPages');
    const W = this.cssW();
    this.W = W;
    box.replaceChildren();
    this.io.disconnect();
    this.live = new Map();
    for (let n = 1; n <= this.n; n++){
      const s = this.sizes[n], r = s ? s[1] / s[0] : this.ratio;
      const pg = h('div', { class: 'pdf-pg', 'data-n': n, style: { width: W + 'px', height: Math.round(W * r) + 'px' } }, h('span', { class: 'pdf-num', text: n }));
      box.append(pg);
      this.io.observe(pg);
    }
  },
  setZoom(z){
    this.zoom = Math.max(.6, Math.min(3, z));
    this.b.zoom = this.zoom; putI('books', this.b);
    this.relayout();
  },
  /* Mudou o tamanho (zoom, barra lateral, tela girada): as páginas NÃO são
     apagadas. Cada uma muda de tamanho no lugar, a imagem atual estica até
     a nova (nítida) ficar pronta por trás e ser trocada. Se só a altura
     mudou (a barra de endereço do celular aparecendo e sumindo), nada se
     refaz. Antes, tudo era apagado e redesenhado: a página piscava. */
  relayout(){
    if (!this.doc || !$('#rdStage') || !$('#pdfScroll')) return;     // livro já fechado
    if (this.modo !== (this.paged ? 'uma' : 'rolar')) return this.mudaModo();
    const W = this.cssW();
    if (!this.n || W === this.W) return;
    const sc = $('#pdfScroll'), cur = this.cur || 1, pgCur = this.pageEl(cur);
    const y = pgCur && sc ? Math.max(0, (sc.scrollTop - pgCur.offsetTop) / pgCur.offsetHeight) : 0;
    this.W = W;
    for (const pg of document.querySelectorAll('#pdfPages .pdf-pg')){
      const n = +pg.dataset.n, s = this.sizes[n], r = s ? s[1] / s[0] : this.ratio;
      pg.style.width = W + 'px'; pg.style.height = Math.round(W * r) + 'px';
      const tl = pg.querySelector('.textLayer:not(.ocr-layer)');
      if (tl && s) tl.style.setProperty('--total-scale-factor', W / s[0]);
      if (this.live.get(n) === 'on'){
        this.live.set(n, 'wait');
        this.queue = this.queue.then(() => this.live.get(n) === 'wait' ? this.render(n) : null).catch(() => {});
      }
    }
    if (this.paged) this.scrollTo(cur);
    else if (pgCur && sc) sc.scrollTop = pgCur.offsetTop + y * pgCur.offsetHeight;
  },

  want(n){
    if (this.live.has(n)) return;
    this.live.set(n, 'wait');
    this.queue = this.queue.then(() => this.live.get(n) === 'wait' ? this.render(n) : null).catch(() => {});
  },
  drop(n){
    const st = this.live.get(n);
    if (!st) return;
    this.live.delete(n);
    if (st !== 'wait'){ const pg = this.pageEl(n); pg && pg.querySelectorAll('canvas,.textLayer,.hl-layer').forEach(x => x.remove()); }
  },
  pageEl(n){ return document.querySelector(`.pdf-pg[data-n="${n}"]`); },
  async render(n){
    if (!this.doc) return;
    const page = await this.doc.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    this.sizes[n] = [v1.width, v1.height];
    const pg = this.pageEl(n);
    if (!pg || this.live.get(n) !== 'wait') return;
    const W = this.cssW(), scale = W / v1.width, vp = page.getViewport({ scale });
    pg.style.height = Math.round(vp.height) + 'px';
    const dpr = FRACO ? 1 : Math.min(2, devicePixelRatio || 1);
    const cv = h('canvas', { width: Math.floor(vp.width * dpr), height: Math.floor(vp.height * dpr) });
    cv.style.width = '100%'; cv.style.height = '100%';   // estica junto se a página mudar de tamanho
    const task = page.render({ canvasContext: cv.getContext('2d', { alpha: false }), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
    await task.promise;
    if (this.live.get(n) !== 'wait'){ page.cleanup(); return; }
    pg.querySelectorAll('canvas,.textLayer,.hl-layer').forEach(x => x.remove());
    const hl = h('div', { class: 'hl-layer' });
    const tl = h('div', { class: 'textLayer' });
    /* camada de texto do pdf.js 5: o tamanho de cada pedaço sai de
       --total-scale-factor, então ela acompanha o zoom sem refazer */
    tl.style.setProperty('--total-scale-factor', scale);
    tl.style.setProperty('--scale-round-x', '1px'); tl.style.setProperty('--scale-round-y', '1px');
    pg.append(cv, hl, tl);
    this.live.set(n, 'on');
    this.paintPage(n);
    let temTexto = false;
    try {
      const tc = await page.getTextContent();
      const tx = textoDaPagina(tc);
      temTexto = tx.texto.length > 20;
      if (temTexto){ this.texts[n] ||= tx.texto; this.paras[n] ||= tx.paras; }
      if (this.live.get(n) === 'on' && temTexto) await new pdfjsLib.TextLayer({ textContentSource: tc, container: tl, viewport: vp }).render();
    } catch (e) {}
    page.cleanup();
    if (!temTexto && this.live.get(n) === 'on') this.semTexto(n, cv);
  },

  /* página sem texto: usa o OCR já guardado, lê sozinho (se pedido) ou
     acende o ícone de OCR na barra (no lugar do aviso que sumia) */
  async semTexto(n, cv){
    const pg = this.pageEl(n);
    if (!pg) return;
    pg.classList.add('sem-texto');
    const salvo = await DB.get('ocr:' + this.b.id + ':' + n);
    if (salvo && salvo.palavras){ this.camadaOcr(n, salvo); this.estadoOcr(); return; }
    if (RS.ocrAuto){ this.ocr(n, cv); return; }
    this.estadoOcr();
  },
  /* o ícone da barra conta a situação da página na tela */
  estadoOcr(){
    const b = $('#rdBocr'), pg = this.pageEl(this.cur || 1);
    if (!b || !pg) return;
    const lendo = pg.classList.contains('lendo'), feito = pg.classList.contains('com-ocr'), escaneada = pg.classList.contains('sem-texto');
    b.classList.toggle('precisa', escaneada && !feito && !lendo);
    b.classList.toggle('lendo', lendo);
    b.title = lendo ? 'Lendo a página…' : escaneada && !feito ? 'Página escaneada: toque para reconhecer o texto' : feito ? 'Texto reconhecido (OCR)' : 'Reconhecer o texto (OCR)';
  },
  menuOcr(){
    const b = $('#rdBocr'), n = this.cur || 1, pg = this.pageEl(n);
    if (!b || !pg) return;
    const escaneada = pg.classList.contains('sem-texto'), feito = pg.classList.contains('com-ocr'), lendo = pg.classList.contains('lendo');
    const fecha = fn => () => { selbar.hide(); fn(); };
    selbar.show(b.getBoundingClientRect(), [
      lendo ? { label: 'Lendo a página…', onclick: () => selbar.hide() }
        : escaneada && !feito ? { label: 'Ler esta página', onclick: fecha(() => this.ocr(n, pg.querySelector('canvas'))) }
        : feito ? { label: 'Ler de novo esta página', onclick: fecha(() => this.relerOcr()) }
        : { label: 'Esta página já tem texto', onclick: () => selbar.hide() },
      { label: RS.ocrAuto ? 'Ler sozinho: ligado' : 'Ler sozinho: desligado', on: !!RS.ocrAuto, title: 'Lê cada página escaneada ao chegar nela', onclick: fecha(() => {
        RS.ocrAuto = !RS.ocrAuto; saveRS();
        toast(RS.ocrAuto ? 'As páginas escaneadas serão lidas sozinhas ao aparecer.' : 'Leitura automática desligada.');
        if (RS.ocrAuto) for (const [k, st] of this.live) { const p = this.pageEl(k); if (st === 'on' && p && p.classList.contains('sem-texto') && !p.classList.contains('com-ocr')) this.ocr(k, p.querySelector('canvas')); }
      }) },
      (this.paras[n] || []).length ? { label: 'Copiar o texto desta página', onclick: fecha(() => { navigator.clipboard?.writeText(this.paras[n].join('\n\n')); toast('Texto da página copiado, com os parágrafos.'); }) } : null,
      { label: this.lendoLivro ? 'Parar a leitura do livro' : 'Ler o livro todo', title: 'Passa o OCR em todas as páginas escaneadas, em segundo plano', onclick: fecha(() => this.lerLivro()) },
      { label: 'Idioma do livro…', onclick: fecha(() => aaAbrir()) },
    ]);
  },
  /* Imagem própria para o OCR, a uns 300 DPI e em tons de cinza com
     contraste esticado: a da tela no celular tem uns 90 DPI, pouco para o
     Tesseract (é aí que "rn" vira "m" e palavras somem). */
  async imagemOcr(n){
    const page = await this.doc.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    const escala = Math.min(300 / 72, 3400 / Math.max(v1.width, v1.height));
    const vp = page.getViewport({ scale: escala });
    const cv = document.createElement('canvas');
    cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    page.cleanup();
    const img = ctx.getImageData(0, 0, cv.width, cv.height), d = img.data;
    const X = self.OCR_EXP || {};
    for (let i = 0; i < d.length; i += 4) d[i] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
    if (X.luz !== false) achataLuz(d, cv.width, cv.height);
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
    /* estica o contraste entre os 1% mais escuros e os 1% mais claros (papel amarelado, tinta apagada) */
    const tot = cv.width * cv.height; let acc = 0, lo = 0, hi = 255;
    for (let v = 0; v < 256; v++){ acc += hist[v]; if (acc > tot * .01){ lo = v; break; } }
    acc = 0; for (let v = 255; v >= 0; v--){ acc += hist[v]; if (acc > tot * .01){ hi = v; break; } }
    const k = 255 / Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4){ const g = Math.max(0, Math.min(255, (d[i] - lo) * k)) | 0; d[i] = d[i + 1] = d[i + 2] = g; }
    ctx.putImageData(img, 0, 0);
    return cv;
  },
  /* lê uma página (sem depender de ela estar na tela) e guarda o resultado */
  async ocrPagina(n, cvTela){
    const w = await ocrTrabalhador();
    let cv = cvTela;
    try { cv = await this.imagemOcr(n); } catch (e) { if (!cv) throw e; }
    const { data } = await w.recognize(cv);
    const palavras = palavrasLimpas(data, cv.width, cv.height);
    const paras = paragrafosOcr(palavras);
    const salvo = { palavras, paras, texto: paras.join(' ') };
    await DB.set('ocr:' + this.b.id + ':' + n, salvo);
    this.paras[n] = paras; this.texts[n] = salvo.texto;
    return salvo;
  },
  /* OCR → "Ler o livro todo": passa por todas as páginas sem texto que
     ainda não foram lidas, uma de cada vez, com o progresso num aviso que
     dá para interromper. A busca e a tradução passam a valer no livro todo. */
  async lerLivro(){
    if (this.lendoLivro){ this.lendoLivro.parar = true; return; }
    const job = this.lendoLivro = { parar: false };
    const doc = this.doc, livro = this.b.id;
    const fila = [];
    toast('Procurando as páginas escaneadas…');
    for (let n = 1; n <= this.n && !job.parar; n++){
      if (await DB.get('ocr:' + livro + ':' + n)) continue;
      try { const p = await doc.getPage(n); const tx = textoDaPagina(await p.getTextContent()); p.cleanup(); if (tx.texto.length > 20) continue; } catch (e) {}
      fila.push(n);
    }
    let feitas = 0;
    for (const n of fila){
      if (job.parar || this.doc !== doc) break;
      toast(`Lendo o livro: página ${n} (${feitas + 1} de ${fila.length})…`, 'Parar', () => { job.parar = true; });
      try {
        const salvo = await this.ocrPagina(n);
        const pg = this.pageEl(n);
        if (pg && this.live.get(n) === 'on') this.camadaOcr(n, salvo);
        feitas++;
      } catch (e) { toast('Parei na página ' + n + ': ' + (e.message || e)); break; }
    }
    this.lendoLivro = null;
    this.estadoOcr();
    toast(fila.length ? (job.parar ? `Parei: ${feitas} de ${fila.length} páginas lidas. Dá para continuar depois.` : `Pronto: ${feitas} ${feitas === 1 ? 'página lida' : 'páginas lidas'}. A busca já vale no livro todo.`) : 'Todas as páginas já têm texto.');
  },
  async ocr(n, cvTela){
    const pg = this.pageEl(n);
    if (!pg || pg.classList.contains('lendo')) return;
    pg.classList.add('lendo');
    this.estadoOcr();
    const aviso = h('div', { class: 'ocr-lendo', text: 'Lendo a página…' });
    pg.append(aviso);
    try {
      const salvo = await this.ocrPagina(n, cvTela);
      this.camadaOcr(n, salvo);
      if (!salvo.palavras.length) toast('Não achei texto nesta página.');
    } catch (e) {
      toast('Não deu para reconhecer: ' + (e.message || e));
      pg.classList.remove('lendo');
      this.semTexto(n, cvTela);
    } finally { aviso.remove(); pg.classList.remove('lendo'); this.estadoOcr(); }
  },
  /* Aa → "Ler de novo esta página": apaga o OCR guardado e lê outra vez
     (vale para páginas lidas antes da imagem em alta resolução) */
  async relerOcr(){
    const n = this.cur || 1, pg = this.pageEl(n);
    if (!pg) return;
    await DB.del('ocr:' + this.b.id + ':' + n);
    delete this.texts[n]; delete this.paras[n];
    pg.querySelector('.ocr-layer')?.remove();
    pg.classList.remove('com-ocr');
    this.ocr(n, pg.querySelector('canvas'));
  },
  /* as palavras lidas viram uma camada de texto invisível, do tamanho de cada uma */
  camadaOcr(n, salvo){
    const pg = this.pageEl(n);
    if (!pg) return;
    /* parágrafos refeitos das palavras (vale também para OCR guardado antes) */
    this.paras[n] = salvo.palavras && salvo.palavras.length ? paragrafosOcr(salvo.palavras) : (salvo.paras || []);
    this.texts[n] = this.paras[n].join(' ') || salvo.texto || '';
    pg.classList.add('com-ocr');
    pg.querySelector('.textLayer')?.remove();
    const tl = h('div', { class: 'textLayer ocr-layer' });
    const H = pg.offsetHeight;
    /* O espaço entre as palavras vai num <span> próprio (posicionado como as
       palavras): um espaço solto entre elementos posicionados é descartado
       pelo Chrome ao copiar, e o texto colava ("Mantenhocomigoo…"). Fim de
       linha vira quebra; palavra partida com hífen no fim da linha volta a
       ser uma só na cópia. */
    const P = salvo.palavras;
    const inicioPar = new Set(), inicioLinha = new Set();
    for (const l of linhasOcr(P)){ inicioLinha.add(l.idx[0]); if (l.novoPar) inicioPar.add(l.idx[0]); }
    P.forEach(([t, x, y, w, hh], i) => {
      const prox = P[i + 1];
      const novaLinha = prox && inicioLinha.has(i + 1);
      const hifen = novaLinha && /[A-Za-zÀ-ÿ]-$/.test(t) && /^[a-zà-ÿ]/.test(prox[0]);
      const fs = Math.max(6, hh * H * .92) + 'px';
      tl.append(h('span', { text: hifen ? t.slice(0, -1) : t, 'data-i': i, 'data-h': hifen ? '1' : null, style: { left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: hh * 100 + '%', fontSize: fs } }));
      if (!prox) return;
      /* vão grande entre linhas = parágrafo novo */
      const paragrafo = inicioPar.has(i + 1);
      tl.append(h('span', { class: 'ocr-esp', text: hifen ? '' : paragrafo ? '\n\n' : ' ', style: { left: (x + w) * 100 + '%', top: y * 100 + '%', width: '0', height: hh * 100 + '%', fontSize: fs } }));
    });
    /* como no pdf.js: enquanto arrasta, um fundo invisível segura a
       seleção dentro da camada (sem ele, passar por um vão entre palavras
       selecionava até o fim da página) */
    const fim = h('div', { class: 'endOfContent' });
    tl.append(fim);
    tl.addEventListener('pointerdown', () => { tl.classList.add('selecting'); addEventListener('pointerup', () => tl.classList.remove('selecting'), { once: true }); });
    pg.append(tl);
    requestAnimationFrame(() => tl.querySelectorAll('span:not(.ocr-esp)').forEach(sp => {
      const k = sp.offsetWidth / Math.max(1, sp.scrollWidth);
      if (k < .98 || k > 1.02) sp.style.transform = `scaleX(${k.toFixed(3)})`;
    }));
    trFollow();
  },

  /* trocar entre rolagem e página única: refaz as páginas no lugar certo */
  mudaModo(){
    const cur = this.cur || 1;
    this.modo = this.paged ? 'uma' : 'rolar';
    $('#rdStage').classList.toggle('pdf-uma', this.paged);
    const pp = $('#pdfPages'); if (pp && !this.paged) pp.style.paddingInline = '';
    this.observa(); this.build();
    requestAnimationFrame(() => this.scrollTo(cur));
  },
  track(){
    const sc = $('#pdfScroll');
    if (!sc) return;
    let n = 1;
    if (this.paged){
      const mid = sc.scrollLeft + sc.clientWidth / 2;
      for (const pg of sc.querySelectorAll('.pdf-pg')){ if (pg.offsetLeft <= mid) n = +pg.dataset.n; else break; }
    } else {
      const mid = sc.scrollTop + sc.clientHeight * .35;
      for (const pg of sc.querySelectorAll('.pdf-pg')){ if (pg.offsetTop <= mid) n = +pg.dataset.n; else break; }
    }
    if (this.paged && this.cur !== n){ this.pageEl(this.cur)?.classList.remove('atual'); }
    this.cur = n;
    const pg = this.pageEl(n);
    if (this.paged && pg) pg.classList.add('atual');
    const y = pg && !this.paged ? Math.max(0, (sc.scrollTop - pg.offsetTop) / pg.offsetHeight) : 0;
    const t = this.tocAt(n);
    $('#rdChap').textContent = t ? t.l : '';
    savePos({ page: n, y: +y.toFixed(3) }, this.n > 1 ? (n - 1) / (this.n - 1) : 1, `p. ${n} de ${this.n}`);
    this.estadoOcr();
    trFollow();
  },
  scrollTo(n, y = 0, suave){
    const pg = this.pageEl(Math.max(1, Math.min(this.n, n)));
    if (!pg) return;
    const sc = $('#pdfScroll');
    if (this.paged){
      /* página única: a página fica centrada; "Deslizar" anima, o resto pula */
      sc.style.paddingInline = '';
      const pp = $('#pdfPages'); if (pp) pp.style.paddingInline = Math.round(sc.clientWidth / 2) + 'px';
      sc.scrollTo({ left: pg.offsetLeft - (sc.clientWidth - pg.offsetWidth) / 2, top: 0, behavior: suave ? 'smooth' : 'auto' });
      if (suave){ this.pageEl(this.cur)?.classList.remove('atual'); this.cur = +pg.dataset.n; pg.classList.add('atual'); clearTimeout(this.tt); this.tt = setTimeout(() => this.track(), 420); return; }
      this.track();
      return;
    }
    sc.scrollTop = pg.offsetTop + (y || 0) * pg.offsetHeight - (y ? 40 : 8);
    this.track();
  },
  /* virar na página única, com a passagem escolhida (Aa) */
  vira(d){
    const n = (this.cur || 1) + d;
    if (n < 1 || n > this.n) return;
    if (!this.paged) return this.scrollTo(n);
    selbar.hide();
    flash();
    return passagem() === 'deslizar' ? this.scrollTo(n, 0, true) : esmaecendo(() => this.scrollTo(n));
  },
  tocAt(n){ let last = null; for (const t of this.b.toc || []) if (t.p <= n) last = t; return last; },
  tocActive(){ const t = this.tocAt(this.cur || 1); return t ? this.b.toc.indexOf(t) : -1; },
  gotoToc(t){ this.scrollTo(t.p); },
  gotoPct(p){ this.scrollTo(1 + Math.round(p * (this.n - 1))); },
  gotoHl(x){ this.scrollTo(x.page, Math.max(0, (x.y || 0) - .05)); setTimeout(() => this.blink(x.id), 600); },
  blink(id){ document.querySelectorAll(`.hl-layer [data-h="${id}"]`).forEach(m => { m.classList.remove('blink'); void m.offsetWidth; m.classList.add('blink'); }); },
  next(){ return this.vira(1); }, prev(){ return this.vira(-1); }, link(){},
  /* Texto da página atual (para traduzir), em pedaços de frases */
  visibleBlocks(){
    const paras = this.paras[this.cur || 1];
    const base = paras && paras.length ? paras : [(this.texts[this.cur || 1] || '').trim()].filter(Boolean);
    // parágrafo inteiro dá contexto ao tradutor; só os muito longos se dividem, por frase
    const out = [];
    for (const t of base){
      if (t.length <= 1400){ out.push(t); continue; }
      let cur = '';
      for (const f of t.match(/[^.!?]+[.!?]*\s*/g) || [t]){ if ((cur + f).length > 1200 && cur){ out.push(cur.trim()); cur = ''; } cur += f; }
      if (cur.trim()) out.push(cur.trim());
    }
    return out;
  },

  /* destaques */
  paintPage(n){
    const pg = this.pageEl(n), layer = pg && pg.querySelector('.hl-layer');
    if (!layer) return;
    layer.replaceChildren(...hlOf(this.b.id).filter(x => x.page === n).flatMap(x => x.rects.map(r =>
      h('i', { class: 'pr c-' + x.color + ' s-' + (x.style || 'marca') + (x.note ? ' has-note' : ''), 'data-h': x.id, style: { left: r[0] * 100 + '%', top: r[1] * 100 + '%', width: r[2] * 100 + '%', height: r[3] * 100 + '%' } }))));
  },
  repaint(){ for (const [n, st] of this.live) if (st === 'on') this.paintPage(n); },
  hitHl(e){
    const pg = e.target.closest('.pdf-pg');
    if (!pg) return null;
    const r = pg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, n = +pg.dataset.n;
    const hit = hlOf(this.b.id).find(hl => hl.page === n && hl.rects.some(q => x >= q[0] && x <= q[0] + q[2] && y >= q[1] && y <= q[1] + q[3]));
    return hit ? [hit, pg.querySelector(`[data-h="${hit.id}"]`)] : null;
  },
  onSelect(){
    const s = getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return;
    const r = s.getRangeAt(0);
    const start = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement);
    const pg = start && start.closest('.pdf-pg');
    if (!pg || !pg.querySelector('.textLayer')?.contains(start)) return;
    const text = s.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 2) return;
    const box = pg.getBoundingClientRect();
    let rects = [...r.getClientRects()].filter(q => q.width > 1 && q.height > 1 && q.top >= box.top - 2 && q.bottom <= box.bottom + 2)
      .map(q => [(q.left - box.left) / box.width, (q.top - box.top) / box.height, q.width / box.width, q.height / box.height]);
    rects = mergeRects(rects);
    if (!rects.length) return;
    const n = +pg.dataset.n;
    const all = r.getClientRects(), last = all[all.length - 1] || r.getBoundingClientRect();
    const meets = (p, q) => p[0] < q[0] + q[2] && q[0] < p[0] + p[2] && p[1] < q[1] + q[3] && q[1] < p[1] + p[3];
    const overlaps = hlOf(this.b.id).filter(x => x.page === n && x.rects.some(q => rects.some(p => meets(p, q))));
    /* contexto para o tradutor: os parágrafos da página (do PDF ou do OCR) */
    const ctx = (this.paras[n] || []).join('\n\n').slice(0, 4000);
    selbar.show(last, selActions({ text, texto: textoLimpo(s), ref: { page: n }, overlaps, ctx, erase: () => removeHls(overlaps),
      make: (color, style) => { const x = newHl({ page: n, rects, y: rects[0][1], text, color, style }); this.paintPage(n); return x; } }));
  },

  async search(q, emit){
    const nq = norm(q);
    for (let n = 1; n <= this.n; n++){
      if (!this.doc) return;
      if (this.texts[n] == null){
        try {
          const p = await this.doc.getPage(n); const tx = textoDaPagina(await p.getTextContent()); p.cleanup();
          if (tx.texto) { this.texts[n] = tx.texto; this.paras[n] = tx.paras; }
          else { const o = await DB.get('ocr:' + this.b.id + ':' + n); this.texts[n] = (o && o.texto) || ''; }
        }
        catch (e) { this.texts[n] = ''; }
      }
      const txt = this.texts[n], low = norm(txt);
      let i = low.indexOf(nq), nth = 0;
      while (i > -1){
        if (emit({ page: n, q, nth: nth++, pre: '…' + txt.slice(Math.max(0, i - 50), i), mid: txt.slice(i, i + q.length), post: txt.slice(i + q.length, i + q.length + 70) + '…', label: 'p. ' + n }) === false) return;
        i = low.indexOf(nq, i + nq.length);
      }
    }
  },
  /* pula para a página e marca o trecho achado na camada de texto (por
     uns segundos), como no leitor de PDF do Firefox */
  async gotoHit(hit){
    this.scrollTo(hit.page);
    let tl = null;
    for (let k = 0; k < 30 && !(tl = this.pageEl(hit.page)?.querySelector('.textLayer:not(:empty)')); k++) await new Promise(r => setTimeout(r, 100));
    if (!tl || !hit.q) return;
    tl.querySelectorAll('mark.hit').forEach(m => m.replaceWith(...m.childNodes));
    const txt = tl.textContent, alvo = norm(hit.q).replace(/\s+/g, ' ');
    /* procura sem acento e sem diferença de espaço, guardando de onde veio cada letra */
    let plano = '', mapa = [];
    for (let i = 0; i < txt.length; i++){ const c = norm(txt[i]); for (const ch of c){ if (/\s/.test(ch) && plano.endsWith(' ')) continue; plano += /\s/.test(ch) ? ' ' : ch; mapa.push(i); } }
    let k = plano.indexOf(alvo);
    for (let j = 0; j < (hit.nth || 0) && k > -1; j++){ const k2 = plano.indexOf(alvo, k + alvo.length); if (k2 < 0) break; k = k2; }   // a ocorrência escolhida, não a primeira
    if (k < 0) return;
    const ms = wrapOffsets(tl, mapa[k], mapa[k + alvo.length - 1] + 1, () => h('mark', { class: 'hit' }));
    if (ms[0]){
      const sc = $('#pdfScroll'), r = ms[0].getBoundingClientRect(), b = sc.getBoundingClientRect();
      if (r.top < b.top + 40 || r.bottom > b.bottom - 40) sc.scrollTop += r.top - b.top - sc.clientHeight * .35;
    }
    setTimeout(() => tl.querySelectorAll('mark.hit').forEach(m => m.replaceWith(...m.childNodes)), 3200);
  },
};

/* Junta retângulos da mesma linha (o pdf.js quebra a linha em vários pedaços) */
function mergeRects(rs){
  rs.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const out = [];
  for (const r of rs){
    const l = out[out.length - 1];
    if (l && Math.abs(l[1] - r[1]) < l[3] * .5 && r[0] <= l[0] + l[2] + .02){
      const x2 = Math.max(l[0] + l[2], r[0] + r[2]), y2 = Math.max(l[1] + l[3], r[1] + r[3]);
      l[0] = Math.min(l[0], r[0]); l[1] = Math.min(l[1], r[1]); l[2] = x2 - l[0]; l[3] = y2 - l[1];
    } else out.push([...r]);
  }
  return out.map(r => r.map(v => +v.toFixed(4)));
}
