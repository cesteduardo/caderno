/* =====================================================================
   Formatos: EPUB, PDF e TXT
   ---------------------------------------------------------------------
   O tipo sai dos primeiros bytes, não da extensão (no Android o seletor
   de arquivos às vezes entrega o EPUB sem nome certo ou sem tipo).

   EPUB → HTML limpo (parágrafos, títulos, itálico, listas, imagens,
   notas com link), dividido em seções de tamanho fixo para a
   paginação não pesar no celular. O texto fica como o livro escreveu;
   só a formatação de fora (fontes, cores, scripts) é descartada.
   PDF  → guardado como veio e desenhado página por página (pdf.js).
          Nada é transcrito: PDF escaneado abre igual.
   TXT  → parágrafos.
   ===================================================================== */
'use strict';

const PARSER_V = 2;

async function sniff(file){
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const s = String.fromCharCode(...b);
  if (s.startsWith('%PDF')) return 'PDF';
  if (b[0] === 0x50 && b[1] === 0x4b) return 'ZIP';
  if (s.startsWith('BOOKMOBI') || /\.(mobi|azw3?|kfx)$/i.test(file.name)) return 'MOBI';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'PDF';
  if (ext === 'epub') return 'ZIP';
  if (/^(txt|md|text)$/.test(ext) || /^text\//.test(file.type)) return 'TXT';
  if (/\.(docx?|odt|rtf)$/i.test(file.name)) return 'DOC';
  return 'TXT?';
}

const libReady = (name, test) => new Promise((res, rej) => {
  let n = 0;
  (function w(){ if (test()) return res(); if (++n > 150) return rej(new Error(name + ' não carregou.')); setTimeout(w, 100); })();
});

/* ---------- capa pequena (JPEG 180 px) ---------- */
async function smallCover(src, w = 180){
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  if (!sw || !sh) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = Math.round(w * Math.min(1.6, sh / sw));
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  const s = Math.max(c.width / sw, c.height / sh);
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, (c.width - sw * s) / 2, (c.height - sh * s) / 2, sw * s, sh * s);
  return c.toDataURL('image/jpeg', .78);
}
function blobToImg(b){
  if (window.createImageBitmap && !/svg/.test(b.type)) return createImageBitmap(b).catch(() => viaImg(b));
  return viaImg(b);
}
function viaImg(b){
  return new Promise((res, rej) => { const u = URL.createObjectURL(b), im = new Image(); im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 0); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); }; im.src = u; });
}

/* ---------- conversão de HTML do livro para HTML seguro ---------- */
const KEEP = new Set(['p','h1','h2','h3','h4','h5','h6','blockquote','ul','ol','li','dl','dt','dd','pre','code','table','thead','tbody','tfoot','tr','td','th','caption','figure','figcaption','hr','br','em','i','strong','b','u','s','sub','sup','small','cite','q','abbr','big']);
const AS_DIV = new Set(['div','section','article','aside','header','footer','main','nav','center','body','hgroup','address','details','summary','font']);
const DROP = new Set(['script','style','head','title','meta','link','noscript','iframe','object','embed','audio','video','form','input','button','select','textarea','math','template']);
const BLOCK = new Set(['p','h1','h2','h3','h4','h5','h6','blockquote','ul','ol','li','dl','dt','dd','pre','table','figure','hr','div','section','article','aside','header','footer','main','nav','center','body','hgroup','address','details','summary']);
const MIME = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml', bmp:'image/bmp' };

