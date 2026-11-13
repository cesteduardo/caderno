/* =====================================================================
   Revisar: cartões e repetição espaçada
   ---------------------------------------------------------------------
   Dois tipos de cartão:
     cloze  trecho com lacunas: [[palavra]] ou [[palavra::dica]]
     qa     pergunta na frente, resposta atrás
   Agenda (SM-2 simplificado, por dia):
     novo / reaprendendo   De novo → volta na sessão; Bom → amanhã; Fácil → 4 dias
     em revisão            o intervalo cresce pela facilidade do cartão
   Cartão: { id, kind, text | front+back, deck, src, hint, due, ivl,
             ease, reps, lapses, first, last }
   ===================================================================== */
'use strict';

const NOVOS_DIA = () => (E.prefs.novosDia ?? 20);
const LEARN_MS = 20 * 60e3;               // o que volta em até 20 min fica na sessão
const isNew = c => !c.reps && !c.last;
const isDueCard = (c, now = Date.now()) => !isNew(c) && (c.due || 0) <= now;
const decks = () => [...new Set(live('cards').map(c => c.deck || 'Geral'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
const newToday = () => { const t0 = startOfDay(); return live('cards').filter(c => (c.first || 0) >= t0).length; };

/* ---------- agenda ---------- */
function schedule(c, g, now = Date.now()){
  // g: 1 de novo · 2 difícil · 3 bom · 4 fácil
  const o = { ease: c.ease || 2.5, ivl: c.ivl || 0, reps: c.reps || 0, lapses: c.lapses || 0 };
  const learning = o.ivl < 1;
  if (g === 1){
    if (!learning) o.lapses++;
    o.ivl = 0; o.reps = 0; o.ease = Math.max(1.3, o.ease - (learning ? 0 : .2));
    o.due = now + (learning ? 60e3 : 10 * 60e3);
  } else if (learning){
    o.reps++;
    if (g === 2){ o.ivl = 0; o.due = now + 6 * 60e3; o.ease = Math.max(1.3, o.ease - .15); }
    else { o.ivl = g === 4 ? 4 : 1; }
  } else {
    o.reps++;
    if (g === 2){ o.ivl = Math.max(o.ivl + 1, o.ivl * 1.2); o.ease = Math.max(1.3, o.ease - .15); }
    else if (g === 3) o.ivl = Math.max(o.ivl + 1, o.ivl * o.ease);
    else { o.ivl = Math.max(o.ivl + 2, o.ivl * o.ease * 1.3); o.ease += .15; }
  }
  if (o.ivl >= 1){
    o.ivl = Math.round(o.ivl);
    if (o.ivl > 4) o.ivl = Math.round(o.ivl * (.95 + Math.random() * .1));
    o.ivl = Math.min(o.ivl, 3650);
    o.due = startOfDay(now) + o.ivl * DAY_MS;
  }
  return o;
}
function ivlLabel(c, g){
  const o = schedule(c, g);
  const ms = o.due - Date.now();
  if (o.ivl < 1) return ms < 90e3 ? '1 min' : Math.round(ms / 60e3) + ' min';
  if (o.ivl < 30) return plural(o.ivl, 'dia', 'dias');
  if (o.ivl < 365) return Math.round(o.ivl / 30) + ' m';
  return (o.ivl / 365).toFixed(1).replace('.', ',') + ' a';
}

/* ---------- lacunas ---------- */
const CLOZE_RE = /\[\[([^\]]+?)(?:::([^\]]+?))?\]\]/g;
const hasCloze = t => /\[\[[^\]]+\]\]/.test(t || '');
function clozeEl(text, reveal){
  const out = h('p', { class: 'cz-text' });
  let last = 0;
  for (const m of String(text).matchAll(CLOZE_RE)){
    out.append(text.slice(last, m.index));
    out.append(reveal ? h('mark', { class: 'cz on', text: m[1] }) : h('span', { class: 'cz', text: m[2] ? `[${m[2]}]` : '[…]' }));
    last = m.index + m[0].length;
  }
  out.append(text.slice(last));
  return out;
}
const clozeAnswer = text => [...String(text).matchAll(CLOZE_RE)].map(m => m[1]).join(' · ');

