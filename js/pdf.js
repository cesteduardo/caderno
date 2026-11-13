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

const PdfEngine = {
  paged: false,
  async open(b){
    this.b = b;
    const lib = await pdfLib();
    const file = await DB.get('arq:' + b.id);
    if (!file) throw new Error('arquivo não encontrado');
    this.doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    this.n = this.doc.numPages;
    if (b.pages !== this.n){ b.pages = this.n; putI('books', b); }
    this.zoom = b.zoom || 1;
    this.sizes = {};
    this.texts = {};
    this.live = new Map();
    this.queue = Promise.resolve();
    const p1 = await this.doc.getPage(1);
    const v1 = p1.getViewport({ scale: 1 });
    this.ratio = v1.height / v1.width;
    this.sizes[1] = [v1.width, v1.height];

    const stage = $('#rdStage');
    stage.className = 'rd-stage pdf';
    stage.replaceChildren(h('div', { class: 'pdf-scroll', id: 'pdfScroll' }, h('div', { class: 'pdf-pages', id: 'pdfPages' })));
    stageInput(stage, this);
    const bot = document.querySelector('.rd-bot');
    bot.append(h('div', { class: 'pdf-zoom' },
      h('button', { class: 'rd-btn', type: 'button', text: '−', 'aria-label': 'Diminuir', onclick: () => this.setZoom(this.zoom / 1.2) }),
      h('button', { class: 'rd-btn', type: 'button', text: 'Ajustar', onclick: () => this.setZoom(1) }),
      h('button', { class: 'rd-btn', type: 'button', text: '+', 'aria-label': 'Aumentar', onclick: () => this.setZoom(this.zoom * 1.2) })));

    const sc = $('#pdfScroll');
    this.io = new IntersectionObserver(es => es.forEach(en => {
      const n = +en.target.dataset.n;
      if (en.isIntersecting) this.want(n); else this.drop(n);
    }), { root: sc, rootMargin: '120% 0px' });
    this.build();
    let t;
    sc.addEventListener('scroll', () => { selbar.hide(); clearTimeout(t); t = setTimeout(() => this.track(), 120); }, { passive: true });
    this.ro = new ResizeObserver(() => { clearTimeout(this.rt); this.rt = setTimeout(() => this.relayout(), 200); });
    this.ro.observe(stage);
    const p = (b.pos && b.pos.page) || 1;
    requestAnimationFrame(() => this.scrollTo(p, b.pos && b.pos.y));
  },
  close(){
    this.io && this.io.disconnect();
    this.ro && this.ro.disconnect();
    try { this.doc && this.doc.destroy(); } catch (e) {}
    this.doc = null; this.live = new Map();
  },
  cssW(){ const w = $('#rdStage').clientWidth; return Math.round(Math.min(w - (w > 700 ? 48 : 12), 980) * this.zoom); },
  build(){
    const box = $('#pdfPages');
    const W = this.cssW();
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
    const cur = this.cur || 1;
    this.zoom = Math.max(.6, Math.min(3, z));
    this.b.zoom = this.zoom; putI('books', this.b);
    this.build();
    requestAnimationFrame(() => this.scrollTo(cur));
  },
  relayout(){ const cur = this.cur || 1; this.build(); requestAnimationFrame(() => this.scrollTo(cur)); },

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
    cv.style.width = vp.width + 'px'; cv.style.height = vp.height + 'px';
    const task = page.render({ canvasContext: cv.getContext('2d', { alpha: false }), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
    await task.promise;
    if (this.live.get(n) !== 'wait'){ page.cleanup(); return; }
    pg.querySelectorAll('canvas,.textLayer,.hl-layer').forEach(x => x.remove());
    const hl = h('div', { class: 'hl-layer' });
    const tl = h('div', { class: 'textLayer' });
    tl.style.setProperty('--scale-factor', scale);
    pg.append(cv, hl, tl);
    this.live.set(n, 'on');
    this.paintPage(n);
    try {
      const tc = await page.getTextContent();
      this.texts[n] ||= tc.items.map(i => i.str || '').join(' ').replace(/\s+/g, ' ');
      if (this.live.get(n) === 'on') await pdfjsLib.renderTextLayer({ textContentSource: tc, container: tl, viewport: vp, textDivs: [] }).promise;
    } catch (e) {}
    page.cleanup();
  },

  track(){
    const sc = $('#pdfScroll');
    if (!sc) return;
    const mid = sc.scrollTop + sc.clientHeight * .35;
    let n = 1;
    for (const pg of sc.querySelectorAll('.pdf-pg')){ if (pg.offsetTop <= mid) n = +pg.dataset.n; else break; }
    this.cur = n;
    const pg = this.pageEl(n);
    const y = pg ? Math.max(0, (sc.scrollTop - pg.offsetTop) / pg.offsetHeight) : 0;
    const t = this.tocAt(n);
    $('#rdChap').textContent = t ? t.l : '';
    savePos({ page: n, y: +y.toFixed(3) }, this.n > 1 ? (n - 1) / (this.n - 1) : 1, `p. ${n} de ${this.n}`);
  },
  scrollTo(n, y = 0){
    const pg = this.pageEl(Math.max(1, Math.min(this.n, n)));
    if (!pg) return;
    $('#pdfScroll').scrollTop = pg.offsetTop + (y || 0) * pg.offsetHeight - (y ? 40 : 8);
    this.track();
  },
  tocAt(n){ let last = null; for (const t of this.b.toc || []) if (t.p <= n) last = t; return last; },
  tocActive(){ const t = this.tocAt(this.cur || 1); return t ? this.b.toc.indexOf(t) : -1; },
  gotoToc(t){ this.scrollTo(t.p); },
  gotoPct(p){ this.scrollTo(1 + Math.round(p * (this.n - 1))); },
  gotoHl(x){ this.scrollTo(x.page, Math.max(0, (x.y || 0) - .05)); setTimeout(() => this.blink(x.id), 600); },
  blink(id){ document.querySelectorAll(`.hl-layer [data-h="${id}"]`).forEach(m => { m.classList.remove('blink'); void m.offsetWidth; m.classList.add('blink'); }); },
  next(){}, prev(){}, link(){},

  /* destaques */
  paintPage(n){
    const pg = this.pageEl(n), layer = pg && pg.querySelector('.hl-layer');
    if (!layer) return;
    layer.replaceChildren(...hlOf(this.b.id).filter(x => x.page === n).flatMap(x => x.rects.map(r =>
      h('i', { class: 'pr c-' + x.color + (x.note ? ' has-note' : ''), 'data-h': x.id, style: { left: r[0] * 100 + '%', top: r[1] * 100 + '%', width: r[2] * 100 + '%', height: r[3] * 100 + '%' } }))));
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
    selbar.show(last, selActions({ text, make: color => { const x = newHl({ page: n, rects, y: rects[0][1], text, color }); this.paintPage(n); return x; } }));
  },

  async search(q, emit){
    const nq = norm(q);
    for (let n = 1; n <= this.n; n++){
      if (!this.doc) return;
      if (this.texts[n] == null){
        try { const p = await this.doc.getPage(n); const tc = await p.getTextContent(); this.texts[n] = tc.items.map(i => i.str || '').join(' ').replace(/\s+/g, ' '); p.cleanup(); }
        catch (e) { this.texts[n] = ''; }
      }
      const txt = this.texts[n], low = norm(txt);
      let i = low.indexOf(nq);
      while (i > -1){
        if (emit({ page: n, pre: '…' + txt.slice(Math.max(0, i - 50), i), mid: txt.slice(i, i + q.length), post: txt.slice(i + q.length, i + q.length + 70) + '…', label: 'p. ' + n }) === false) return;
        i = low.indexOf(nq, i + nq.length);
      }
    }
  },
  gotoHit(hit){ this.scrollTo(hit.page); },
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
