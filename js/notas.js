/* =====================================================================
   Notas: o GR Notes dentro do Caderno
   ---------------------------------------------------------------------
   Três abas:
   - Notas: Markdown com [[ligações]], #etiquetas e menções de volta;
     abre no Escritor (js/escrever.js).
   - Diário: o diário de cada dia da rotina, também no Escritor.
   - Marcações: tudo o que foi marcado nos livros e nas aulas, com
     filtro por tipo, origem e cor; a busca procura também dentro das
     transcrições.
   Exporta em .zip pronto para o Obsidian (uma nota por arquivo).
   ===================================================================== */
'use strict';

let notesArg = '', notesKind = 'tudo', notesQ = '', notesTab = 'notas', notesTag = '', notesColor = '';
function srcOf(x){
  if (x.book){ const b = E.books[x.book]; return { k: 'livro:' + x.book, label: b && !b.del ? b.title : 'Livro removido', sub: x.page ? 'p. ' + x.page : '' }; }
  if (x.lesson){ const l = getI('lessons', x.lesson); return { k: 'aula:' + x.lesson, label: l ? l.name : 'Aula removida', sub: fmtClock(x.ms || 0) }; }
  if (x.src && x.src.id){ return { k: (x.src.t === 'aula' ? 'aula:' : 'livro:') + x.src.id, label: x.src.label || '', sub: '' }; }
  return { k: 'solta', label: 'Notas soltas', sub: '' };
}

function renderNotes(arg){
  if (arg !== undefined && arg !== null){
    arg = String(arg);
    if (arg.startsWith('livro:') || arg.startsWith('aula:')){ notesTab = 'marcas'; notesArg = arg; }
    else if (arg.startsWith('tag:')){ notesTab = 'notas'; notesTag = arg.slice(4); }
    else if (arg.startsWith('nota:')){ const id = arg.slice(5); setTimeout(() => openNote(id), 0); }
    else if (arg === 'diario') notesTab = 'diario';
  }
  const box = $('#notesHome');
  const q = norm(notesQ.trim());
  const notes = notesLive();
  const days = diaryDays();
  const hls = live('hl');

  const search = h('input', { type: 'search', placeholder: 'Buscar em notas, diário, marcações e transcrições', value: notesQ, 'aria-label': 'Buscar' });
  let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { notesQ = search.value; renderNotes(); const s = $('#notesHome input[type=search]'); if (s){ s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 300); });

  const nShown = notes.filter(n => (!notesTag || tagsOf(noteMd(n)).some(x => norm(x) === norm(notesTag))) && (!q || norm(noteTitle(n) + ' ' + noteMd(n)).includes(q)));
  const dShown = days.filter(d => !q || norm(state.log[d].diary + ' ' + diaryTitle(d)).includes(q));
  const counts = { notas: nShown.length, diario: dShown.length, marcas: hls.length };

  const tabs = h('div', { class: 'seg notes-tabs', role: 'tablist' }, [['notas', 'Notas'], ['diario', 'Diário'], ['marcas', 'Marcações']].map(([k, l]) =>
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === notesTab), class: k === notesTab ? 'on' : '', onclick: () => { notesTab = k; renderNotes(); } }, l, h('span', { class: 'n', text: counts[k] }))));

  box.replaceChildren(
    h('div', { class: 'toolbar notes-bar' },
      search,
      h('button', { class: 'btn small', type: 'button', text: '+ Nova nota', onclick: () => newNote('') }),
      h('button', { class: 'btn ghost small', type: 'button', text: 'Nota do dia', onclick: () => openDiary() }),
      h('button', { class: 'btn ghost small', type: 'button', title: 'Ctrl+O', text: 'Ir para…', onclick: () => quickSwitch() })),
    h('div', { class: 'toolbar notes-bar' }, tabs,
      h('span', { class: 'notes-exp' },
        h('button', { class: 'btn-text', type: 'button', text: 'Exportar para o Obsidian (.zip)', onclick: exportZip }))),
    notesTab === 'notas' ? notesPane(notes, nShown) : notesTab === 'diario' ? diaryPane(dShown) : marksPane(hls, q));
}