/* Sugere lacunas: nomes próprios e as palavras mais longas e raras */
function suggestCloze(text){
  const words = [...text.matchAll(/[\p{L}][\p{L}'’-]{3,}/gu)];
  if (!words.length) return text;
  const common = STOP_PT;
  const score = m => {
    const w = m[0], low = norm(w);
    if (common.has(low)) return -1;
    const cap = m.index > 0 && /[^.!?]\s*$/.test(text.slice(Math.max(0, m.index - 3), m.index)) && w[0] !== w[0].toLowerCase();
    return w.length + (cap ? 8 : 0);
  };
  const n = Math.max(1, Math.min(3, Math.round(words.length / 12)));
  const pick = words.map(m => [m, score(m)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]).sort((a, b) => b.index - a.index);
  let t = text;
  for (const m of pick) t = t.slice(0, m.index) + '[[' + m[0] + ']]' + t.slice(m.index + m[0].length);
  return t;
}
const STOP_PT = new Set('que para com como mais mas pela pelo porque quando onde isso isto esse essa este esta aquele aquela também muito muita pois entre sobre depois antes ainda assim cada todo toda todos todas outro outra outros outras seus suas nossa nosso eles elas você vocês sempre nunca então apenas mesmo mesma qual quais seria fosse sendo tinha temos fazer feito porém desde'.split(' '));

/* ---------- editor de cartão ---------- */
function openCardEditor(init = {}){
  const card = init.id ? init : null;
  let kind = init.kind || 'cloze';
  const deckIn = h('input', { type: 'text', value: init.deck || E.prefs.lastDeck || 'Geral', list: 'deckList', 'aria-label': 'Baralho' });
  const dl = h('datalist', { id: 'deckList' }, decks().map(d => h('option', { value: d })));
  const txt = h('textarea', { class: 'note-ta', rows: 6, placeholder: 'Trecho. Selecione as palavras-chave e toque em Ocultar.' });
  txt.value = init.text || (kind === 'cloze' ? init.back || '' : '');
  const front = h('textarea', { class: 'note-ta', rows: 3, placeholder: 'Pergunta' });
  const back = h('textarea', { class: 'note-ta', rows: 5, placeholder: 'Resposta' });
  front.value = init.front || ''; back.value = init.back || (kind === 'qa' ? init.text || '' : '');
  const hint = h('input', { type: 'text', value: init.hint || '', placeholder: 'Comentário (aparece no verso, opcional)', 'aria-label': 'Comentário' });
  const hide = () => {
    const a = txt.selectionStart, b = txt.selectionEnd;
    if (a === b){ toast('Selecione uma palavra ou expressão no trecho.'); return; }
    const v = txt.value, sel = v.slice(a, b).trim();
    const lead = v.slice(a, b).match(/^\s*/)[0].length;
    txt.value = v.slice(0, a + lead) + '[[' + sel + ']]' + v.slice(a + lead + sel.length);
    txt.focus();
  };
  const czBox = h('div', { class: 'form cz-edit' },
    txt,
    h('div', { class: 'row-btns' },
      h('button', { class: 'btn small', type: 'button', text: 'Ocultar seleção', onmousedown: e => e.preventDefault(), onclick: hide }),
      h('button', { class: 'btn ghost small', type: 'button', text: 'Sugerir lacunas', onclick: () => { txt.value = suggestCloze(txt.value.replace(CLOZE_RE, '$1')); } }),
      h('button', { class: 'btn ghost small', type: 'button', text: 'Limpar', onclick: () => { txt.value = txt.value.replace(CLOZE_RE, '$1'); } })),
    h('p', { class: 'muted small', text: 'Cada [[trecho]] vira uma lacuna. Para dar uma pista: [[Machado de Assis::autor]].' }));
  const qaBox = h('div', { class: 'form' }, front, back);
  const body = h('div', { class: 'card-ed' });
  const paint = () => {
    body.replaceChildren(
      h('div', { class: 'seg' }, [['cloze', 'Lacunas'], ['qa', 'Pergunta e resposta']].map(([k, l]) => h('button', { type: 'button', class: k === kind ? 'on' : '', text: l, onclick: () => {
        if (k === kind) return;
        if (k === 'qa'){ back.value ||= txt.value.replace(CLOZE_RE, '$1'); }
        else { txt.value ||= back.value; }
        kind = k; paint();
      } }))),
      kind === 'cloze' ? czBox : qaBox,
      h('div', { class: 'form' }, h('label', {}, 'Baralho', deckIn, dl), hint),
      init.src && init.src.label ? h('p', { class: 'muted small', text: 'Origem: ' + init.src.label }) : null);
  };
  paint();
  modal(card ? 'Editar cartão' : 'Novo cartão', body, [
    card ? { label: 'Apagar', danger: true, onclick: async () => { if (await confirmBox('Apagar este cartão?')){ delI('cards', card.id); refreshStudy(); } } } : { label: 'Cancelar' },
    { label: 'Salvar', primary: true, onclick: () => {
      let t = txt.value.trim();
      if (kind === 'cloze'){
        if (!t) return false;
        if (!hasCloze(t)) t = suggestCloze(t);
        if (!hasCloze(t)){ toast('Oculte ao menos uma palavra.'); return false; }
      } else if (!front.value.trim() || !back.value.trim()){ toast('Preencha pergunta e resposta.'); return false; }
      const deck = deckIn.value.trim() || 'Geral';
      E.prefs.lastDeck = deck;
      const c = card ? { ...card } : { id: uid() + uid(), created: Date.now(), reps: 0, ivl: 0, ease: 2.5, lapses: 0, due: 0, src: init.src || null };
      Object.assign(c, { kind, deck, hint: hint.value.trim() });
      if (kind === 'cloze'){ c.text = t; delete c.front; delete c.back; }
      else { c.front = front.value.trim(); c.back = back.value.trim(); delete c.text; }
      putI('cards', c);
      toast(card ? 'Cartão salvo.' : `Cartão criado em “${deck}”.`);
      refreshStudy();
    } },
  ], { wide: true });
}
function refreshStudy(){
  if (currentView === 'revisar') renderReviewHome();
  if (currentView === 'hoje' && typeof renderStudyToday === 'function') renderStudyToday();
  if (currentView === 'notas' && typeof renderNotes === 'function') renderNotes(notesArg);
}

/* Cria vários cartões de uma vez (perguntas da aula) */
function addCards(list, deck){
  for (const x of list) putI('cards', { id: uid() + uid(), created: Date.now(), reps: 0, ivl: 0, ease: 2.5, lapses: 0, due: 0, deck, ...x });
  refreshStudy();
}

/* ---------- tela inicial ---------- */
let cardFilter = '';
function renderReviewHome(){
  const cards = live('cards'), now = Date.now();
  const due = cards.filter(c => isDueCard(c, now));
  const fresh = cards.filter(isNew);
  const newLeft = Math.max(0, NOVOS_DIA() - newToday());
  const todayN = due.length + Math.min(newLeft, fresh.length);
  $('#dueCount').textContent = todayN || '';
  const box = $('#reviewHome');
  if (!cards.length){
    box.replaceChildren(h('div', { class: 'empty card' },
      h('h2', { text: 'Nenhum cartão ainda.' }),
      h('p', { text: 'Cartões nascem do que você estuda: selecione um trecho num livro ou numa aula e toque em Cartão. As perguntas da ficha de cada aula também viram cartões com um toque.' }),
      h('button', { class: 'btn', type: 'button', text: '+ Novo cartão', onclick: () => openCardEditor() })));
    return;
  }
  const rows = decks().map(d => {
    const cs = cards.filter(c => (c.deck || 'Geral') === d);
    const dd = cs.filter(c => isDueCard(c, now)).length, nn = cs.filter(isNew).length;
    return h('div', { class: 'row deck' },
      h('span', { class: 'deck-name' }, h('b', { text: d }), h('span', { class: 'muted small', text: `${plural(cs.length, 'cartão', 'cartões')}` })),
      h('span', { class: 'deck-n' + (dd ? ' on' : ''), title: 'para revisar', text: dd }),
      h('span', { class: 'deck-n new', title: 'novos', text: nn }),
      h('button', { class: 'btn small' + (dd || nn ? '' : ' ghost'), type: 'button', text: 'Revisar', onclick: () => startReview(d) }));
  });
  box.replaceChildren(
    h('div', { class: 'stats rv-stats' },
      h('div', { class: 'stat' }, h('span', { text: 'para revisar' }), h('b', { text: due.length })),
      h('div', { class: 'stat' }, h('span', { text: 'novos hoje' }), h('b', { text: Math.min(newLeft, fresh.length) })),
      h('div', { class: 'stat' }, h('span', { text: 'cartões' }), h('b', { text: cards.length })),
      h('div', { class: 'stat' }, h('span', { text: 'dias seguidos' }), h('b', { text: reviewStreak() }))),
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn', type: 'button', disabled: !todayN, text: todayN ? `Começar revisão · ${todayN}` : 'Tudo revisado por hoje', onclick: () => startReview() }),
      h('button', { class: 'btn ghost', type: 'button', text: '+ Novo cartão', onclick: () => openCardEditor() }),
      !todayN && cards.length ? h('button', { class: 'btn ghost', type: 'button', text: 'Revisar adiantado', onclick: () => startReview(null, true) }) : null),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: 'Baralhos' }), h('span', { class: 'pill-muted', text: 'revisar · novos' })),
      h('div', { class: 'decks' }, rows)),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: 'Últimas 16 semanas' }), h('span', { class: 'pill-muted', text: 'revisões por dia' })),
      revHeat()),
    cardList(cards),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: 'Ajustes' })),
      h('label', { class: 'aa-row' }, h('span', { text: 'Cartões novos por dia' }),
        h('input', { type: 'number', min: 0, max: 200, value: NOVOS_DIA(), style: { width: '90px' }, onchange: e => { E.prefs.novosDia = Math.max(0, Math.min(200, +e.target.value || 0)); saveE(); renderReviewHome(); } }))));
}
function reviewStreak(){
  let n = 0, d = startOfDay();
  const has = t => { const o = E.revlog[toKey(new Date(t))]; return o && Object.values(o).some(v => v > 0); };
  if (!has(d)) d -= DAY_MS;
  while (has(d)){ n++; d -= DAY_MS; }
  return n;
}
function revHeat(){
  const end = startOfDay(), weeks = 16;
  const start = end - ((new Date(end).getDay() + 6) % 7) * DAY_MS - (weeks - 1) * 7 * DAY_MS;
  const cells = [];
  for (let t = start; t <= end; t += DAY_MS){
    const o = E.revlog[toKey(new Date(t))] || {}, n = Object.values(o).reduce((a, b) => a + b, 0);
    const lv = n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : n < 60 ? 3 : 4;
    cells.push(h('i', { class: 'lv' + lv, title: `${fmtDay(t)}: ${plural(n, 'revisão', 'revisões')}` }));
  }
  return h('div', { class: 'heat' }, cells);
}
function cardList(cards){
  const sec = h('section', { class: 'card' });
  const inp = h('input', { type: 'search', placeholder: 'Buscar cartões', value: cardFilter, 'aria-label': 'Buscar cartões' });
  const list = h('ol', { class: 'clist' });
  const paint = () => {
    const q = norm(inp.value.trim());
    const all = cards.filter(c => !q || norm([c.text, c.front, c.back, c.deck].join(' ')).includes(q))
      .sort((a, b) => (b.created || 0) - (a.created || 0));
    list.replaceChildren(...all.slice(0, 60).map(c => h('li', {},
      h('button', { type: 'button', onclick: () => openCardEditor(c) },
        h('span', { class: 'cl-front', text: clip(c.kind === 'cloze' ? c.text.replace(CLOZE_RE, '[$1]') : c.front, 160) }),
        h('span', { class: 'cl-meta', text: `${c.deck || 'Geral'} · ${isNew(c) ? 'novo' : 'volta ' + (c.due <= Date.now() ? 'hoje' : fmtDay(c.due))}` })))),
      all.length > 60 ? h('li', { class: 'muted small pad', text: `e mais ${all.length - 60}. Refine a busca.` }) : null);
  };
  inp.addEventListener('input', () => { cardFilter = inp.value; paint(); });
  paint();
  sec.append(h('div', { class: 'card-head' }, h('h2', { text: 'Cartões' }), inp), list);
  return sec;
}

