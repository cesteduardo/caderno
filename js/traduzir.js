/* =====================================================================
   Traduzir
   ---------------------------------------------------------------------
   Na ordem:
   1. No aparelho, com o tradutor do Chrome (Translator API), quando o
      navegador tem e o par já está baixado: é o mais rápido.
   2. No aparelho, com o Bergamot (js/bergamot.mjs), o motor das
      traduções locais do Firefox: qualquer navegador, sem internet
      depois do primeiro download do par (uns 20 a 30 MB, uma vez).
      Cobre português, inglês, espanhol, francês, italiano, alemão,
      russo e outros; pares sem o inglês passam por ele.
   3. Online, só se permitido em Aa → Tradução, para o que nenhum modelo
      local cobre (latim, japonês, chinês): MyMemory, um servidor
      LibreTranslate seu, ou o Google Tradutor (endereço não oficial,
      que pode parar a qualquer momento; por isso não é o padrão).
   O idioma de origem sai do franc (n-gramas, MIT), com uma lista de
   palavras frequentes para o latim, que o franc não conhece. As
   traduções ficam em memória enquanto o app está aberto.
   ===================================================================== */
'use strict';

const TR_LANGS = [
  ['pt-BR', 'Português'], ['en', 'Inglês'], ['es', 'Espanhol'], ['fr', 'Francês'],
  ['it', 'Italiano'], ['de', 'Alemão'], ['la', 'Latim'], ['ru', 'Russo'], ['ja', 'Japonês'], ['zh', 'Chinês'],
];
const trLangName = c => (TR_LANGS.find(l => l[0] === c || l[0].split('-')[0] === String(c).split('-')[0]) || [c, String(c || '?').toUpperCase()])[1];
const TR = { cache: new Map(), dev: new Map() };

/* Palavras curtas e frequentes de cada língua: basta para um palpite */
const TR_STOP = {
  pt: 'que não uma para com dos das pelo pela você ele ela isso mas são também muito então está foi tem seu sua nos ao à não'.split(' '),
  en: 'the and of to in is that it was for with as his her on be at by this had not are but from they you which have were'.split(' '),
  es: 'que los las del por con una para pero sus fue muy como está hay más ella él también desde cuando todo esto'.split(' '),
  fr: 'les des une dans est que qui pas pour sur avec ses elle mais était sont aux cette nous vous comme tout'.split(' '),
  it: 'che non una per con del della gli sono come anche più nel alla questo era essere suo sua ma lui lei'.split(' '),
  de: 'der die das und ist nicht mit sich auf für ein eine dem den von zu war sie ich auch es wie aber'.split(' '),
  la: 'et in est non ad cum quod sed ut qui quae enim esse sunt atque etiam per autem nec ab'.split(' '),
};
function guessLang(text){
  const words = norm(text).match(/[a-z]+/g) || [];
  if (words.length < 2) return null;
  let best = null, top = 0;
  guessLang.sets ||= Object.fromEntries(Object.entries(TR_STOP).map(([k, v]) => [k, new Set(v.map(norm))]));
  for (const [lang, set] of Object.entries(guessLang.sets)){
    let n = 0; for (const w of words) if (set.has(w)) n++;
    if (n > top){ top = n; best = lang; }
  }
  return top ? best : null;
}
const baseLang = c => String(c || '').split('-')[0].toLowerCase();

/* franc: devolve ISO 639-3; aqui viram os códigos curtos do app */
const FRANC_PARA = { por: 'pt', eng: 'en', spa: 'es', fra: 'fr', ita: 'it', deu: 'de', rus: 'ru', ukr: 'uk', ces: 'cs', bul: 'bg', est: 'et', nld: 'nl', pol: 'pl', jpn: 'ja', cmn: 'zh' };
let francP = null;
const francLib = () => (francP ||= import(new URL('vendor/franc.min.mjs', document.baseURI).href).catch(e => { francP = null; throw e; }));
async function detectLang(text){
  const t = String(text || '').slice(0, 2000);
  const pal = guessLang(t);
  if (pal === 'la') return 'la';            // o franc não tem latim
  try {
    const { franc } = await francLib();
    const r = franc(t, { minLength: 8, only: Object.keys(FRANC_PARA) });
    if (r && r !== 'und') return FRANC_PARA[r];
  } catch (e) {}
  return pal;
}

