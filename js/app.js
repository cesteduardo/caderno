/* =====================================================================
   App: junta rotina e estudo
   ---------------------------------------------------------------------
   abas novas no roteador, subnavegação da Rotina, painel de estudo do
   Hoje, foco (pomodoro), backup e inicialização.
   ===================================================================== */
'use strict';

Object.assign(VIEWS, { ler: renderBooks, aulas: renderLessons, aula: renderLesson, revisar: renderReviewHome, notas: renderNotes });

/* ---------- Rotina: subnavegação ---------- */
const ROTINA = [['semana', 'Semana'], ['planos', 'Planos'], ['recursos', 'Recursos'], ['progresso', 'Progresso']];
function onViewChange(view){
  selbar.hide();
  if (ROTINA.some(r => r[0] === view)){
    document.querySelectorAll(`#v-${view} [data-sub]`).forEach(box => box.replaceChildren(...ROTINA.map(([k, l]) =>
      h('button', { type: 'button', class: k === view ? 'on' : '', 'aria-current': k === view ? 'page' : null, text: l, onclick: () => go(k) }))));
  }
  if (view !== 'aula') player.on && player.a && player.a.pause();
}

/* ---------- Hoje: estudo ---------- */
function renderStudyToday(){
  const box = $('#studyToday');
  if (!box) return;
  if (viewDay !== todayKey()){ box.replaceChildren(); return; }
  const now = Date.now(), cards = live('cards');
  const due = cards.filter(c => isDueCard(c, now)).length + Math.min(Math.max(0, NOVOS_DIA() - newToday()), cards.filter(isNew).length);
  const book = booksSorted().find(b => b.last);
  const lesson = lessonsSorted()[0];
  const tiles = [
    h('button', { class: 'st-tile' + (due ? ' hot' : ''), type: 'button', onclick: () => due ? startReview() : go('revisar') },
      h('span', { class: 'eyebrow', text: 'Revisar' }),
      h('b', { text: due ? plural(due, 'cartão', 'cartões') : cards.length ? 'Em dia' : 'Sem cartões' }),
      h('span', { class: 'muted small', text: due ? `uns ${Math.max(1, Math.round(due * .25))} min` : cards.length ? 'os próximos voltam amanhã' : 'nascem dos seus destaques' })),
    book ? h('button', { class: 'st-tile', type: 'button', onclick: () => openBook(book.id) },
      h('span', { class: 'eyebrow', text: 'Continuar lendo' }),
      h('b', { text: clip(book.title, 48) }),
      h('span', { class: 'bar' }, h('i', { style: { width: Math.round((book.pct || 0) * 100) + '%' } }))) :
      h('button', { class: 'st-tile', type: 'button', onclick: () => go('ler') }, h('span', { class: 'eyebrow', text: 'Ler' }), h('b', { text: 'Adicionar um livro' }), h('span', { class: 'muted small', text: 'EPUB, PDF ou TXT' })),
    LIVE.l ? h('button', { class: 'st-tile hot', type: 'button', onclick: () => go('aula', LIVE.l.id) }, h('span', { class: 'eyebrow', text: 'Gravando agora' }), h('b', { text: clip(LIVE.l.name, 48) }), h('span', { class: 'muted small lclock', text: fmtClock(elapsed()) })) :
    lesson ? h('button', { class: 'st-tile', type: 'button', onclick: () => go('aula', lesson.id) },
      h('span', { class: 'eyebrow', text: 'Última aula' }),
      h('b', { text: clip(lesson.name, 48) }),
      h('span', { class: 'muted small', text: [lesson.course, fmtDay(lesson.created)].filter(Boolean).join(' · ') })) :
      h('button', { class: 'st-tile', type: 'button', onclick: () => go('aulas') }, h('span', { class: 'eyebrow', text: 'Aulas' }), h('b', { text: 'Gravar uma aula' }), h('span', { class: 'muted small', text: 'transcrição no aparelho' })),
    h('button', { class: 'st-tile', type: 'button', onclick: () => focusSetup() },
      h('span', { class: 'eyebrow', text: 'Foco' }),
      h('b', { text: FC.end ? 'Em andamento' : '25 min' }),
      h('span', { class: 'muted small', text: FC.end ? FC.label : 'tela limpa, sem distração' })),
  ];
  box.replaceChildren(h('div', { class: 'st-grid' }, tiles));
}

