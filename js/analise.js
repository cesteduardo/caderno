/* =====================================================================
   Análise da aula (porte do Caderno Inteligente, sem servidor)
   ---------------------------------------------------------------------
   costurar/revisar  emenda os trechos do Whisper e tira muletas de fala
   referencias       autores, obras e conceitos do dicionário literário
                     (variante conhecida = confirmada; parecida = "possivelmente")
   ficha             resumo extrativo e perguntas de revisão
   Tudo local e extrativo: seleciona o que foi dito, não inventa nada.
   ===================================================================== */
'use strict';

/* ---------- texto corrido ---------- */
const FUNCIONAIS = new Set('e mas que porque então de da do das dos para por com sem em no na nos nas o a os as um uma uns umas se ao aos à às quando como onde isso isto ele ela eles elas eu você vocês não já também mais muito muita tem têm é são foi era eram vai vão ter seu sua seus suas esse essa este esta aquele aquela só até sobre entre depois antes aqui ali lá assim aí ou nem pois logo enquanto cada todo toda todos todas'.split(' '));
const NUNCA_INICIA = new Set('do da de dos das no na nos nas ao aos à às com por pelo pela pelos pelas para em que porque cujo cuja num numa dum duma sobre entre'.split(' '));
const termina = t => /[.!?]$/.test(t.trimEnd());