/* No aparelho (Chrome 138+). Só usa o par que já está baixado; se o
   par ainda não existe no aparelho, começa a baixar em segundo plano e
   desta vez vai online. Devolve null se não der. */
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
async function trDevice(texts, from, to){
  if (!('Translator' in self) || !from) return null;
  const key = from + '>' + baseLang(to);
  try {
    let t = TR.dev.get(key);
    if (!t){
      const opt = { sourceLanguage: from, targetLanguage: baseLang(to) };
      const av = await withTimeout(Translator.availability(opt), 2500);
      if (av === 'available') t = await withTimeout(Translator.create(opt), 4000);
      else if (av === 'downloadable' && !TR.dl){
        TR.dl = 1;
        Translator.create(opt).then(x => TR.dev.set(key, x)).catch(() => {}).finally(() => { TR.dl = 0; });
      }
      if (!t) return null;
      TR.dev.set(key, t);
    }
    const out = [];
    for (const s of texts){
      const r = s.trim() ? await withTimeout(t.translate(s), 8000) : s;
      if (r == null) return null;
      out.push(r);
    }
    return out;
  } catch (e) { return null; }
}

/* Bergamot, no aparelho. Devolve null se o par não existir ou o modelo
   não puder baixar agora (sem internet na primeira vez). */
let bergP = null;
const berg = () => (bergP ||= import(new URL('js/bergamot.mjs', document.baseURI).href).then(m => {
  let mostrou = 0;
  m.aoBaixar((tipo) => {
    if (tipo === 'baixando' && !mostrou++) toast('Baixando o tradutor deste par de idiomas. É uma vez só; depois funciona sem internet.');
  });
  return m;
}).catch(e => { bergP = null; throw e; }));
async function trLocal(texts, from, to){
  if (!from || RS.trLocal === false) return null;
  const a = baseLang(from), b = baseLang(to);
  try {
    const m = await berg();
    if (!await m.cobre(a, b)) return null;
    return await m.traduz(texts, a, b);
  } catch (e) { return null; }
}

/* Claude (js/claude.mjs): só se escolhido em Aa → Tradução, com a chave
   de quem usa. Recebe o contexto (parágrafo em volta, livro, autor). */
let claudeP = null;
const claudeLib = () => (claudeP ||= import(new URL('js/claude.mjs', document.baseURI).href).catch(e => { claudeP = null; throw e; }));
const usaClaude = () => RS.trMotor === 'claude';
async function trClaude(texts, from, to, ctx){
  const m = await claudeLib();
  if (!m.chave()) throw new Error('Falta a chave da API do Claude em Aa → Tradução.');
  const b = typeof RD !== 'undefined' && RD.book;
  return m.traduz(texts, from, to, { livro: b && b.title, autor: b && b.author, ...(ctx || {}) });
}

