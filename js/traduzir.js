/* =====================================================================
   Traduzir
   ---------------------------------------------------------------------
   1. No aparelho: o tradutor embutido do Chrome (Translator API), que
      baixa o par de idiomas uma vez e depois funciona sem internet.
   2. Online, se permitido nos Ajustes: o Google Tradutor (o trecho
      sai do aparelho) e, se ele falhar, o MyMemory.
   O idioma de origem é adivinhado pelas palavras mais comuns; o online
   também detecta sozinho. Traduções ficam em memória enquanto o app
   está aberto, para não pedir duas vezes a mesma coisa.
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

/* Google (o mesmo endereço da extensão do Chrome): vários trechos por pedido */
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
async function translateMany(texts, to = RS.trTo || 'pt-BR', hint){
  texts = texts.map(t => String(t || ''));
  const joined = texts.join(' ').slice(0, 4000);
  const from = hint || guessLang(joined);
  if (from && baseLang(from) === baseLang(to)) return { out: texts, from, via: 'mesma' };
  const miss = [], idx = [];
  const out = texts.map((t, i) => { const c = TR.cache.get(to + '|' + t); if (c != null) return c; miss.push(t); idx.push(i); return null; });
  let via = 'memória', det = from;
  if (miss.length){
    let got = await trDevice(miss, from, to);
    via = 'no aparelho';
    if (!got){
      if (!RS.trOnline) throw new Error('Este navegador não traduz sem internet. Ligue a tradução online nos Ajustes (Aa).');
      try { const g = await trGoogle(miss, null, to); got = g.out; det = g.detected || from; via = 'Google Tradutor'; }
      catch (e) { got = await trMyMemory(miss, from, to); via = 'MyMemory'; }
    }
    got.forEach((t, j) => { out[idx[j]] = t; TR.cache.set(to + '|' + miss[j], t); });
  }
  return { out, from: det, via };
}
async function translateOne(text, to){ const r = await translateMany([text], to); return { text: r.out[0], from: r.from, via: r.via }; }

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
  const body = h('div', { class: 'trc' },
    h('div', { class: 'trc-head' },
      h('span', { class: 'trc-lang', text: 'Traduzindo…' }),
      h('button', { class: 'x', type: 'button', 'aria-label': 'Fechar', text: '×', onmousedown: e => e.preventDefault(), onclick: () => selbar.hide() })),
    h('p', { class: 'trc-out', text: '…' }),
    h('div', { class: 'trc-acts' }));
  selbar.card(opts.rect, body);
  translateOne(text, to).then(r => {
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