function costurar(segs){
  const partes = [];
  for (const bruto of segs){
    let t = String(bruto || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    let fechou = !partes.length || termina(partes[partes.length - 1]);
    const prim = t.split(' ')[0].replace(/[.,;:!?]/g, '').toLowerCase();
    if (fechou && partes.length && NUNCA_INICIA.has(prim)){ partes[partes.length - 1] = partes[partes.length - 1].trimEnd().replace(/\.$/, ''); fechou = false; }
    if (!fechou){
      partes[partes.length - 1] = partes[partes.length - 1].trimEnd().replace(/…$/, '').trimEnd();
      t = t.replace(/^…/, '').trimStart();
      const [p, ...resto] = t.split(' ');
      if (FUNCIONAIS.has(p.toLowerCase()) || NUNCA_INICIA.has(p.toLowerCase())) t = [p.toLowerCase(), ...resto].join(' ');
    }
    if (t) partes.push(t);
  }
  return partes.join(' ');
}
const rep3 = (t, re, s) => { for (let i = 0; i < 3; i++){ const n = t.replace(re, s); if (n === t) break; t = n; } return t; };
function revisar(texto){
  if (!texto.trim()) return '';
  let t = texto;
  t = rep3(t, /\b([\wÀ-ÿ]+)(\s+\1\b)+/giu, '$1');
  t = rep3(t, /\b([\wÀ-ÿ]+\s+[\wÀ-ÿ]+)\s+\1\b/giu, '$1');
  t = rep3(t, /,\s*(?:né|ne|tá|ta|pronto|enfim|assim|tipo|digamos|sabe|entende|entendeu|olha|veja|quer\s+dizer|por\s+assim\s+dizer|vamos\s+dizer)\s*,/giu, ', ');
  t = t.replace(/[\s,]+(?:né|ne|tá|ta|certo|entendeu|entenderam|sacou|sacaram|beleza|não\s+é|ok)\s*(?=[.?!]|$)/giu, '');
  t = rep3(t, /(^|[.!?]\s)(?:então|aí|pronto|olha(?:\s+só)?|bom|bem|enfim|e\s+aí|gente|pessoal|beleza)[,\s]+(?=[a-zà-ú])/giu, '$1');
  t = t.replace(/\s+([,.;:!?])/g, '$1').replace(/([,;:])(?=\S)/g, '$1 ').replace(/\.{3,}/g, '…').replace(/,\s*,+/g, ',').replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/(^|[.!?]\s+)([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase());
  return t;
}
function paragrafos(segs, n = 4){
  const t = revisar(costurar(segs));
  if (!t) return [];
  const fr = t.split(/(?<=[.!?])\s+/).filter(f => f.trim());
  const out = [];
  for (let i = 0; i < fr.length; i += n) out.push(fr.slice(i, i + n).join(' '));
  return out;
}

/* ---------- referências ---------- */
const achatar = s => stripAcc(s).replace(/[^\p{L}\p{N}_\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const normaliza = s => achatar(s).toLowerCase();
let DIC = null;
async function dicionario(){
  if (DIC) return DIC;
  let base = [];
  try { base = await (await fetch('data/dicionario.json')).json(); } catch (e) {}
  const vars = [];
  const add = (t, c, txt, x, cap) => { const n = normaliza(txt); if (n) vars.push({ t, c, n, x, w: n.split(' ').length, cap }); };
  for (const e of base){
    add(e.t, e.c, e.c, e.x, e.t === 'author' || e.t === 'work');
    for (const v of e.v) add(e.t, e.c, v, e.x, false);
    for (const v of e.k) add(e.t, e.c, v, e.x, true);
  }
  for (const [v, c] of Object.entries(E.prefs.correcoes || {})) add(c.t, c.c, v, null, false);
  vars.sort((a, b) => b.w - a.w);
  const pool = base.filter(e => e.t !== 'concept').map(e => { const n = normaliza(e.c); return { t: e.t, c: e.c, alvos: [...new Set(e.t === 'author' ? [n, n.split(' ').pop()] : [n])] }; });
  const workAuthor = Object.fromEntries(base.filter(e => e.t === 'work').map(e => [e.c, e.x]));
  return DIC = { vars, pool, workAuthor };
}
const ATONAS = new Set('o a os as um uma de da do das dos e em no na nos nas que se por para com sobre'.split(' '));
function comMaiuscula(padded, alinhado, needle){
  if (alinhado == null) return false;
  let i = padded.indexOf(needle);
  while (i !== -1){
    const pal = alinhado.slice(i + 1, i + needle.length - 1).split(' ').filter(Boolean);
    const plenas = pal.filter(p => !ATONAS.has(p.toLowerCase()));
    if ((plenas.length ? plenas : pal).every(p => p[0] && p[0] !== p[0].toLowerCase())) return true;
    i = padded.indexOf(needle, i + 1);
  }
  return false;
}
/* similaridade (0 a 1) pela distância de edição */
function parecido(a, b){
  if (Math.abs(a.length - b.length) > Math.max(a.length, b.length) * .25) return 0;
  const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++){
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}
async function referencias(segs){
  const D = await dicionario();
  const found = new Map();
  const reg = (t, c, ok, raw, ms, text) => {
    const k = t + '|' + c, r = found.get(k), occ = { ms, text };
    if (!r) found.set(k, { t, c, ok, raw, ms, n: 1, occ: [occ] });
    else { r.n++; if (r.occ.length < 20) r.occ.push(occ); r.ms = Math.min(r.ms, ms); if (ok && !r.ok){ r.ok = true; r.raw = raw; } }
  };
  for (const s of segs){
    const bruto = achatar(s.text), low = bruto.toLowerCase();
    if (!low) continue;
    const padded = ' ' + low + ' ', alinhado = bruto.length === low.length ? ' ' + bruto + ' ' : null;
    for (const v of D.vars){
      const needle = ' ' + v.n + ' ';
      if (!padded.includes(needle)) continue;
      if (v.cap && !comMaiuscula(padded, alinhado, needle)) continue;
      reg(v.t, v.c, true, v.n, s.ms, s.text.trim());
    }
  }
  // parecidos: nomes com maiúscula que não casaram com nada
  const memo = new Map();
  let k0 = 0;
  for (const s of segs){
    if (++k0 % 60 === 0) await new Promise(r => setTimeout(r));
    const cands = new Set([...(s.text.match(/(?:[A-ZÀ-Ý][\wÀ-ÿ'’-]+\s+){0,2}[A-ZÀ-Ý][\wÀ-ÿ'’-]+/g) || []), ...(s.text.match(/[A-ZÀ-Ý][\wÀ-ÿ'’-]+/g) || [])]);
    for (const cand of cands){
      const cn = normaliza(cand);
      if (cn.length < 5) continue;
      let best = .82, hit = null;
      if (memo.has(cn)) [best, hit] = memo.get(cn);
      else {
        for (const p of D.pool) for (const a of p.alvos){ if (a[0] !== cn[0] && a[1] !== cn[1]) continue; const r = parecido(cn, a); if (r > best){ best = r; hit = p; } }
        memo.set(cn, [best, hit]);
      }
      if (hit && best < 1){
        const k = hit.t + '|' + hit.c;
        if (found.has(k) && found.get(k).ok) continue;
        reg(hit.t, hit.c, false, cand.trim(), s.ms, s.text.trim());
      }
    }
  }
  const refs = [...found.values()];
  refs.sort((a, b) => (b.ok - a.ok) || (b.n - a.n) || (a.ms - b.ms));
  for (const r of refs) if (r.t === 'work') r.x = D.workAuthor[r.c] || null;
  return refs;
}

/* ---------- ficha: resumo e perguntas ---------- */
const STOP = new Set('a o e de da do das dos que em um uma uns umas para por com sem no na nos nas se ao aos as os mais mas como quando onde porque então isso este esta esse essa aquele aquela ele ela eles elas eu você vocês nós sua seu suas seus muito muita também já não sim é são foi era ser está estava há ter tem tinha vai aqui ali lá bem só ou entre sobre até cada todo toda todos todas outro outra pela pelo num numa aí assim coisa gente vamos acho certo tipo né olha veja porém'.split(' ').map(normaliza));
const ABERTURA = /^(?:e\s+)?(?:então|entao|aí|ai|pronto|olha(?:\s+só)?|bom|bem|enfim|mas|e|agora|daí|dai|vejam?(?:\s+bem)?|olhem|reparem|quer\s+dizer|ou\s+seja|tipo(?:\s+assim)?|no\s+caso|beleza|certo|gente|pessoal)\b[\s,:-]+/iu;
const FECHO = /[\s,]*\b(?:né|ne|tá|ta|certo|entendeu|entenderam|sacou|sacaram|ok|tá\s+bom|ta\s+bom|beleza|não\s+é|nao\s+e)\b[\s.?!,]*$/iu;
const LOGISTICA = /\b(?:zoom|telegram|whatsapp|youtube|live|transmiss[ãa]o|grava(?:ndo|ção|cao)|link|canal|site|plataforma|navegador|microfone|c[âa]mera|[áa]udio|chat|boa\s+noite|bom\s+dia|boa\s+tarde|semana\s+que\s+vem|aula\s+passada|pr[óo]xima\s+aula|matr[íi]cula|inscri(?:ção|cao|ções|coes)|mensalidade|turma\s+nova|novos\s+alunos|lista\s+de\s+presen[çc]a|dever\s+de\s+casa|me\s+ouvem|est[ãa]o\s+me\s+ouvindo|tá\s+gravando)\b/iu;
const EXPLICA = /\b(?:significa|quer\s+dizer|ou\s+seja|consiste|trata-se|chama-se|se\s+chama|define|definição|é\s+justamente|isto\s+é|por\s+isso|portanto|no\s+fundo|a\s+diferença|diferente\s+de|ao\s+contr[áa]rio|depende|resulta|permite|exige)\b/iu;
const VAGOS = new Set('fazer fazendo falar falando falou dizer dizendo disse achar achando ficar ficando ficou pegar botar colocar chegar passar querer quero quer consegue conseguir sabe saber sabendo entender entendendo pessoa pessoas negocio coisas jeito maneira exemplo caso questao ponto parte vezes hora momento'.split(' '));
const SEGUNDA = /\b(?:voc[êe]s?|a\s+gente|vamos|olhem|vejam|reparem|percebem|lembram)\b/giu;
const PRIMEIRA = /\b(?:eu|meu|minha|comigo|pra\s+mim|para\s+mim|me\s+lembro|esqueci)\b/giu;
const conteudo = t => normaliza(t).split(' ').filter(w => w.length > 3 && !STOP.has(w));

function limpar(s){
  let t = s.trim();
  for (let i = 0; i < 3; i++){ const n = t.replace(ABERTURA, ''); if (n === t) break; t = n.trimStart(); }
  for (let i = 0; i < 2; i++){ const n = t.replace(FECHO, ''); if (n === t) break; t = n.trimEnd(); }
  t = t.replace(/^[\s,;:-]+|[\s,;:-]+$/g, '');
  if (!t) return '';
  t = t[0].toUpperCase() + t.slice(1);
  return /[.?!]$/.test(t) ? t : t + '.';
}
async function ficha(lesson){
  const segs = lesson.segs || [];
  const refs = await referencias(segs);
  const texto = revisar(costurar(segs.map(s => s.text)));
  const brutas = texto.split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(Boolean);
  const cands = [];
  brutas.forEach((s, idx) => {
    const l = limpar(s), pal = l.split(' '), c = new Set(conteudo(l));
    if (pal.length < 8 || pal.length > 45 || c.size < 4 || LOGISTICA.test(l)) return;
    if (/\?$/.test(l) && pal.length < 12) return;
    if (c.size / pal.length < .25) return;
    if ([...c].filter(w => !VAGOS.has(w)).length < 3) return;
    cands.push({ idx, l, c });
  });
  const freq = new Map(); for (const w of conteudo(texto)) freq.set(w, (freq.get(w) || 0) + 1);
  const df = new Map(); for (const k of cands) for (const w of k.c) df.set(w, (df.get(w) || 0) + 1);
  const peso = w => df.get(w) ? Math.log(1 + (freq.get(w) || 0)) * Math.log(1 + cands.length / df.get(w)) : 0;
  const refT = refs.filter(r => r.ok).map(r => normaliza(r.c));
  const temaT = new Set(conteudo(lesson.theme || ''));
  for (const k of cands){
    let v = [...k.c].reduce((a, w) => a + peso(w), 0) / Math.sqrt(k.c.size);
    const nl = normaliza(k.l);
    if (refT.some(t => t && nl.includes(t))) v *= 1.8;
    const np = k.l.split(' ').slice(1).filter(w => w[0] && w[0] !== w[0].toLowerCase() && w.length > 2).length;
    if (np) v *= 1 + Math.min(.4, .2 * np);
    if ([...k.c].some(w => temaT.has(w))) v *= 1.3;
    if (EXPLICA.test(k.l)) v *= 1.25;
    const pal = k.l.split(' ').length;
    v *= Math.max(.45, 1 - 3.5 * ((k.l.match(SEGUNDA) || []).length / pal));
    v *= Math.max(.5, 1 - 3 * ((k.l.match(PRIMEIRA) || []).length / pal));
    const vg = [...k.c].filter(w => VAGOS.has(w)).length; if (vg) v *= Math.max(.6, 1 - .15 * vg);
    k.v = v;
  }
  let summary = 'Não houve transcrição suficiente para gerar um resumo.', escolhidas = [];
  if (cands.length){
    const blocos = Math.max(5, Math.min(12, Math.floor(cands.length / 10)));
    const tam = Math.ceil(cands.length / blocos), cob = new Set();
    for (let i = 0; i < cands.length; i += tam){
      let best = null, bv = -1;
      for (const k of cands.slice(i, i + tam)){ const repet = [...k.c].filter(w => cob.has(w)).length / k.c.size; const v = k.v * (1 - .85 * repet); if (v > bv){ bv = v; best = k; } }
      if (best){ escolhidas.push(best); best.c.forEach(w => cob.add(w)); }
    }
    escolhidas.sort((a, b) => a.idx - b.idx);
    const fr = escolhidas.map(k => clip(k.l, 260));
    const ps = []; for (let i = 0; i < fr.length; i += 3) ps.push(fr.slice(i, i + 3).join(' '));
    summary = ps.join('\n\n');
  }
  const top = [...cands].sort((a, b) => b.v - a.v).slice(0, 6).sort((a, b) => a.idx - b.idx).map(k => clip(k.l, 220));
  return { refs, summary, keyPoints: top, questions: perguntas(refs, lesson.theme, escolhidas.length), oneLiner: escolhidas[0] ? clip(escolhidas[0].l, 140) : '' };
}
function perguntas(refs, tema, temResumo){
  const q = [];
  const au = refs.filter(r => r.t === 'author' && r.ok).map(r => r.c), ob = refs.filter(r => r.t === 'work' && r.ok), co = refs.filter(r => r.t === 'concept' && r.ok).map(r => r.c);
  if (tema && tema.trim()){
    const t = tema.replace(/\s+/g, ' ').trim();
    const pq = t.split(/(?<=[.?!])\s+/).find(p => /\?$/.test(p) && p.split(' ').length >= 3);
    const as = t.split(/(?<=[.?!])\s+/)[0].replace(/\.$/, '');
    q.push(pq ? pq[0].toUpperCase() + pq.slice(1) : as.length > 80 ? 'Qual é a ideia central desta aula?' : `Qual é a ideia central da aula sobre ${as}?`);
  }
  for (const c of co.slice(0, 3)) q.push(`O que é ${c.toLowerCase()} e como a aula o explicou?`);
  for (const a of au.slice(0, 2)) q.push(`Qual é a contribuição de ${a} discutida na aula?`);
  if (ob.length) q.push(`O que a aula destacou em ${ob[0].c}${ob[0].x ? ` (de ${ob[0].x})` : ''}?`);
  if (au.length && co.length) q.push(`Como ${au[0]} se relaciona com o conceito de ${co[0].toLowerCase()}?`);
  if (q.length < 3 && temResumo) q.push('Reescreva com suas palavras o ponto mais importante da aula.');
  return [...new Set(q)].slice(0, 8);
}