/* LibreTranslate (código aberto, AGPL), no servidor que você indicar */
async function trLibre(texts, from, to){
  const base = String(RS.trLibre || '').replace(/\/+$/, '');
  if (!base) throw new Error('sem servidor LibreTranslate');
  const r = await fetch(base + '/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, source: from ? baseLang(from) : 'auto', target: baseLang(to), format: 'text', api_key: RS.trLibreKey || undefined }) });
  if (!r.ok) throw new Error('LibreTranslate ' + r.status);
  const d = await r.json();
  const out = Array.isArray(d.translatedText) ? d.translatedText : [d.translatedText];
  return { out, detected: d.detectedLanguage && (Array.isArray(d.detectedLanguage) ? d.detectedLanguage[0] : d.detectedLanguage).language };
}

/* Google (endereço não oficial, o da extensão do Chrome): só se escolhido */
async function trGoogle(texts, from, to){
  const out = new Array(texts.length);
  let detected = null;
  let i = 0;
  while (i < texts.length){
    const batch = [];
    let len = 0;
    while (i + batch.length < texts.length){
      const enc = encodeURIComponent(texts[i + batch.length]).length + 3;
      if (batch.length && len + enc > 6000) break;
      batch.push(i + batch.length); len += enc;
    }
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${from || 'auto'}&tl=${to}&` + batch.map(k => 'q=' + encodeURIComponent(texts[k])).join('&');
    const r = await fetch(url);
    if (!r.ok) throw new Error('google ' + r.status);
    const d = await r.json();
    const arr = Array.isArray(d) ? d : [d];
    batch.forEach((k, j) => {
      const it = arr[j];
      if (Array.isArray(it)){ out[k] = it[0]; detected ||= it[1]; }
      else out[k] = typeof it === 'string' ? it : texts[k];
    });
    i += batch.length;
  }
  return { out, detected };
}

/* MyMemory: um trecho por vez, até ~480 caracteres cada */
async function trMyMemory(texts, from, to){
  const out = [];
  for (const t of texts){
    const parts = t.match(/[^.!?;\n]{1,470}[.!?;\n]*|.{1,470}/gs) || [t];
    let acc = '';
    for (const p of parts){
      const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(p)}&langpair=${from || 'en'}|${to}`);
      const d = await r.json();
      acc += (d && d.responseData && d.responseData.translatedText) || p;
    }
    out.push(acc);
  }
  return out;
}

/* translateMany(['…', '…'], 'pt-BR') → { out, from, via } */
async function translateMany(texts, to = RS.trTo || 'pt-BR', hint, ctx){
  texts = texts.map(t => String(t || ''));
  const joined = texts.join(' ').slice(0, 4000);
  const from = hint || await detectLang(joined);
  if (from && baseLang(from) === baseLang(to)) return { out: texts, from, via: 'mesma' };
  const miss = [], idx = [];
  const motor = usaClaude() ? 'c|' : '';
  const out = texts.map((t, i) => { const c = TR.cache.get(motor + to + '|' + t); if (c != null) return c; miss.push(t); idx.push(i); return null; });
  let via = 'memória', det = from;
  if (miss.length){
    let got = null, aviso = '';
    if (usaClaude()){
      try { got = await trClaude(miss, from, baseLang(to), ctx); via = 'Claude'; }
      catch (e) { aviso = ' (o Claude falhou: ' + (e.status === 401 ? 'chave inválida' : e.status === 429 ? 'limite de uso' : e.message || e) + ')'; }
    }
    if (!got){ got = await trDevice(miss, from, to); via = 'no aparelho (Chrome)' + aviso; }
    if (!got){ got = await trLocal(miss, from, to); via = 'no aparelho (Bergamot)' + aviso; }
    if (!got){
      const online = trOnlineVia();
      if (!online) throw new Error(`Nenhum tradutor no aparelho cobre ${trLangName(from)} → ${trLangName(to)}. Para este par, ligue a tradução online em Aa → Tradução.`);
      if (online === 'libre'){ const g = await trLibre(miss, from, to); got = g.out; det = g.detected || from; via = 'LibreTranslate'; }
      else if (online === 'google'){
        try { const g = await trGoogle(miss, null, to); got = g.out; det = g.detected || from; via = 'Google Tradutor'; }
        catch (e) { got = await trMyMemory(miss, from, to); via = 'MyMemory'; }
      }
      else { got = await trMyMemory(miss, from, to); via = 'MyMemory'; }
    }
    got.forEach((t, j) => { out[idx[j]] = t; TR.cache.set(motor + to + '|' + miss[j], t); });
  }
  return { out, from: det, via };
}
/* Online: 'mymemory' (padrão), 'libre', 'google' ou desligado. Quem
   tinha "online quando precisar" ligado no tradutor antigo fica no MyMemory. */
function trOnlineVia(){
  if (RS.trVia === undefined) return RS.trOnline === false ? '' : 'mymemory';
  return RS.trVia || '';
}
async function translateOne(text, to, ctx){ const r = await translateMany([text], to, undefined, ctx); return { text: r.out[0], from: r.from, via: r.via }; }