/* ---------- sessão de revisão ---------- */
const RV = { el: $('#review'), q: [], cur: null, shown: false, done: 0, deck: null };
function startReview(deck = null, ahead = false){
  const now = Date.now(), inDeck = c => !deck || (c.deck || 'Geral') === deck;
  const cards = live('cards').filter(inDeck);
  let q = cards.filter(c => isDueCard(c, now)).sort((a, b) => a.due - b.due);
  const newLeft = Math.max(0, NOVOS_DIA() - newToday());
  const fresh = cards.filter(isNew).sort((a, b) => (a.created || 0) - (b.created || 0)).slice(0, newLeft);
  // novos intercalados: um a cada 3 revisões
  const mix = [];
  while (q.length || fresh.length){ mix.push(...q.splice(0, 3)); if (fresh.length) mix.push(fresh.shift()); }
  if (ahead && !mix.length) mix.push(...cards.filter(c => !isNew(c)).sort((a, b) => a.due - b.due).slice(0, 20));
  if (!mix.length){ toast('Nada para revisar agora.'); return; }
  Object.assign(RV, { q: mix.map(c => c.id), done: 0, deck, total: mix.length });
  RV.el.hidden = false;
  document.body.classList.add('reading');
  pushLayer(closeReview);
  wantAwake(true);
  nextCard();
}
function closeReview(){
  RV.el.hidden = true; RV.el.replaceChildren(); RV.cur = null;
  document.body.classList.remove('reading');
  wantAwake(false);
  refreshStudy();
}
function nextCard(){
  let id = RV.q.shift();
  while (id && !getI('cards', id)) id = RV.q.shift();
  if (!id) return endReview();
  RV.cur = getI('cards', id); RV.shown = false;
  paintCard();
}
function paintCard(){
  const c = RV.cur, el = RV.el;
  const answer = h('input', { type: 'text', class: 'rv-try', placeholder: 'Responda de memória (opcional)', 'aria-label': 'Sua resposta', autocomplete: 'off' });
  if (RV.typed) answer.value = RV.typed;
  const front = c.kind === 'cloze' ? clozeEl(c.text, RV.shown) : h('p', { class: 'rv-q', text: c.front });
  const back = !RV.shown ? null : h('div', { class: 'rv-back' },
    RV.typed ? h('p', { class: 'rv-typed' }, h('span', { class: 'muted small', text: 'Você respondeu' }), h('b', { text: RV.typed })) : null,
    c.kind === 'qa' ? h('p', { class: 'rv-a', text: c.back }) : null,
    c.hint ? h('p', { class: 'rv-hint', text: c.hint }) : null,
    c.src && c.src.label ? h('button', { class: 'btn-text rv-src', type: 'button', text: 'Origem: ' + c.src.label + ' ↗', onclick: () => openSource(c.src) }) : null);
  const left = RV.q.length + 1;
  el.replaceChildren(
    h('header', { class: 'rv-top' },
      h('button', { class: 'rd-btn', type: 'button', text: '←', 'aria-label': 'Sair da revisão', onclick: () => popLayer() }),
      h('span', { class: 'rv-deck', text: c.deck || 'Geral' }),
      h('span', { class: 'rv-count', text: `${RV.done} feitos · ${left} na fila` }),
      h('button', { class: 'rd-btn', type: 'button', text: 'Editar', onclick: () => openCardEditor(c) })),
    h('div', { class: 'rv-bar' }, h('i', { style: { width: Math.round(100 * RV.done / Math.max(1, RV.done + left)) + '%' } })),
    h('main', { class: 'rv-main' },
      h('div', { class: 'rv-card' + (RV.shown ? ' shown' : '') },
        isNew(c) ? h('span', { class: 'tag', text: 'novo' }) : null,
        front,
        !RV.shown ? answer : null,
        back)),
    h('footer', { class: 'rv-bot' }, !RV.shown
      ? h('button', { class: 'btn rv-show', type: 'button', text: 'Mostrar resposta', onclick: reveal })
      : h('div', { class: 'rv-grades' }, [[1, 'De novo'], [2, 'Difícil'], [3, 'Bom'], [4, 'Fácil']].map(([g, l]) =>
          h('button', { type: 'button', class: 'g' + g, onclick: () => grade(g) }, h('b', { text: l }), h('span', { text: ivlLabel(c, g) }), h('kbd', { text: g }))))));
  if (!RV.shown && !matchMedia('(hover:none)').matches) setTimeout(() => answer.focus(), 30);
  answer.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); reveal(); } });
  RV.answerEl = answer;
}
function reveal(){
  if (RV.shown) return;
  RV.typed = RV.answerEl ? RV.answerEl.value.trim() : '';
  RV.shown = true; paintCard(); RV.typed = '';
}
function grade(g){
  const c = RV.cur; if (!c || !RV.shown) return;
  const now = Date.now();
  const o = schedule(c, g, now);
  Object.assign(c, o, { last: now, first: c.first || now });
  putI('cards', c);
  const k = toKey(new Date());
  (E.revlog[k] ||= {})[DEVICE] = ((E.revlog[k] || {})[DEVICE] || 0) + 1;
  saveE();
  RV.done++;
  if (o.due - now < LEARN_MS){
    // volta na mesma sessão, depois de alguns outros
    const at = Math.min(RV.q.length, g === 1 ? 3 : 6);
    RV.q.splice(at, 0, c.id);
  }
  nextCard();
}
function endReview(){
  const due = live('cards').filter(c => isDueCard(c)).length;
  RV.el.replaceChildren(
    h('header', { class: 'rv-top' }, h('button', { class: 'rd-btn', type: 'button', text: '←', 'aria-label': 'Sair', onclick: () => popLayer() })),
    h('main', { class: 'rv-main' }, h('div', { class: 'rv-card rv-end' },
      h('h2', { text: 'Sessão concluída.' }),
      h('p', { text: `${plural(RV.done, 'resposta', 'respostas')}. ` + (due ? `Ainda há ${due} para hoje.` : 'Os próximos voltam no dia certo, pouco antes de você esquecer.') }),
      h('button', { class: 'btn', type: 'button', text: 'Fechar', onclick: () => popLayer() }))));
}
document.addEventListener('keydown', e => {
  if (RV.el.hidden || !RV.cur || !$('#modal').hidden) return;
  if (e.target.tagName === 'INPUT' && e.key !== 'Enter') return;
  if (!RV.shown && (e.key === ' ' || e.key === 'Enter')){ e.preventDefault(); reveal(); }
  else if (RV.shown && /^[1-4]$/.test(e.key)){ e.preventDefault(); grade(+e.key); }
  else if (RV.shown && e.key === ' '){ e.preventDefault(); grade(3); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !RV.el.hidden && $('#modal').hidden) popLayer(); });

/* Abre de onde o cartão veio: trecho do livro ou momento da aula */
async function openSource(src){
  if (!src) return;
  if (src.t === 'hl'){
    const x = getI('hl', src.id);
    if (x && x.lesson){ popAll(); go('aula', x.lesson); setTimeout(() => lessonJump(x.ms, x.id), 200); return; }
    const bid = src.book || (x && x.book);
    if (!bid) return;
    popAll();
    await openBook(bid);
    if (x && RD.eng) setTimeout(() => RD.eng && RD.eng.gotoHl(x), 120);
  } else if (src.t === 'aula'){
    popAll(); go('aula', src.id); if (src.ms != null) setTimeout(() => lessonJump(src.ms), 200);
  }
}
/* fecha leitor, revisão e janelas abertas (sem mexer no histórico de abas) */
function popAll(){ while (layers.length){ layers.pop()(); } try { history.replaceState(null, '', location.hash); } catch (e) {} }