/* ---------- Foco ----------
   Contagem regressiva em tela cheia. No fim, se veio de uma tarefa da
   rotina, oferece marcar a tarefa como feita. */
const FC = { end: 0, left: 0, total: 0, task: null, label: '', t: 0, el: $('#focus') };
function focusSetup(){
  if (FC.end || FC.left){ showFocus(); return; }
  const tasks = tasksFor(todayKey()).filter(t => !((state.log[todayKey()] || {}).done || {})[t.id]);
  let min = 25, task = null;
  const sel = h('select', { 'aria-label': 'Tarefa' }, h('option', { value: '', text: 'Sem tarefa' }), tasks.map(t => h('option', { value: t.id, text: `${t.name} · ${t.min} min` })));
  const seg = h('div', { class: 'seg' });
  const paint = () => seg.replaceChildren(...[15, 25, 50].map(m => h('button', { type: 'button', class: m === min ? 'on' : '', text: m + ' min', onclick: () => { min = m; paint(); } })));
  sel.addEventListener('change', () => { task = tasks.find(t => t.id === sel.value) || null; if (task){ min = Math.min(90, task.min); paint(); } });
  paint();
  modal('Foco', h('div', { class: 'form' }, h('label', {}, 'Para quê', sel), h('div', {}, h('span', { class: 'muted small', text: 'Duração' }), seg),
    h('p', { class: 'muted small', text: 'A tela fica acesa e limpa. Ao terminar, a tarefa pode ser marcada como feita.' })), [
    { label: 'Cancelar' },
    { label: 'Começar', primary: true, onclick: () => { whenClosed(() => startFocus(min, task)); } },
  ]);
}
function startFocus(min, task){
  Object.assign(FC, { total: min * 60e3, end: Date.now() + min * 60e3, left: 0, task, label: task ? task.name : 'Foco' });
  showFocus();
  clearInterval(FC.t); FC.t = setInterval(focusTick, 500);
}
function showFocus(){
  FC.el.hidden = false; document.body.classList.add('reading'); wantAwake(true);
  pushLayer(() => { FC.el.hidden = true; document.body.classList.remove('reading'); wantAwake(false); renderStudyToday(); });
  paintFocus();
}
function paintFocus(){
  const left = FC.end ? FC.end - Date.now() : FC.left;
  FC.el.replaceChildren(
    h('div', { class: 'fc-in' },
      h('span', { class: 'eyebrow', text: FC.label }),
      h('b', { class: 'fc-clock', id: 'fcClock', text: fmtClock(Math.max(0, left)) }),
      h('div', { class: 'bar fc-bar' }, h('i', { id: 'fcBar', style: { width: (100 * (1 - left / FC.total)).toFixed(1) + '%' } })),
      h('div', { class: 'fc-acts' },
        h('button', { class: 'btn ghost', type: 'button', text: FC.end ? 'Pausar' : 'Continuar', onclick: () => {
          if (FC.end){ FC.left = FC.end - Date.now(); FC.end = 0; } else { FC.end = Date.now() + FC.left; FC.left = 0; }
          paintFocus();
        } }),
        h('button', { class: 'btn ghost', type: 'button', text: 'Encerrar', onclick: () => endFocus(false) }),
        h('button', { class: 'btn ghost', type: 'button', text: 'Minimizar', onclick: () => popLayer() }))));
}
function focusTick(){
  if (!FC.end) return;
  const left = FC.end - Date.now();
  const c = $('#fcClock'), b = $('#fcBar');
  if (c) c.textContent = fmtClock(Math.max(0, left));
  if (b) b.style.width = (100 * (1 - left / FC.total)).toFixed(1) + '%';
  if (left <= 0) endFocus(true);
}
function endFocus(done){
  clearInterval(FC.t);
  const task = FC.task;
  Object.assign(FC, { end: 0, left: 0, task: null });
  if (!FC.el.hidden) popLayer();
  if (done){
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
    try { const ac = new AudioContext(), o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 660; g.gain.setValueAtTime(.15, ac.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + 1.2); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 1.2); } catch (e) {}
    if (task) toast(`Foco concluído. Marcar “${task.name}” como feita?`, 'Marcar', () => {
      const e = entryFor(todayKey()); e.done[task.id] = { min: task.min, area: task.area }; e.t = Date.now(); save('log');
      if (currentView === 'hoje') renderToday();
    });
    else toast('Foco concluído. Levante, beba água, e volte.');
  }
  renderStudyToday();
}