/* Ler em voz alta (voz do sistema), para treinar a pronúncia */
function speak(text, lang){
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (lang) u.lang = lang === 'pt' ? 'pt-BR' : lang;
    u.rate = .95;
    speechSynthesis.speak(u);
  } catch (e) { toast('Este aparelho não tem voz para ler.'); }
}

/* Cartão de tradução na barra de seleção */
function translateCard(text, opts = {}){
  const to = RS.trTo || 'pt-BR';
  const fixo = () => !!RS.trcFixo;
  const pino = h('button', { class: 'trc-pino', type: 'button', title: 'Voltar a abrir junto do trecho', 'aria-label': 'Soltar a posição', text: 'Soltar',
    hidden: !fixo(), onmousedown: e => e.preventDefault(), onclick: () => { RS.trcFixo = null; saveRS(); pino.hidden = true; selbar.place(selbar.rect); } });
  const body = h('div', { class: 'trc' },
    h('div', { class: 'trc-head', title: 'Arraste para levar a tradução aonde for melhor' },
      h('span', { class: 'trc-alca', 'aria-hidden': 'true' }),
      h('span', { class: 'trc-lang', text: 'Traduzindo…' }),
      pino,
      h('button', { class: 'x', type: 'button', 'aria-label': 'Fechar', text: '×', onmousedown: e => e.preventDefault(), onclick: () => selbar.hide() })),
    h('p', { class: 'trc-out', text: '…' }),
    h('div', { class: 'trc-acts' }));
  selbar.card(opts.rect, body);
  /* Arrastar pelo topo: a tradução fica onde você a deixar, e as
     próximas abrem no mesmo lugar (até tocar em Soltar). */
  const cab = body.querySelector('.trc-head');
  cab.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    const el = selbar.el, r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    el.classList.add('arrastando');
    cab.setPointerCapture(e.pointerId);
    let pos = null;
    const mover = (ev) => {
      pos = { x: Math.max(8, Math.min(innerWidth - r.width - 8, ev.clientX - dx)), y: Math.max(8, Math.min(innerHeight - 80, ev.clientY - dy)) };
      el.style.transform = `translate(${Math.round(pos.x)}px,${Math.round(pos.y)}px)`;
    };
    const soltar = () => {
      cab.removeEventListener('pointermove', mover);
      el.classList.remove('arrastando');
      if (pos){ RS.trcFixo = pos; saveRS(); pino.hidden = false; }
    };
    cab.addEventListener('pointermove', mover);
    cab.addEventListener('pointerup', soltar, { once: true });
    cab.addEventListener('pointercancel', soltar, { once: true });
  });
  translateOne(text, to, opts.ctx).then(r => {
    if (!body.isConnected) return;
    body.querySelector('.trc-lang').textContent = r.via === 'mesma' ? `Já está em ${trLangName(to)}` : `${trLangName(r.from)} → ${trLangName(to)} · ${r.via}`;
    body.querySelector('.trc-out').textContent = r.text;
    const acts = body.querySelector('.trc-acts');
    const b = (label, fn) => h('button', { type: 'button', text: label, onmousedown: e => e.preventDefault(), onclick: fn });
    acts.replaceChildren(
      b('Ouvir', () => speak(text, r.from)),
      b('Copiar', () => { navigator.clipboard?.writeText(r.text); toast('Tradução copiada.'); }),
      opts.save ? b(opts.saved ? 'Atualizar na marcação' : 'Guardar na marcação', () => { opts.save(r.text); selbar.hide(); toast('Tradução guardada junto da marcação.'); }) : null,
      b('Cartão', () => { selbar.hide(); openCardEditor({ kind: 'qa', front: text, back: r.text, deck: 'Vocabulário', src: opts.src || null }); }));
    selbar.place(selbar.rect);
  }).catch(err => {
    if (!body.isConnected) return;
    body.querySelector('.trc-lang').textContent = 'Não deu para traduzir';
    body.querySelector('.trc-out').textContent = err.message && !/fetch|network/i.test(err.message) ? err.message : 'Sem internet, e este navegador não tem tradutor no aparelho.';
  });
}