/* ---------- Notas ---------- */
function notesPane(all, shown){
  const tagCount = new Map();
  for (const n of all) for (const tg of tagsOf(noteMd(n))) tagCount.set(tg, (tagCount.get(tg) || 0) + 1);
  const tags = [...tagCount].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  const sorted = shown.sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.u || 0) - (a.u || 0));
  return h('div', {},
    tags.length ? h('div', { class: 'tag-row', role: 'group', 'aria-label': 'Etiquetas' },
      h('button', { type: 'button', class: 'chip' + (!notesTag ? ' on' : ''), text: 'Todas', onclick: () => { notesTag = ''; renderNotes(); } }),
      tags.map(([tg, n]) => h('button', { type: 'button', class: 'chip' + (norm(tg) === norm(notesTag) ? ' on' : ''), onclick: () => { notesTag = norm(tg) === norm(notesTag) ? '' : tg; renderNotes(); } }, tg, h('span', { class: 'n', text: n })))) : null,
    !all.length ? h('div', { class: 'empty card' },
      h('h2', { text: 'Nenhuma nota ainda.' }),
      h('p', { text: 'As notas abrem no Escritor: folha limpa, foco por frase, máquina de escrever, ortografia e revisão de estilo. Escreva [[ para ligar uma nota a outra, a um livro ou a uma aula; #etiquetas agrupam. Quem cita a nota aparece em Ligações.' }),
      h('button', { class: 'btn', type: 'button', text: 'Escrever a primeira nota', onclick: () => newNote('') })) :
    !sorted.length ? h('p', { class: 'empty', text: 'Nenhuma nota com esse filtro.' }) :
    h('div', { class: 'note-grid' }, sorted.map(noteCard)));
}
function noteCard(n){
  const md = noteMd(n), title = noteTitle(n);
  const back = backlinks([title]).length;
  const tags = tagsOf(md).slice(0, 4);
  const src = n.src && n.src.label ? n.src.label : '';
  return h('article', { class: 'ncard' + (n.pin ? ' pin' : '') },
    h('button', { type: 'button', class: 'ncard-open', onclick: () => openNote(n.id) },
      h('b', { text: title }),
      h('p', { text: snippet(noteRest(n), 180) || 'Nota vazia' })),
    h('div', { class: 'ncard-meta' },
      n.pin ? h('span', { class: 'tag', text: 'fixada' }) : null,
      h('span', { text: fmtDay(n.u || n.created || Date.now()) }),
      src ? h('span', { text: clip(src, 34) }) : null,
      back ? h('span', { title: 'Notas que citam esta', text: `↩ ${back}` }) : null,
      tags.map(tg => h('button', { type: 'button', class: 'ntag', text: tg, onclick: () => { notesTag = tg; renderNotes(); } }))));
}

/* ---------- Diário ---------- */
function diaryPane(days){
  const today = todayKey();
  return h('div', {},
    h('p', { class: 'muted small notes-help', text: 'O diário de cada dia da rotina. O de hoje também aparece no Hoje; aqui ele abre no Escritor, com [[ligações]] e #etiquetas.' }),
    h('div', { class: 'note-grid' },
      !days.includes(today) ? h('article', { class: 'ncard ghost' }, h('button', { type: 'button', class: 'ncard-open', onclick: () => openDiary(today) }, h('b', { text: diaryTitle(today) }), h('p', { text: 'Ainda em branco. Toque para escrever.' }))) : null,
      days.map(d => h('article', { class: 'ncard' },
        h('button', { type: 'button', class: 'ncard-open', onclick: () => openDiary(d) }, h('b', { text: diaryTitle(d) }), h('p', { text: snippet(state.log[d].diary, 200) })),
        h('div', { class: 'ncard-meta' }, h('span', { text: plural(countWords(state.log[d].diary), 'palavra', 'palavras') }), tagsOf(state.log[d].diary).slice(0, 4).map(tg => h('span', { class: 'ntag', text: tg })))))));
}

