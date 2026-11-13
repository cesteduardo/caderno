/* =====================================================================
   Notas: destaques e anotações de livros e aulas num lugar só
   ---------------------------------------------------------------------
   Filtro por tipo e por origem; a busca procura também dentro das
   transcrições. Exporta tudo em Markdown (cabe direto no Obsidian:
   autores e obras saem como [[links]]).
   ===================================================================== */
'use strict';

let notesArg = '', notesKind = 'tudo', notesQ = '';
function srcOf(x){
  if (x.book){ const b = E.books[x.book]; return { k: 'livro:' + x.book, label: b && !b.del ? b.title : 'Livro removido', sub: x.page ? 'p. ' + x.page : '' }; }
  if (x.lesson){ const l = getI('lessons', x.lesson); return { k: 'aula:' + x.lesson, label: l ? l.name : 'Aula removida', sub: fmtClock(x.ms || 0) }; }
  if (x.src && x.src.id){ return { k: (x.src.t === 'aula' ? 'aula:' : 'livro:') + x.src.id, label: x.src.label || '', sub: '' }; }
  return { k: 'solta', label: 'Notas soltas', sub: '' };
}
function renderNotes(arg){
  if (arg !== undefined) notesArg = arg || '';
  const box = $('#notesHome');
  const items = [
    ...live('hl').map(x => ({ t: 'hl', x, at: x.created || x.u, s: srcOf(x) })),
    ...live('notes').map(x => ({ t: 'nota', x, at: x.created || x.u, s: srcOf(x) })),
  ];
  const sources = new Map();
  for (const it of items) if (!sources.has(it.s.k)) sources.set(it.s.k, it.s.label);
  const q = norm(notesQ.trim());
  const shown = items.filter(it =>
    (notesKind === 'tudo' || (notesKind === 'hl' && it.t === 'hl' && !it.x.note) || (notesKind === 'nota' && (it.t === 'nota' || it.x.note)) || (notesKind === 'aulas' && it.s.k.startsWith('aula:'))) &&
    (!notesArg || it.s.k === notesArg) &&
    (!q || norm([it.x.text, it.x.note, it.x.title, it.x.body, it.s.label].join(' ')).includes(q)));
  // agrupa por origem, a mais recente primeiro
  const groups = new Map();
  for (const it of shown.sort((a, b) => b.at - a.at)){ if (!groups.has(it.s.k)) groups.set(it.s.k, []); groups.get(it.s.k).push(it); }
  const srcSel = h('select', { 'aria-label': 'Origem', onchange: e => { notesArg = e.target.value; renderNotes(); } },
    h('option', { value: '', text: 'Todas as origens' }),
    [...sources].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([k, l]) => h('option', { value: k, selected: k === notesArg, text: clip(l, 50) })));
  const search = h('input', { type: 'search', placeholder: 'Buscar em notas, destaques e transcrições', value: notesQ, 'aria-label': 'Buscar' });
  let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { notesQ = search.value; renderNotes(); const s = $('#notesHome input[type=search]'); if (s){ s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 350); });
  const counts = { tudo: items.length, hl: items.filter(i => i.t === 'hl' && !i.x.note).length, nota: items.filter(i => i.t === 'nota' || i.x.note).length, aulas: items.filter(i => i.s.k.startsWith('aula:')).length };
  box.replaceChildren(
    h('div', { class: 'toolbar notes-bar' },
      search,
      h('button', { class: 'btn small', type: 'button', text: '+ Nota', onclick: () => freeNote() }),
      h('button', { class: 'btn ghost small', type: 'button', text: 'Exportar .md', onclick: exportAllMd })),
    h('div', { class: 'toolbar notes-bar' },
      h('div', { class: 'seg' }, [['tudo', 'Tudo'], ['hl', 'Destaques'], ['nota', 'Com nota'], ['aulas', 'Das aulas']].map(([k, l]) =>
        h('button', { type: 'button', class: k === notesKind ? 'on' : '', onclick: () => { notesKind = k; renderNotes(); } }, l, h('span', { class: 'n', text: counts[k] })))),
      srcSel),
    !items.length ? h('div', { class: 'empty card' }, h('h2', { text: 'Nada anotado ainda.' }), h('p', { text: 'Selecione um trecho de um livro ou de uma aula e escolha uma cor. Tudo o que você marcar aparece aqui.' })) : null,
    ...[...groups].map(([k, list]) => h('section', { class: 'card ngroup' },
      h('div', { class: 'card-head' },
        h('h2', {}, h('button', { type: 'button', class: 'nsrc', text: list[0].s.label, onclick: () => openGroup(k) })),
        h('span', { class: 'pill-muted', text: k.startsWith('aula:') ? 'aula' : k.startsWith('livro:') ? 'livro' : 'nota' })),
      h('ol', { class: 'nlist' }, list.map(noteItem)))),
    q.length >= 3 ? transcriptHits(q) : null,
    items.length && !shown.length && q.length < 3 ? h('p', { class: 'empty', text: 'Nada com esse filtro.' }) : null);
}
function noteItem(it){
  const x = it.x;
  if (it.t === 'nota') return h('li', { class: 'nitem nota' },
    x.title ? h('b', { text: x.title }) : null,
    h('p', { class: 'nbody', text: x.body }),
    h('div', { class: 'hl-acts' },
      h('span', { class: 'muted small', text: fmtDay(it.at) }),
      h('button', { type: 'button', text: 'Editar', onclick: () => freeNote(x) }),
      h('button', { type: 'button', text: 'Cartão', onclick: () => openCardEditor({ kind: 'qa', front: x.title || '', back: x.body, deck: it.s.label || 'Notas', src: x.src ? { ...x.src } : null }) }),
      h('button', { type: 'button', class: 'danger', text: 'Apagar', onclick: async () => { if (await confirmBox('Apagar esta nota?')){ delI('notes', x.id); renderNotes(); } } })));
  return h('li', { class: 'nitem c-' + x.color },
    h('blockquote', { class: 'nq', text: x.text }),
    x.note ? h('p', { class: 'hl-note', text: x.note }) : null,
    h('div', { class: 'hl-acts' },
      h('span', { class: 'muted small', text: [it.s.sub, fmtDay(it.at)].filter(Boolean).join(' · ') }),
      h('button', { type: 'button', text: 'Abrir', onclick: () => openSource({ t: 'hl', id: x.id, book: x.book }) }),
      h('button', { type: 'button', text: x.note ? 'Editar nota' : 'Nota', onclick: () => editNote(x.note, v => { x.note = v; putI('hl', x); renderNotes(); }) }),
      h('button', { type: 'button', text: 'Cartão', onclick: () => x.lesson ? lessonCard(getI('lessons', x.lesson) || { name: '', course: '' }, x) : cardFromHl(x) }),
      h('button', { type: 'button', class: 'danger', text: 'Apagar', onclick: () => { delI('hl', x.id); renderNotes(); } })));
}
function openGroup(k){
  const [t, id] = k.split(':');
  if (t === 'livro') openBook(id);
  else if (t === 'aula') go('aula', id);
}
function transcriptHits(q){
  const hits = [];
  for (const l of lessonsSorted()){
    for (const s of l.segs || []){
      if (norm(s.text).includes(q)){ hits.push([l, s]); if (hits.length >= 80) break; }
    }
    if (hits.length >= 80) break;
  }
  if (!hits.length) return null;
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', { text: 'Nas transcrições' }), h('span', { class: 'pill-muted', text: hits.length >= 80 ? '80+ trechos' : plural(hits.length, 'trecho', 'trechos') })),
    h('ol', { class: 'rp-list hits' }, hits.map(([l, s]) => {
      const low = norm(s.text), i = low.indexOf(q);
      return h('li', {}, h('button', { type: 'button', onclick: () => { go('aula', l.id); setTimeout(() => lessonJump(s.ms), 120); } },
        h('span', {}, s.text.slice(0, i), h('mark', { text: s.text.slice(i, i + q.length) }), s.text.slice(i + q.length)),
        h('i', { text: `${clip(l.name, 28)} · ${fmtClock(s.ms)}` })));
    })));
}
function freeNote(n){
  const t = h('input', { type: 'text', value: n ? n.title || '' : '', placeholder: 'Título (opcional)', 'aria-label': 'Título' });
  const ta = h('textarea', { class: 'note-ta', rows: 8, placeholder: 'Ideia, resumo, plano de texto, pergunta para a próxima aula…' });
  ta.value = n ? n.body : '';
  const src = !n && notesArg ? notesArg.split(':') : null;
  modal(n ? 'Editar nota' : 'Nova nota', h('div', { class: 'form' }, t, ta), [
    { label: 'Cancelar' },
    { label: 'Salvar', primary: true, onclick: () => {
      if (!ta.value.trim()) return false;
      const base = n || { id: uid() + uid(), created: Date.now(), src: src ? { t: src[0], id: src[1], label: (src[0] === 'livro' ? (getI('books', src[1]) || {}).title : (getI('lessons', src[1]) || {}).name) || '' } : null };
      putI('notes', { ...base, title: t.value.trim(), body: ta.value.trim() });
      renderNotes();
    } },
  ]);
}
function exportAllMd(){
  let md = `# Caderno: notas e destaques\n\nExportado em ${fmtDate(Date.now())}.\n\n`;
  for (const b of booksSorted()){
    const hl = hlOf(b.id), ns = live('notes').filter(n => n.src && n.src.id === b.id);
    if (!hl.length && !ns.length) continue;
    md += `## ${b.title}\n\n` + (b.author ? `Autor: [[${b.author}]]\n\n` : '');
    md += ns.map(n => (n.title ? `**${n.title}**\n\n` : '') + n.body + '\n\n').join('');
    md += hl.sort((x, y) => b.type === 'PDF' ? x.page - y.page : (x.s - y.s) || (x.a - y.a)).map(x => `> ${x.text}` + (x.page ? ` (p. ${x.page})` : '') + (x.note ? `\n\n${x.note}` : '') + '\n\n').join('');
  }
  for (const l of lessonsSorted()){
    const hl = live('hl').filter(x => x.lesson === l.id), ns = live('notes').filter(n => n.src && n.src.id === l.id);
    if (!hl.length && !ns.length && !(l.marks || []).some(m => m.note || m.text)) continue;
    md += `## Aula: ${l.name}\n\n${[l.course, l.professor && `[[${l.professor}]]`, fmtDate(l.created)].filter(Boolean).join(' · ')}\n\n`;
    md += ns.map(n => (n.title ? `**${n.title}**\n\n` : '') + n.body + '\n\n').join('');
    md += hl.sort((a, b) => a.ms - b.ms).map(x => `> ${x.text} (${fmtClock(x.ms)})` + (x.note ? `\n\n${x.note}` : '') + '\n\n').join('');
    md += (l.marks || []).filter(m => m.note || m.text).map(m => `- ${fmtClock(m.ms)} ${[m.text, m.note].filter(Boolean).join(': ')}\n`).join('') + '\n';
  }
  const loose = live('notes').filter(n => !n.src);
  if (loose.length) md += '## Notas soltas\n\n' + loose.map(n => (n.title ? `**${n.title}**\n\n` : '') + n.body + '\n\n').join('');
  download('Caderno - notas.md', md);
}