/* Converte um nó em HTML seguro. ctx: { path, imgs:Set, linkOf(href) } */
function convNode(node, ctx, pre){
  if (node.nodeType === 3){
    let t = node.data;
    if (!pre) t = t.replace(/[\s\u00ad]+/g, m => m.includes('\u00ad') && !/\s/.test(m) ? '' : ' ');
    return escH(t);
  }
  if (node.nodeType !== 1) return '';
  const tag = (node.localName || node.nodeName).toLowerCase().replace(/^.*:/, '');
  if (DROP.has(tag)) return '';
  if (tag === 'svg'){
    const im = node.querySelector('image');
    const href = im && (im.getAttribute('xlink:href') || im.getAttribute('href') || im.getAttributeNS('http://www.w3.org/1999/xlink', 'href'));
    return href ? imgTag(href, '', ctx) : '';
  }
  if (tag === 'img') return imgTag(node.getAttribute('src') || '', node.getAttribute('alt') || '', ctx);
  const inner = () => [...node.childNodes].map(c => convNode(c, ctx, pre || tag === 'pre')).join('');
  const id = node.getAttribute('id') || node.getAttribute('name');
  const anchor = id ? ` data-a="${escH(ctx.path + '#' + id)}"` : '';
  // nota de rodapé do EPUB3 (aside epub:type="footnote") vira bloco menor
  const etype = node.getAttribute('epub:type') || node.getAttributeNS?.('http://www.idpf.org/2007/ops', 'type') || '';
  if (tag === 'a'){
    const href = node.getAttribute('href') || node.getAttributeNS?.('http://www.w3.org/1999/xlink', 'href') || '';
    const body = inner();
    if (!href) return anchor ? `<span${anchor}>${body}</span>` : body;
    if (/^(https?:|mailto:)/i.test(href)) return `<a href="${escH(href)}" target="_blank" rel="noopener"${anchor}>${body}</a>`;
    return `<a data-href="${escH(ctx.linkOf(href))}"${anchor}${/noteref/.test(etype) ? ' class="noteref"' : ''}>${body}</a>`;
  }
  const cls = ((node.getAttribute('class') || '') + ' ' + (node.getAttribute('style') || '')).toLowerCase();
  let body = inner();
  // itálico e negrito feitos por classe (comum em EPUB gerado por editora)
  if (/ital|font-style:\s*italic|\bemph/.test(cls) && !/^(em|i)$/.test(tag)) body = `<em>${body}</em>`;
  if (/\bbold|font-weight:\s*(bold|[6-9]00)/.test(cls) && !/^(b|strong|h\d)$/.test(tag)) body = `<b>${body}</b>`;
  if (/small-?caps|versalete/.test(cls)) body = `<span class="sc">${body}</span>`;
  if (/footnote|endnote|rearnote/.test(etype) || /footnote|nota-?rodape/.test(cls)) return `<div class="fn"${anchor}>${body}</div>`;
  if (KEEP.has(tag)){
    if (tag === 'br' || tag === 'hr') return `<${tag}>`;
    const t = tag === 'big' ? 'span' : tag;
    const center = /text-align:\s*center|\bcenter|centr/.test(cls) && /^(p|h\d|div)$/.test(tag) ? ' class="ct"' : '';
    return `<${t}${anchor}${center}>${body}</${t}>`;
  }
  if (AS_DIV.has(tag)){
    const center = /text-align:\s*center|\bcenter|centr/.test(cls) ? ' class="ct"' : '';
    return BLOCK.has(tag) ? `<div${anchor}${center}>${body}</div>` : (anchor ? `<span${anchor}>${body}</span>` : body);
  }
  // span e qualquer marca desconhecida: fica só o conteúdo
  return anchor ? `<span${anchor}>${body}</span>` : body;
}
function imgTag(src, alt, ctx){
  if (!src || /^data:/.test(src) && src.length > 200000) return '';
  if (/^data:image\//.test(src)) return `<img src="${escH(src)}" alt="${escH(alt)}">`;
  if (/^https?:/i.test(src)) return '';
  const p = ctx.resolve(src.split('#')[0]);
  ctx.imgs.add(p);
  return `<img data-src="${escH(p)}" alt="${escH(alt)}">`;
}

/* Desce pelos invólucros (body > div > div…) até achar a lista real de
   blocos, para poder cortar livros de um arquivo só em várias seções. */
function topBlocks(root){
  let el = root;
  for (let i = 0; i < 6; i++){
    const kids = [...el.children].filter(k => !DROP.has(k.localName));
    const text = [...el.childNodes].some(n => n.nodeType === 3 && n.data.trim());
    if (kids.length === 1 && !text && AS_DIV.has(kids[0].localName) && !kids[0].getAttribute('id')) el = kids[0];
    else break;
  }
  const out = []; let loose = [];
  const flush = () => { if (loose.length){ out.push({ inline: loose }); loose = []; } };
  for (const n of el.childNodes){
    if (n.nodeType === 1 && BLOCK.has(n.localName) || n.nodeType === 1 && (n.localName === 'img' || n.localName === 'svg')){ flush(); out.push(n); }
    else if (n.nodeType === 3 && !n.data.trim()) continue;
    else loose.push(n);
  }
  flush();
  return { root: el, blocks: out };
}

/* Mede quantos caracteres de texto um trecho de HTML tem (o mesmo que
   o navegador terá nos nós de texto) e onde caem as âncoras. */
function measureHTML(html){
  const t = document.createElement('template');
  t.innerHTML = html;
  const anchors = {};
  let n = 0;
  const walk = node => {
    if (node.nodeType === 3){ n += node.data.length; return; }
    if (node.nodeType === 1 && node.dataset && node.dataset.a && !(node.dataset.a in anchors)) anchors[node.dataset.a] = n;
    for (const c of node.childNodes) walk(c);
  };
  walk(t.content);
  return { n, anchors };
}

/* Agrupa blocos em seções de no máximo `max` caracteres. */
function sectionize(units, max){
  const sections = [], lens = [], anchors = {};
  let cur = '', n = 0;
  const push = () => { if (cur){ sections.push(cur); lens.push(n); } cur = ''; n = 0; };
  for (const u of units){
    if (u.brk && n) push();
    else if (n && n + u.n > max && n > max * .35) push();
    const sIdx = sections.length;
    for (const [k, off] of Object.entries(u.anchors)) if (!(k in anchors)) anchors[k] = [sIdx, n + off];
    if (u.file && !(u.file in anchors)) anchors[u.file] = [sIdx, n];
    cur += u.html; n += u.n;
  }
  push();
  return { sections, lens, anchors };
}

/* ---------- EPUB ---------- */
async function parseEpub(file, onStep){
  await libReady('O leitor de EPUB', () => typeof JSZip !== 'undefined');
  let z;
  try { z = await JSZip.loadAsync(file); }
  catch (e) { throw new Error('o arquivo não é um EPUB válido (zip corrompido ou incompleto).'); }
  const lower = {};
  z.forEach((p, f) => { if (!f.dir) lower[p.toLowerCase()] = f; });
  const find = p => { if (!p) return null; let d = p; try { d = decodeURIComponent(p); } catch (e) {} return z.file(p) || z.file(d) || lower[p.toLowerCase()] || lower[d.toLowerCase()] || null; };
  const read = async p => { const f = find(p); return f ? f.async('string') : null; };
  const xml = s => {
    let d = new DOMParser().parseFromString(s, 'application/xml');
    if (d.getElementsByTagName('parsererror').length) d = new DOMParser().parseFromString(s, 'text/html');
    return d;
  };
  const tags = (d, name) => { const a = [...d.getElementsByTagNameNS('*', name)]; return a.length ? a : [...d.getElementsByTagName(name)].concat([...d.getElementsByTagName('dc:' + name)]); };
  const dirOf = p => p.includes('/') ? p.replace(/[^/]+$/, '') : '';
  const resolve = (href, dir) => { try { return decodeURIComponent(new URL(href, 'http://x/' + dir).pathname.slice(1)); } catch (e) { return dir + href; } };

  // DRM: conteúdo cifrado não dá para ler (fonte ofuscada não conta)
  const enc = await read('META-INF/encryption.xml');
  if (enc && /CipherReference/.test(enc)){
    const uris = [...enc.matchAll(/URI="([^"]+)"/g)].map(m => m[1]);
    if (uris.some(u => /\.(x?html?|xml)$/i.test(u))) throw new Error('este EPUB tem DRM (proteção de loja). Só dá para abrir EPUB sem proteção.');
  }
  // OPF: pelo container.xml ou, se faltar, o primeiro .opf do pacote
  let opfPath = null;
  const cont = await read('META-INF/container.xml');
  if (cont){ const rf = tags(xml(cont), 'rootfile')[0]; opfPath = rf && rf.getAttribute('full-path'); }
  if (!opfPath || !find(opfPath)) opfPath = Object.keys(lower).find(p => p.endsWith('.opf'));
  if (!opfPath) throw new Error('não achei o índice do livro (arquivo .opf). O EPUB pode estar incompleto.');
  opfPath = find(opfPath).name;
  const opf = xml(await read(opfPath)), base = dirOf(opfPath);

  const man = {}, items = tags(opf, 'item');
  items.forEach(i => { man[i.getAttribute('id')] = { href: resolve(i.getAttribute('href') || '', base), type: i.getAttribute('media-type') || '', props: i.getAttribute('properties') || '', id: i.getAttribute('id') || '' }; });
  const meta = n => { const e = tags(opf, n)[0]; return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
  let spine = tags(opf, 'itemref').map(r => man[r.getAttribute('idref')]).filter(Boolean);
  if (!spine.length) spine = Object.values(man).filter(m => /html/.test(m.type) || /\.x?html?$/i.test(m.href));
  spine = spine.filter(m => !/image\//.test(m.type));

  // sumário: nav (EPUB3) ou NCX (EPUB2)
  const toc = [];
  try {
    const navIt = Object.values(man).find(m => /\bnav\b/.test(m.props));
    if (navIt){
      const nd = new DOMParser().parseFromString(await read(navIt.href) || '', 'text/html');
      const navs = [...nd.querySelectorAll('nav')];
      const nav = navs.find(n => /toc/.test(n.getAttribute('epub:type') || '')) || navs[0];
      if (nav) nav.querySelectorAll('a[href]').forEach(a => {
        const [p, f] = a.getAttribute('href').split('#'); const k = resolve(p, dirOf(navIt.href)) + (f ? '#' + f : '');
        let depth = -1, up = a; while ((up = up.parentElement) && up !== nav) if (/^(ol|ul)$/i.test(up.localName)) depth++;
        toc.push({ l: a.textContent.replace(/\s+/g, ' ').trim(), k, d: depth });
      });
    }
    if (!toc.length){
      const tid = tags(opf, 'spine')[0]?.getAttribute('toc');
      const ncx = (tid && man[tid]) || Object.values(man).find(m => /ncx/.test(m.type) || /\.ncx$/i.test(m.href));
      if (ncx){
        const tx = xml(await read(ncx.href) || '');
        tags(tx, 'navPoint').forEach(n => {
          const c = [...n.children].find(x => /content$/i.test(x.localName || x.nodeName)), l = [...n.children].find(x => /navLabel$/i.test(x.localName || x.nodeName));
          if (!c || !l) return;
          const [p, f] = (c.getAttribute('src') || '').split('#'); let d = 0, up = n.parentElement;
          while (up && /navPoint$/i.test(up.localName || up.nodeName)){ d++; up = up.parentElement; }
          toc.push({ l: l.textContent.replace(/\s+/g, ' ').trim(), k: resolve(p, dirOf(ncx.href)) + (f ? '#' + f : ''), d });
        });
      }
    }
  } catch (e) {}

  // capa
  let cover = null;
  try {
    const cm = tags(opf, 'meta').find(m => m.getAttribute('name') === 'cover');
    let ci = Object.values(man).find(m => /cover-image/.test(m.props)) || (cm && man[cm.getAttribute('content')]);
    if (!ci || !/image\//.test(ci.type)) ci = Object.values(man).find(m => /image\//.test(m.type) && /cover|capa/i.test(m.id + m.href));
    if (ci && find(ci.href)){
      const bl = new Blob([await find(ci.href).async('blob')], { type: ci.type || MIME[ci.href.split('.').pop().toLowerCase()] || 'image/jpeg' });
      cover = await smallCover(await blobToImg(bl));
    }
  } catch (e) { cover = null; }

  // conteúdo
  const max = FRACO ? 9000 : 15000;
  const units = [], imgs = new Set();
  for (let i = 0; i < spine.length; i++){
    onStep && onStep(i + 1, spine.length);
    const it = spine[i];
    const src = await read(it.href);
    if (!src) continue;
    let d = new DOMParser().parseFromString(src, /xhtml|xml/.test(it.type) || /\.xhtml$/i.test(it.href) ? 'application/xhtml+xml' : 'text/html');
    if (d.getElementsByTagName('parsererror').length || !d.body && !d.getElementsByTagNameNS('*', 'body')[0]) d = new DOMParser().parseFromString(src, 'text/html');
    const body = d.body || d.getElementsByTagNameNS('*', 'body')[0];
    if (!body) continue;
    const ctx = {
      path: it.href, imgs,
      resolve: href => resolve(href, dirOf(it.href)),
      linkOf: href => { const [p, f] = href.split('#'); return (p ? resolve(p, dirOf(it.href)) : it.href) + (f ? '#' + f : ''); },
    };
    const { root, blocks } = topBlocks(body);
    const fileUnits = [];
    const rootId = root !== body && root.getAttribute('id');
    for (const b of blocks){
      const html = b.inline ? (() => { const s = b.inline.map(n => convNode(n, ctx)).join('').trim(); return s ? `<p>${s}</p>` : ''; })() : convNode(b, ctx);
      if (!html || !html.replace(/<(?!img)[^>]+>/g, '').trim()) continue;
      const m = measureHTML(html);
      fileUnits.push({ html, n: m.n, anchors: m.anchors });
    }
    if (!fileUnits.length) continue;
    fileUnits[0].brk = true;
    fileUnits[0].file = it.href;
    if (rootId) fileUnits[0].anchors[it.href + '#' + rootId] = 0;
    units.push(...fileUnits);
  }
  if (!units.length) throw new Error('não encontrei texto neste EPUB.');
  const S = sectionize(units, max);

  // sumário com posição: seção e caractere
  const tocOut = [];
  for (const t of toc){
    const a = S.anchors[t.k] || S.anchors[t.k.split('#')[0]];
    if (a && t.l) tocOut.push({ l: t.l.slice(0, 120), s: a[0], c: a[1], d: Math.min(3, t.d || 0) });
  }
  if (!tocOut.length) S.sections.forEach((html, i) => { const m = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/.exec(html); if (m) tocOut.push({ l: clip(m[1].replace(/<[^>]+>/g, ''), 100), s: i, c: 0, d: 0 }); });

  // imagens usadas
  const imgMap = {};
  for (const p of imgs){
    const f = find(p);
    if (!f) continue;
    try { imgMap[p] = new Blob([await f.async('blob')], { type: MIME[p.split('.').pop().toLowerCase()] || 'image/jpeg' }); } catch (e) {}
  }
  if (!cover && imgs.size){ try { cover = await smallCover(await blobToImg(imgMap[[...imgs][0]])); } catch (e) {} }

  return {
    type: 'EPUB', title: meta('title'), author: meta('creator'), cover,
    content: { v: PARSER_V, sections: S.sections, lens: S.lens, anchors: S.anchors, imgs: imgMap },
    toc: tocOut, chars: S.lens.reduce((a, b) => a + b, 0),
  };
}

/* ---------- TXT ---------- */
const HEAD_RE = /^(cap[ií]tulo|parte|livro|pr[oó]logo|ep[ií]logo|pref[aá]cio|introdu[cç][aã]o|chapter|part|prologue|epilogue)\b|^[IVXLC]{1,7}\.?$|^\d{1,3}\.?$/i;
async function parseTxt(file){
  const buf = await file.arrayBuffer();
  let t = new TextDecoder('utf-8').decode(buf);
  if (/\ufffd/.test(t)) t = new TextDecoder('windows-1252').decode(buf);   // arquivo antigo em Latin-1
  t = t.replace(/\r/g, '').replace(/^\uFEFF/, '');
  let parts = t.split(/\n\s*\n/);
  if (parts.length < 4) parts = t.split(/\n/);
  const units = parts.map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean).map((x, i) => {
    const hd = x.length < 70 && HEAD_RE.test(x);
    const html = hd ? `<h2>${escH(x)}</h2>` : `<p>${escH(x)}</p>`;
    return { html, n: x.length, anchors: hd ? { ['h' + i]: 0 } : {}, brk: hd };
  });
  if (!units.length) throw new Error('o arquivo está vazio.');
  const S = sectionize(units, FRACO ? 9000 : 15000);
  const toc = [];
  units.forEach((u, i) => { const a = S.anchors['h' + i]; if (a) toc.push({ l: u.html.replace(/<[^>]+>/g, ''), s: a[0], c: a[1], d: 0 }); });
  return { type: 'TXT', title: file.name.replace(/\.[^.]+$/, ''), author: '', cover: null,
    content: { v: PARSER_V, sections: S.sections, lens: S.lens, anchors: {}, imgs: {} }, toc, chars: S.lens.reduce((a, b) => a + b, 0) };
}

/* ---------- PDF: só lê capa, título e páginas ---------- */
let pdfReady = null;
function pdfLib(){
  return pdfReady ||= libReady('O leitor de PDF', () => typeof pdfjsLib !== 'undefined').then(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    return pdfjsLib;
  });
}
async function parsePdf(file){
  const lib = await pdfLib();
  let pdf;
  try { pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise; }
  catch (e) {
    if (e && e.name === 'PasswordException') throw new Error('o PDF tem senha.');
    throw new Error('o PDF parece corrompido (' + (e && e.message || 'erro') + ').');
  }
  let cover = null, title = '', author = '', toc = [];
  try {
    const pg = await pdf.getPage(1), vp = pg.getViewport({ scale: 1 }), sc = 220 / vp.width, v2 = pg.getViewport({ scale: sc });
    const cv = document.createElement('canvas'); cv.width = v2.width; cv.height = v2.height;
    await pg.render({ canvasContext: cv.getContext('2d'), viewport: v2 }).promise;
    cover = await smallCover(cv);
  } catch (e) {}
  try { const m = await pdf.getMetadata(); title = (m.info && m.info.Title) || ''; author = (m.info && m.info.Author) || ''; } catch (e) {}
  try { toc = await pdfOutline(pdf); } catch (e) {}
  const pages = pdf.numPages;
  pdf.destroy();
  title = String(title).trim();
  if (/^(untitled|sem t[ií]tulo|microsoft word|document\d*$|about:blank|https?:|file:|[\w-]+\.(docx?|odt|pdf|indd|tex|html?)$)/i.test(title) || title.length < 2) title = '';
  if (/^(unknown|desconhecido|user|admin|administrador)$/i.test(author.trim())) author = '';
  return { type: 'PDF', title, author, cover, pages, toc, content: null };
}
async function pdfOutline(pdf){
  const ol = await pdf.getOutline(), out = [];
  const walk = async (items, d) => {
    for (const o of items || []){
      if (out.length > 300) return;
      try {
        const dst = typeof o.dest === 'string' ? await pdf.getDestination(o.dest) : o.dest;
        if (dst && dst[0]) out.push({ l: o.title, p: (typeof dst[0] === 'object' ? await pdf.getPageIndex(dst[0]) : dst[0]) + 1, d: Math.min(3, d) });
      } catch (e) {}
      if (o.items && o.items.length && d < 2) await walk(o.items, d + 1);
    }
  };
  await walk(ol, 0);
  return out;
}

/* ---------- importação ---------- */
async function importBook(file, onStep){
  const kind = await sniff(file);
  if (kind === 'MOBI') throw new Error('MOBI/AZW (Kindle) não abre aqui. Converta para EPUB no Calibre.');
  if (kind === 'DOC') throw new Error('documento do Word: salve como PDF ou EPUB.');
  const id = await fingerprint(file);
  let r;
  if (kind === 'PDF') r = await parsePdf(file);
  else if (kind === 'ZIP') r = await parseEpub(file, onStep);
  else {
    const head = new Uint8Array(await file.slice(0, 2000).arrayBuffer());
    if (head.some(b => b === 0)) throw new Error('formato não reconhecido. Use EPUB, PDF ou TXT.');
    r = await parseTxt(file);
  }
  const old = E.books[id] && !E.books[id].del ? E.books[id] : null;
  const book = {
    ...(old || {}),
    id, type: r.type,
    title: (old && old.title) || r.title || file.name.replace(/\.[^.]+$/, ''),
    author: (old && old.author) || r.author || '',
    cover: r.cover || (old && old.cover) || null,
    toc: r.toc, chars: r.chars || 0, pages: r.pages || 0,
    added: (old && old.added) || Date.now(), last: (old && old.last) || 0,
    pos: (old && old.pos) || null, pct: (old && old.pct) || 0,
    file: file.name, size: file.size,
  };
  if (r.type === 'PDF') await DB.set('arq:' + id, file);
  else await DB.set('cont:' + id, r.content);
  putI('books', book);
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  return { book, was: !!old };
}

/* ---------- livros do INK (mesmo endereço: cesteduardo.github.io) ---------- */
function inkOpen(){
  return new Promise(res => {
    try {
      if (indexedDB.databases) indexedDB.databases().then(l => { if (!l.some(d => d.name === 'ink')) res(null); else open_(); }).catch(open_);
      else open_();
    } catch (e) { res(null); }
    function open_(){
      const q = indexedDB.open('ink');
      q.onupgradeneeded = () => { q.transaction.abort(); res(null); };
      q.onsuccess = () => res(q.result.objectStoreNames.contains('s') ? q.result : null);
      q.onerror = () => res(null);
    }
  });
}
async function inkList(){
  const db = await inkOpen();
  if (!db) return [];
  return new Promise(res => {
    const t = db.transaction('s', 'readonly'), q = t.objectStore('s').getAll(IDBKeyRange.bound('m:', 'm:\uffff'));
    q.onsuccess = () => res((q.result || []).map(m => ({ ...m, _db: db })));
    q.onerror = () => res([]);
  });
}
async function inkImport(m){
  const db = m._db, key = m.id.slice(2);
  const body = await new Promise(res => { const q = db.transaction('s', 'readonly').objectStore('s').get('b:' + key); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
  if (!body || !body.sections) return false;
  const id = 'ink' + key;
  if (getI('books', id)) return false;
  await DB.set('cont:' + id, { v: PARSER_V, sections: body.sections, lens: m.lens, anchors: {}, imgs: {} });
  putI('books', { id, type: m.type === 'PDF' ? 'TXT' : m.type, title: m.title, author: m.author, cover: m.cover, toc: (m.toc || []).map(t => ({ l: t.l, s: t.s, c: t.c, d: 0 })),
    chars: m.chars, pages: 0, added: m.added || Date.now(), last: m.last || 0, pos: { s: m.sec || 0, c: m.c || 0 }, pct: m.chars ? (m.done || 0) / m.chars : 0, fromInk: true });
  return true;
}