/* ---------- Marcações ---------- */
function marksPane(hls, q){
  const items = hls.map(x => ({ x, at: x.created || x.u, s: srcOf(x) }));
  const sources = new Map();
  for (const it of items) if (!sources.has(it.s.k)) sources.set(it.s.k, it.s.label);
  const shown = items.filter(it =>
    (notesKind === 'tudo' || (notesKind === 'hl' && !it.x.note) || (notesKind === 'nota' && it.x.note) || (notesKind === 'aulas' && it.s.k.startsWith('aula:'))) &&
    (!notesColor || it.x.color === notesColor) &&
    (!notesArg || it.s.k === notesArg) &&
    (!q || norm([it.x.text, it.x.note, it.x.tr, it.s.label].join(' ')).includes(q)));
  const groups = new Map();
  for (const it of shown.sort((a, b) => b.at - a.at)){ if (!groups.has(it.s.k)) groups.set(it.s.k, []); groups.get(it.s.k).push(it); }
  const srcSel = h('select', { 'aria-label': 'Origem', onchange: e => { notesArg = e.target.value; renderNotes(); } },
    h('option', { value: '', text: 'Todas as origens' }),
    [...sources].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([k, l]) => h('option', { value: k, selected: k === notesArg, text: clip(l, 50) })));
  const counts = { tudo: items.length, hl: items.filter(i => !i.x.note).length, nota: items.filter(i => i.x.note).length, aulas: items.filter(i => i.s.k.startsWith('aula:')).length };
  return h('div', {},
    h('div', { class: 'toolbar notes-bar' },
      h('div', { class: 'seg' }, [['tudo', 'Tudo'], ['hl', 'Só marcadas'], ['nota', 'Com nota'], ['aulas', 'Das aulas']].map(([k, l]) =>
        h('button', { type: 'button', class: k === notesKind ? 'on' : '', onclick: () => { notesKind = k; renderNotes(); } }, l, h('span', { class: 'n', text: counts[k] })))),
      srcSel,
      h('div', { class: 'color-filter', role: 'group', 'aria-label': 'Cor' },
        h('button', { type: 'button', class: 'cf-all' + (!notesColor ? ' on' : ''), text: 'Todas', onclick: () => { notesColor = ''; renderNotes(); } }),
        HL_COLORS.map(c => h('button', { type: 'button', class: 'cf dot-' + c.id + (notesColor === c.id ? ' on' : ''), title: hlColorName(c.id), 'aria-label': hlColorName(c.id), onclick: () => { notesColor = notesColor === c.id ? '' : c.id; renderNotes(); } })))),
    !items.length ? h('div', { class: 'empty card' }, h('h2', { text: 'Nada marcado ainda.' }), h('p', { text: 'Selecione um trecho de um livro ou de uma aula e escolha uma cor. Tudo o que você marcar aparece aqui.' })) : null,
    ...[...groups].map(([k, list]) => h('section', { class: 'card ngroup' },
      h('div', { class: 'card-head' },
        h('h2', {}, h('button', { type: 'button', class: 'nsrc', text: list[0].s.label, onclick: () => openGroup(k) })),
        h('span', { class: 'pill-muted', text: k.startsWith('aula:') ? 'aula' : 'livro' })),
      h('ol', { class: 'nlist' }, list.map(markItem)))),
    q.length >= 3 ? transcriptHits(q) : null,
    items.length && !shown.length && q.length < 3 ? h('p', { class: 'empty', text: 'Nada com esse filtro.' }) : null);
}
function markItem(it){
  const x = it.x;
  return h('li', { class: 'nitem c-' + x.color + ' s-' + (x.style || 'marca') },
    h('blockquote', { class: 'nq', text: x.text }),
    x.tr ? h('p', { class: 'hl-tr', text: x.tr }) : null,
    x.note ? h('p', { class: 'hl-note', text: x.note }) : null,
    h('div', { class: 'hl-acts' },
      h('span', { class: 'muted small', text: [hlColorName(x.color), it.s.sub, fmtDay(it.at)].filter(Boolean).join(' · ') }),
      h('button', { type: 'button', text: 'Abrir', onclick: () => openSource({ t: 'hl', id: x.id, book: x.book }) }),
      h('button', { type: 'button', text: x.note ? 'Editar nota' : 'Nota', onclick: () => editNote(x.note, v => { x.note = v; putI('hl', x); renderNotes(); }) }),
      h('button', { type: 'button', text: 'Cartão', onclick: () => x.lesson ? lessonCard(getI('lessons', x.lesson) || { name: '', course: '' }, x) : cardFromHl(x) }),
      h('button', { type: 'button', class: 'danger', text: 'Remover', onclick: () => { removeHls([x]); renderNotes(); } })));
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

/* Nota solta antiga (a função ainda é chamada de outros lugares) */
function freeNote(n){ if (n && n.id) openNote(n.id); else newNote(''); }

/* ---------- Exportar ---------- */
const hlMd = x => `> ${x.text.replace(/\n+/g, ' ')}` + (x.page ? ` (p. ${x.page})` : x.lesson ? ` (${fmtClock(x.ms || 0)})` : '') + (x.tr ? `\n>\n> *${x.tr.replace(/\n+/g, ' ')}*` : '') + (x.note ? `\n\n${x.note}` : '') + '\n';
function marksMdOf(kind, it){
  if (kind === 'livro'){
    const b = it, list = hlOf(b.id).sort((x, y) => b.type === 'PDF' ? x.page - y.page : (x.s - y.s) || (x.a - y.a));
    return list.length ? `# ${b.title}\n\n` + (b.author ? `Autor: [[${b.author}]]\n\n` : '') + list.map(hlMd).join('\n') : '';
  }
  const l = it, list = live('hl').filter(x => x.lesson === l.id).sort((a, b) => a.ms - b.ms);
  const marks = (l.marks || []).filter(m => m.note || m.text);
  if (!list.length && !marks.length) return '';
  return `# Aula: ${l.name}\n\n${[l.course, l.professor && `[[${l.professor}]]`, fmtDate(l.created)].filter(Boolean).join(' · ')}\n\n` +
    list.map(hlMd).join('\n') + (marks.length ? '\n' + marks.map(m => `- ${fmtClock(m.ms)} ${[m.text, m.note].filter(Boolean).join(': ')}`).join('\n') + '\n' : '');
}
async function exportZip(){
  if (typeof JSZip === 'undefined'){ toast('O compactador ainda está carregando. Tente de novo.'); return; }
  const zip = new JSZip(), used = new Set();
  const name = (dir, t) => { let base = fileSafe(t) || 'Nota', f = `${dir}${base}.md`, i = 2; while (used.has(norm(f))) f = `${dir}${base} ${i++}.md`; used.add(norm(f)); return f; };
  let n = 0;
  for (const x of notesLive()){
    const md = noteMd(x), title = noteTitle(x);
    // no Obsidian o nome do arquivo já é o título
    const body = norm(titleFromMd(md)) === norm(title) && /^\s*#\s/.test(md) ? noteRest(x) : md;
    const front = x.src && x.src.label ? `---\nfonte: "[[${x.src.label.replace(/"/g, "'")}]]"\n---\n\n` : '';
    zip.file(name('Notas/', title), front + body); n++;
  }
  for (const d of diaryDays()){ zip.file(name('Diário/', d), state.log[d].diary); n++; }
  for (const b of booksSorted()){ const md = marksMdOf('livro', b); if (md){ zip.file(name('Marcações/', b.title), md); n++; } }
  for (const l of lessonsSorted()){ const md = marksMdOf('aula', l); if (md){ zip.file(name('Marcações/', 'Aula - ' + l.name), md); n++; } }
  if (!n){ toast('Nada para exportar ainda.'); return; }
  download(`Caderno - notas ${todayKey()}.zip`, await zip.generateAsync({ type: 'blob' }));
  toast(`${plural(n, 'arquivo', 'arquivos')} no .zip. Descompacte dentro do vault do Obsidian.`);
}
/* Arquivo único, como antes (usado pelo leitor) */
function exportAllMd(){
  let md = `# Caderno: notas e marcações\n\nExportado em ${fmtDate(Date.now())}.\n\n`;
  for (const x of notesLive()) md += `## ${noteTitle(x)}\n\n${noteRest(x)}\n\n`;
  for (const b of booksSorted()) md += marksMdOf('livro', b).replace(/^# /, '## ');
  for (const l of lessonsSorted()) md += marksMdOf('aula', l).replace(/^# /, '## ');
  download('Caderno - notas.md', md);
}