/* ---------- Backup ----------
   Exporta rotina e estudo num arquivo. Importar mescla (não apaga nada):
   aceita o backup do Caderno antigo, o deste app e as aulas exportadas
   do Caderno Inteligente (tools/exportar-transcrito.py). */
$('#btnExport').addEventListener('click', () => {
  const data = { tipo: 'caderno', versao: 2, exportado: new Date().toISOString(), rotina: state, estudo: E };
  download(`caderno-${todayKey()}.json`, JSON.stringify(data), 'application/json');
  toast('Backup salvo. Os arquivos dos livros e o áudio das aulas não vão junto; ficam neste aparelho.');
});
$('#btnImport').addEventListener('click', () => $('#fileImport').click());
$('#fileImport').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  let d;
  try { d = JSON.parse(await f.text()); } catch (err) { toast('Arquivo inválido: não é um JSON.'); return; }
  const msg = [];
  if (d && d.tipo === 'caderno-estudo' && Array.isArray(d.lessons)){
    let n = 0;
    for (const l of d.lessons){
      const old = E.lessons[l.id];
      if (old && !old.del && (old.u || 0) >= (l.u || 0)) continue;
      for (const sg of l.segs || []) sg.text = trocar(sg.text);
      for (const k of ['summary', 'oneLiner']) if (l[k]) l[k] = trocar(l[k]);
      l.keyPoints = (l.keyPoints || []).map(trocar);
      E.lessons[l.id] = { ...l, u: Math.max(l.u || 0, Date.now()) }; n++;
    }
    saveE(true);
    msg.push(n ? `${plural(n, 'aula importada', 'aulas importadas')}` : 'As aulas já estavam aqui');
  } else {
    const rot = d && d.tipo === 'caderno' ? d.rotina : d && Array.isArray(d.routine) && Array.isArray(d.plans) ? d : null;
    if (rot){ state = mergeStates(state, rot); saveLocal(); save('log'); msg.push('rotina mesclada'); }
    if (d && d.tipo === 'caderno' && d.estudo){ E = mergeE(E, d.estudo); saveE(true); msg.push('estudo mesclado'); }
    if (!msg.length){ toast('Não reconheci este arquivo.'); return; }
  }
  toast(msg.join(' · ') + '.');
  refreshView();
});

/* ---------- Início ---------- */
(async () => {
  await loadE();
  afterRemoteMerge = () => { if (currentView === 'aula' && LIVE.l) return; refreshView(); };
  const [v, a] = location.hash.slice(1).split('/');
  go(VIEWS[v] ? v : 'hoje', a && decodeURIComponent(a));
  setSyncStatus(sync.token ? 'ok' : 'off');
  syncNow();
  await resumePending();
  for (const l of live('lessons')) if ((l.pend || []).length && !l.err) for (const ms of l.pend) TQ.add(l.id, ms);
  for (const l of live('lessons')) if (!(l.pend || []).length && l.needFicha) finishFicha(l);
})();

// refreshView da rotina chama VIEWS[v]() sem argumento: a aula aberta continua
const _rv = refreshView;
refreshView = function(){ if (currentView === 'aula'){ renderLesson(curLesson, true); return; } _rv(); };
