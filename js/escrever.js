/* =====================================================================
   Escrever: o Escritor como editor das notas
   ---------------------------------------------------------------------
   As notas são Markdown, uma por item (E.notes), no espírito do
   GR Notes / Obsidian: [[ligações]] entre notas, livros e aulas,
   menções de volta, #etiquetas, nota do dia (o Diário da rotina) e
   “Ir para” no Ctrl+O. O editor é o Escritor inteiro (escrever/),
   num iframe da mesma origem que conversa com o Caderno por
   window.CadernoPonte. Um iframe só, carregado uma vez: trocar de nota
   é trocar o texto.

   Documento aberto (WR.doc):
     { k: 'nota', id }   nota de E.notes
     { k: 'dia', day }   Diário do dia (state.log[day].diary)
     { k: 'guia', text } o guia do Escritor, só para ler (não grava)
   ===================================================================== */
'use strict';

/* ---------- Markdown das notas ---------- */
const RE_WIKI = /\[\[([^\[\]\n|]+)(?:\|([^\[\]\n]+))?\]\]/g;
const RE_TAG = /(^|[\s(])#([A-Za-zÀ-ÖØ-öø-ÿ0-9_\/-]*[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_\/-]*)/g;
function titleFromMd(md){
  const l = String(md || '').split('\n').find(x => x.trim());
  return l ? l.replace(/^#+\s*/, '').replace(/[*_`>[\]]/g, '').trim().slice(0, 90) : '';
}
const noteTitle = n => (n && (n.title || titleFromMd(n.body))) || 'Sem título';
/* Texto completo para o editor: notas antigas guardavam o título à parte */
function noteMd(n){
  const b = n.body || '';
  if (n.title && norm(titleFromMd(b)) !== norm(n.title)) return `# ${n.title}\n\n${b}`;
  return b;
}
/* Corpo sem o título de abertura (para listas e exportação) */
function noteRest(n){
  const lines = noteMd(n).split('\n');
  let i = 0; while (i < lines.length && !lines[i].trim()) i++;
  if (lines[i] && /^#\s/.test(lines[i])) lines.splice(0, i + 1);
  return lines.join('\n').replace(/^\s+/, '');
}
function linksOf(md){ const out = []; for (const m of String(md || '').matchAll(RE_WIKI)) out.push(m[1].trim()); return out; }
function tagsOf(md){
  const out = new Set();
  const txt = String(md || '').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of txt.matchAll(RE_TAG)) out.add('#' + m[2]);
  return [...out];
}
function snippet(md, n = 160){
  return clip(String(md || '')
    .replace(RE_WIKI, (_, a, b) => b || a)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~`]/g, ''), n);
}
const notesLive = () => live('notes');
const diaryDays = () => Object.keys(state.log || {}).filter(k => (state.log[k].diary || '').trim()).sort().reverse();
const diaryTitle = day => 'Diário, ' + fmtDate(fromKey(day).getTime());

/* Para onde aponta [[nome]] */
function resolveLink(name){
  const k = norm(String(name).trim());
  if (!k) return null;
  const n = notesLive().find(x => norm(noteTitle(x)) === k);
  if (n) return { k: 'nota', id: n.id, t: noteTitle(n) };
  const b = live('books').find(x => norm(x.title) === k);
  if (b) return { k: 'livro', id: b.id, t: b.title };
  const l = live('lessons').find(x => norm(x.name) === k);
  if (l) return { k: 'aula', id: l.id, t: l.name };
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return { k: 'dia', day: k, t: diaryTitle(k) };
  return null;
}
/* Quem cita um documento: notas e diários com [[título]] */
function backlinks(titles){
  const ks = new Set(titles.filter(Boolean).map(t => norm(t)));
  const out = [];
  for (const n of notesLive()) if (linksOf(noteMd(n)).some(t => ks.has(norm(t)))) out.push({ k: 'nota', id: n.id, t: noteTitle(n), md: noteMd(n), at: n.u });
  for (const d of diaryDays()) if (linksOf(state.log[d].diary).some(t => ks.has(norm(t)))) out.push({ k: 'dia', day: d, t: diaryTitle(d), md: state.log[d].diary, at: fromKey(d).getTime() });
  return out;
}

/* ---------- Camada do editor ---------- */
const WR = { el: null, frame: null, ready: null, doc: null, startTitle: '', created: new Set(), panelOn: false };
function writerEl(){
  if (WR.el) return WR.el;
  WR.el = h('div', { id: 'writer', class: 'writer', hidden: true },
    h('div', { class: 'wr-load', id: 'wrLoad', text: 'Abrindo o Escritor…' }),
    h('div', { class: 'wr-veu', id: 'wrVeu', hidden: true, onclick: () => CadernoPonte.painel() }),
    h('aside', { class: 'wr-panel', id: 'wrPanel', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ligações', tabindex: '-1',
      onkeydown: e => { if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); CadernoPonte.painel(); } } }));
  document.body.append(WR.el);
  return WR.el;
}
function frameWin(){ try { return WR.frame && WR.frame.contentWindow; } catch (e) { return null; } }

function docText(doc){
  if (!doc) return '';
  if (doc.k === 'nota'){ const n = getI('notes', doc.id); return n ? noteMd(n) : (doc.text || ''); }
  if (doc.k === 'dia') return (state.log[doc.day] && state.log[doc.day].diary) || '';
  return doc.text || '';
}
function docTitle(doc){
  if (!doc) return '';
  if (doc.k === 'nota'){ const n = getI('notes', doc.id); return n ? noteTitle(n) : titleFromMd(doc.text); }
  if (doc.k === 'dia') return diaryTitle(doc.day);
  return 'Guia do Escritor';
}
function docSave(doc, text){
  if (!doc || doc !== WR.doc) return;
  if (doc.k === 'nota'){
    let n = getI('notes', doc.id);
    if (!n){
      if (!text.trim()) return;
      n = { id: doc.id, created: Date.now(), src: doc.src || null };
      WR.created.add(doc.id);
    }
    if (n.body === text && n.title === titleFromMd(text)) return;
    n.body = text; n.title = titleFromMd(text);
    putI('notes', n);
  } else if (doc.k === 'dia'){
    const e = entryFor(doc.day);
    if (e.diary === text) return;
    e.diary = text; e.t = Date.now();
    clearTimeout(docSave.t); docSave.t = setTimeout(() => save('log'), 300);
    const d = $('#diary'); if (d && d.dataset.day === doc.day && document.activeElement !== d) d.dataset.day = '';
  }
}

/* Abre um documento no editor (cria a camada na primeira vez) */
async function openDoc(doc, opts = {}){
  writerEl();
  if (WR.doc) leaveDoc();
  WR.doc = doc;
  WR.startTitle = docTitle(doc);
  if (WR.el.hidden){
    WR.el.hidden = false;
    document.body.classList.add('reading', 'writing');
    pushLayer(closeWriter);
  }
  if (!WR.frame){
    WR.frame = h('iframe', { class: 'wr-frame', title: 'Escritor', src: 'escrever/index.html?caderno=1' });
    WR.ready = new Promise(res => WR.frame.addEventListener('load', res, { once: true }));
    WR.el.prepend(WR.frame);
    await WR.ready;
    $('#wrLoad')?.remove();
    // o iframe leu PONTE.texto() ao abrir; o cursor vai para o fim se for nota nova
    if (opts.fim) frameWin()?.ponteCarregar?.(docText(doc), { fim: true });
  } else {
    await WR.ready;
    frameWin()?.ponteCarregar?.(docText(doc), { fim: !!opts.fim });
  }
  if (WR.panelOn) paintWrPanel();
}
/* Ao sair de um documento: grava, apaga nota nova vazia e, se o título
   mudou, atualiza as [[ligações]] que apontavam para o nome antigo. */
function leaveDoc(){
  const doc = WR.doc;
  if (!doc) return;
  try { frameWin()?.ponteFlush?.(); } catch (e) {}
  if (doc.k === 'nota'){
    const n = getI('notes', doc.id);
    if (n && !String(n.body || '').trim()){ delI('notes', n.id); }
    else if (n){
      const old = WR.startTitle, now = noteTitle(n);
      if (old && norm(old) !== norm(now)) relink(old, now, n.id);
    }
  }
  WR.doc = null;
}
function relink(old, now, selfId){
  const re = new RegExp('\\[\\[\\s*' + old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(\\|[^\\]\\n]*)?\\]\\]', 'gi');
  let count = 0;
  for (const n of notesLive()){
    if (n.id === selfId) continue;
    const md = noteMd(n);
    const out = md.replace(re, (_, alias) => { count++; return `[[${now}${alias || ''}]]`; });
    if (out !== md){ n.body = out; n.title = titleFromMd(out); putI('notes', n); }
  }
  for (const d of diaryDays()){
    const e = state.log[d], out = e.diary.replace(re, (_, alias) => { count++; return `[[${now}${alias || ''}]]`; });
    if (out !== e.diary){ e.diary = out; e.t = Date.now(); save('log'); }
  }
  if (count) toast(`O título mudou para “${clip(now, 40)}”: ${plural(count, 'ligação atualizada', 'ligações atualizadas')}.`);
}
function closeWriter(){
  leaveDoc();
  WR.el.hidden = true;
  $('#wrPanel').hidden = true; $('#wrVeu').hidden = true; WR.panelOn = false;
  frameWin()?.ponteLigacoes?.(false);
  document.body.classList.remove('writing');
  if (!RD.eng && FC.el.hidden) document.body.classList.remove('reading');
  if (currentView === 'notas') renderNotes();
  if (currentView === 'hoje') renderToday();
  if (RD.eng) rdRefresh('hl');
}
addEventListener('pagehide', () => { if (WR.doc) try { frameWin()?.ponteFlush?.(); } catch (e) {} });

/* Fecha todas as camadas (leitor, editor, janelas) e depois faz fn */
function closeAll(fn){
  if (!layers.length){ fn(); return; }
  afterPop.push(fn);
  history.go(-layers.length);
}

/* ---------- Criar ---------- */
function newNote(text = '', src = null, opts = {}){
  const id = uid() + uid();
  if (text.trim()) { putI('notes', { id, created: Date.now(), src, body: text, title: titleFromMd(text) }); WR.created.add(id); }
  openDoc({ k: 'nota', id, src, text }, { fim: true, ...opts });
  return id;
}
function openNote(id){ openDoc({ k: 'nota', id }); }
function openDiary(day = todayKey()){ openDoc({ k: 'dia', day }, { fim: true }); }

/* Seguir uma [[ligação]]; sem alvo, cria a nota (como no Obsidian) */
function followLink(name){
  const r = resolveLink(name);
  if (!r){ newNote(`# ${name.trim()}\n\n`); return; }
  if (r.k === 'nota') openNote(r.id);
  else if (r.k === 'dia') openDiary(r.day);
  else if (r.k === 'livro'){
    if (RD.book && RD.book.id === r.id){ popLayer(); return; }
    closeAll(() => openBook(r.id));
  } else if (r.k === 'aula') closeAll(() => go('aula', r.id));
}

/* ---------- A ponte (o Escritor chama daqui de dentro) ---------- */
window.CadernoPonte = {
  texto: () => docText(WR.doc),
  salvar: t => docSave(WR.doc, String(t)),
  fechar: () => { if (WR.el && !WR.el.hidden) popLayer(); },
  nova: () => newNote(''),
  importar: (t, nome) => {
    const base = String(nome || 'Nota').replace(/\.(md|markdown|txt|text)$/i, '');
    newNote(/^\s*#\s/.test(t) ? t : `# ${base}\n\n${t}`, null, { fim: false });
    toast(`“${clip(base, 40)}” virou nota.`);
  },
  guia: g => openDoc({ k: 'guia', text: g }),
  ir: name => followLink(name),
  etiqueta: tag => closeAll(() => { notesTab = 'notas'; notesTag = tag; go('notas'); }),
  trocar: () => quickSwitch(),
  /* Ligações: pop-up no meio da tela, sobre um véu que fecha ao clicar */
  painel: () => {
    WR.panelOn = !WR.panelOn;
    $('#wrPanel').hidden = $('#wrVeu').hidden = !WR.panelOn;
    frameWin()?.ponteLigacoes?.(WR.panelOn);
    if (WR.panelOn){ paintWrPanel(); setTimeout(() => { window.focus(); $('#wrPanel').focus({ preventScroll: true }); }, 0); }
    else try { WR.frame?.focus(); frameWin()?.document.getElementById('editor')?.focus({ preventScroll: true }); } catch (e) {}
  },
  titulos: q => {
    const k = norm(q.trim());
    const cur = WR.doc && WR.doc.k === 'nota' ? WR.doc.id : null;
    const all = [
      ...notesLive().filter(n => n.id !== cur).sort((a, b) => (b.u || 0) - (a.u || 0)).map(n => ({ t: noteTitle(n), rot: 'nota' })),
      ...booksSorted().map(b => ({ t: b.title, rot: 'livro' })),
      ...lessonsSorted().map(l => ({ t: l.name, rot: 'aula' })),
    ];
    const seen = new Set();
    const hits = all.filter(x => { const n = norm(x.t); if (seen.has(n) || (k && !n.includes(k))) return false; seen.add(n); return true; })
      .sort((a, b) => (norm(b.t).startsWith(k) ? 1 : 0) - (norm(a.t).startsWith(k) ? 1 : 0)).slice(0, 8);
    if (q.trim() && !seen.has(k)) hits.push({ t: q.trim(), rot: 'nota nova' });
    return hits;
  },
};

/* ---------- Painel de ligações (dentro do editor) ---------- */
function paintWrPanel(){
  const p = $('#wrPanel');
  if (!p || !WR.doc) return;
  const doc = WR.doc;
  const n = doc.k === 'nota' ? getI('notes', doc.id) : null;
  const md = docText(doc);
  const title = docTitle(doc);
  const srcBook = n && n.src && n.src.t === 'livro' ? getI('books', n.src.id) : null;
  const srcLesson = n && n.src && n.src.t === 'aula' ? getI('lessons', n.src.id) : null;
  const back = backlinks([title, doc.k === 'dia' ? doc.day : null]).filter(x => !(x.k === 'nota' && n && x.id === n.id));
  const outs = [...new Set(linksOf(md))].map(t => ({ t, r: resolveLink(t) }));
  const tags = tagsOf(md);
  // marcações para inserir: da fonte e dos livros/aulas citados
  const srcs = [];
  if (srcBook) srcs.push({ k: 'livro', x: srcBook });
  if (srcLesson) srcs.push({ k: 'aula', x: srcLesson });
  for (const o of outs) if (o.r && (o.r.k === 'livro' || o.r.k === 'aula') && !srcs.some(s => s.x.id === o.r.id)) srcs.push({ k: o.r.k, x: getI(o.r.k === 'livro' ? 'books' : 'lessons', o.r.id) });
  const quote = x => `> ${x.text.replace(/\s+/g, ' ').trim()}` + (x.page ? ` (p. ${x.page})` : x.ms != null && x.lesson ? ` (${fmtClock(x.ms)})` : '') + (x.note ? `\n\n${x.note}` : '');
  const item = (label, sub, onclick) => h('li', {}, h('button', { type: 'button', onclick }, h('span', { text: label }), sub ? h('i', { text: sub }) : null));
  p.replaceChildren(
    h('div', { class: 'wp-head' }, h('b', { text: 'Ligações' }), h('button', { class: 'x', type: 'button', 'aria-label': 'Fechar', text: '×', onclick: () => CadernoPonte.painel() })),
    h('div', { class: 'wp-body' },
      h('h3', { text: `Citam esta nota · ${back.length}` }),
      back.length ? h('ol', { class: 'rp-list' }, back.map(b => item(b.t, b.k === 'dia' ? 'diário' : fmtDay(b.at || Date.now()), () => b.k === 'dia' ? openDiary(b.day) : openNote(b.id)))) :
        h('p', { class: 'muted small', text: `Nenhuma ainda. Em outra nota, escreva [[${clip(title, 40)}]] para ligar as duas.` }),
      h('h3', { text: `Esta nota cita · ${outs.length}` }),
      outs.length ? h('ol', { class: 'rp-list' }, outs.map(o => item(o.t, o.r ? o.r.k : 'criar', () => followLink(o.t)))) :
        h('p', { class: 'muted small', text: 'Escreva [[ para ligar a uma nota, um livro ou uma aula.' }),
      tags.length ? h('h3', { text: 'Etiquetas' }) : null,
      tags.length ? h('div', { class: 'wp-tags' }, tags.map(t => h('button', { class: 'chip', type: 'button', text: t, onclick: () => CadernoPonte.etiqueta(t) }))) : null,
      ...srcs.map(s => {
        const list = s.k === 'livro' ? hlOf(s.x.id).sort((a, b) => s.x.type === 'PDF' ? a.page - b.page : (a.s - b.s) || (a.a - b.a)) : live('hl').filter(x => x.lesson === s.x.id).sort((a, b) => a.ms - b.ms);
        const name = s.k === 'livro' ? s.x.title : s.x.name;
        return h('section', { class: 'wp-src' },
          h('h3', {}, (s.k === 'livro' ? 'Marcações de ' : 'Marcações da aula ') + clip(name, 40) + ` · ${list.length}`),
          h('div', { class: 'wp-acts' },
            h('button', { class: 'btn small ghost', type: 'button', text: s.k === 'livro' ? 'Abrir o livro' : 'Abrir a aula', onclick: () => followLink(name) }),
            list.length ? h('button', { class: 'btn small ghost', type: 'button', text: 'Inserir todas', onclick: () => frameWin()?.ponteInserir?.(list.map(quote).join('\n\n')) }) : null),
          list.length ? h('ol', { class: 'wp-hls' }, list.slice(0, 120).map(x => h('li', { class: 'c-' + x.color },
            h('p', { text: clip(x.text, 220) }),
            h('button', { type: 'button', text: 'Inserir', onclick: () => frameWin()?.ponteInserir?.(quote(x)) })))) : null);
      }),
      doc.k === 'nota' && n ? h('div', { class: 'wp-foot' },
        h('button', { class: 'btn small ghost', type: 'button', text: n.pin ? 'Desafixar' : 'Fixar no topo', onclick: () => { n.pin = !n.pin; putI('notes', n); paintWrPanel(); } }),
        h('button', { class: 'btn small ghost', type: 'button', text: 'Cartão de revisão', onclick: () => openCardEditor({ kind: 'qa', front: noteTitle(n), back: noteRest(n), deck: (n.src && n.src.label) || 'Notas', src: n.src ? { ...n.src } : null }) }),
        h('button', { class: 'btn small danger', type: 'button', text: 'Apagar nota', onclick: async () => {
          if (!await confirmBox(`Apagar “${clip(noteTitle(n), 60)}”?`)) return;
          const keep = { ...n };
          WR.doc = null; delI('notes', n.id); popLayer();
          toast('Nota apagada.', 'Desfazer', () => { putI('notes', keep); if (currentView === 'notas') renderNotes(); });
        } })) : null,
      doc.k === 'guia' ? h('p', { class: 'muted small', text: 'O guia não é gravado: é só para ler. Feche e volte para as suas notas.' }) : null));
}

/* ---------- Ir para (Ctrl+O) ---------- */
function quickSwitch(){
  const inp = h('input', { type: 'search', placeholder: 'Nota, livro, aula ou dia…', 'aria-label': 'Ir para', autofocus: true });
  const out = h('ol', { class: 'qs-list' });
  let items = [], sel = 0;
  const run = it => { whenClosed(() => it.go()); popLayer(); };
  const paint = () => {
    const q = norm(inp.value.trim());
    const all = [
      ...notesLive().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.u || 0) - (a.u || 0)).map(n => ({ t: noteTitle(n), sub: 'nota', hay: noteTitle(n) + ' ' + noteMd(n), go: () => openNote(n.id) })),
      ...booksSorted().map(b => ({ t: b.title, sub: 'livro', hay: b.title + ' ' + (b.author || ''), go: () => openBook(b.id) })),
      ...lessonsSorted().map(l => ({ t: l.name, sub: 'aula', hay: l.name + ' ' + (l.course || ''), go: () => go('aula', l.id) })),
      ...diaryDays().slice(0, 60).map(d => ({ t: diaryTitle(d), sub: 'diário', hay: d + ' ' + diaryTitle(d) + ' ' + state.log[d].diary, go: () => openDiary(d) })),
    ];
    items = (q ? all.filter(x => norm(x.t).includes(q)).concat(all.filter(x => !norm(x.t).includes(q) && norm(x.hay).includes(q))) : all).slice(0, 12);
    items.push({ t: 'Nota do dia', sub: fmtDay(Date.now()), go: () => openDiary() });
    if (inp.value.trim()) items.push({ t: `Nova nota “${clip(inp.value.trim(), 50)}”`, sub: 'criar', go: () => newNote(`# ${inp.value.trim()}\n\n`) });
    else items.push({ t: 'Nova nota', sub: 'criar', go: () => newNote('') });
    sel = Math.min(sel, items.length - 1);
    out.replaceChildren(...items.map((it, i) => h('li', {}, h('button', { type: 'button', class: i === sel ? 'on' : '', onclick: () => run(it) }, h('span', { text: it.t }), h('i', { text: it.sub })))));
  };
  inp.addEventListener('input', () => { sel = 0; paint(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; paint(); out.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter'){ e.preventDefault(); items[sel] && run(items[sel]); }
  });
  paint();
  modal('Ir para', h('div', { class: 'qs' }, inp, out, h('p', { class: 'muted small', text: '↑ ↓ para escolher, Enter para abrir. Ctrl+O em qualquer lugar.' })), [], { wide: true });
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o'){
    e.preventDefault();
    if ($('#modal').hidden) quickSwitch();
  }
});
