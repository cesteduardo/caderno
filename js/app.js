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
      h('b', { text: focoAtivo() ? 'Em andamento' : (FOCO_MODOS.find(m => m.id === FP.modo) || FOCO_MODOS[0]).nome }),
      h('span', { class: 'muted small', text: focoAtivo() ? (FC.label || 'toque para voltar') : 'tela limpa, sem distração' })),
  ];
  box.replaceChildren(h('div', { class: 'st-grid' }, tiles));
}

/* ---------- Foco ----------
   Um bloco cronometrado em tela limpa. Modos prontos (Pomodoro, Foco
   profundo, Sessão longa), Livre (você escolhe os minutos) e Cronômetro
   (conta para cima). Pausas entre ciclos, som ambiente gerado aqui mesmo
   (ruído marrom, rosa ou branco), sino entre as etapas e tela cheia. Os
   minutos de foco ficam no dia (entrada .foco) e, se o bloco veio de uma
   tarefa, no fim dá para marcá-la como feita. */
const FOCO_MODOS = [
  { id: 'pomodoro', nome: 'Pomodoro', icone: 'timer', foco: 25, pausa: 5, longa: 15, ciclos: 4, desc: '25 min e 5 de pausa, quatro vezes; a quarta pausa é longa' },
  { id: 'profundo', nome: 'Foco profundo', icone: 'brain', foco: 50, pausa: 10, longa: 10, ciclos: 2, desc: '50 min e 10 de pausa, duas vezes' },
  { id: 'longa', nome: 'Sessão longa', icone: 'hourglass', foco: 90, pausa: 15, longa: 15, ciclos: 1, desc: '90 min corridos, para leitura densa ou escrita' },
  { id: 'livre', nome: 'Livre', icone: 'target', foco: 30, pausa: 0, longa: 0, ciclos: 1, desc: 'Você escolhe quantos minutos' },
  { id: 'cronometro', nome: 'Cronômetro', icone: 'infinity', foco: 0, pausa: 0, longa: 0, ciclos: 1, desc: 'Conta para cima até você encerrar' },
];
const FOCO_SONS = [['', 'Silêncio'], ['marrom', 'Marrom'], ['rosa', 'Rosa'], ['branco', 'Branco']];
const FP_KEY = 'caderno-foco';
const FP = { modo: 'pomodoro', livre: 30, som: '', volume: .35, telaCheia: false, sino: true };
try { Object.assign(FP, JSON.parse(localStorage.getItem(FP_KEY) || '{}')); } catch (e) {}
const saveFP = () => { try { localStorage.setItem(FP_KEY, JSON.stringify(FP)); } catch (e) {} };
const FC = { el: $('#focus'), end: 0, left: 0, total: 0, inicio: 0, fase: 'foco', ciclo: 1, plano: null, task: null, label: '', t: 0, feitos: 0, mudo: false };
const focoAtivo = () => !!(FC.end || FC.left || FC.inicio);

function focusSetup(taskPre){
  if (focoAtivo()){ showFocus(); return; }
  const tasks = tasksFor(todayKey()).filter(t => !((state.log[todayKey()] || {}).done || {})[t.id]);
  let modo = FP.modo, task = taskPre || null;
  const intencao = h('input', { type: 'text', placeholder: 'O que você vai fazer neste bloco?', value: task ? task.name : '', maxlength: 120, 'aria-label': 'Intenção' });
  const sel = h('select', { 'aria-label': 'Ligar a uma tarefa de hoje' }, h('option', { value: '', text: 'Nenhuma tarefa' }),
    tasks.map(t => h('option', { value: t.id, selected: task && t.id === task.id, text: `${t.name} · ${t.min} min` })));
  sel.addEventListener('change', () => { task = tasks.find(t => t.id === sel.value) || null; if (task && !intencao.value.trim()) intencao.value = task.name; });
  const livre = h('input', { type: 'number', min: 5, max: 240, step: 5, value: FP.livre, 'aria-label': 'Minutos' });
  const cartoes = h('div', { class: 'fo-modos', role: 'radiogroup', 'aria-label': 'Modo' });
  const pinta = () => {
    cartoes.replaceChildren(...FOCO_MODOS.map(m => h('button', { type: 'button', role: 'radio', 'aria-checked': String(m.id === modo), class: 'fo-modo' + (m.id === modo ? ' on' : ''), onclick: () => { modo = m.id; pinta(); } },
      ico(m.icone), h('b', { text: m.nome }), h('small', { text: m.desc }))));
    linhaLivre.hidden = modo !== 'livre';
  };
  const linhaLivre = h('label', { class: 'fo-linha' }, h('span', { text: 'Minutos' }), livre);
  const som = h('div', { class: 'seg' });
  const pintaSom = () => som.replaceChildren(...FOCO_SONS.map(([v, l]) => h('button', { type: 'button', class: v === FP.som ? 'on' : '', text: l, onclick: () => { FP.som = v; saveFP(); pintaSom(); somTocar(v, true); } })));
  pintaSom();
  const vol = h('input', { type: 'range', min: 0, max: 1, step: .05, value: FP.volume, 'aria-label': 'Volume do som', oninput: e => { FP.volume = +e.target.value; saveFP(); somVolume(); } });
  const chave = (rot, k) => h('label', { class: 'fo-chave' }, h('input', { type: 'checkbox', class: 'check', checked: !!FP[k], onchange: e => { FP[k] = e.target.checked; saveFP(); } }), h('span', { text: rot }));
  pinta();
  modal('Foco', h('div', { class: 'fo' },
    h('section', {}, h('h3', { text: 'Modo' }), cartoes, linhaLivre),
    h('section', { class: 'fo-duas' },
      h('div', {}, h('h3', { text: 'Intenção' }), intencao, h('div', { class: 'fo-sel' }, sel)),
      h('div', {}, h('h3', { text: 'Som ambiente (ruído)' }), som, h('label', { class: 'fo-linha' }, ico('volume-2'), vol))),
    h('section', { class: 'fo-chaves' }, chave('Tela cheia ao começar', 'telaCheia'), chave('Sino ao fim de cada etapa', 'sino'))), [
    { label: 'Cancelar', onclick: () => somParar() },
    { label: 'Começar', primary: true, onclick: () => {
      FP.modo = modo; FP.livre = Math.max(5, Math.min(240, +livre.value || 30)); saveFP();
      const m = { ...FOCO_MODOS.find(x => x.id === modo) };
      if (modo === 'livre') m.foco = FP.livre;
      whenClosed(() => startFocus(m, task, intencao.value.trim()));
    } },
  ], { wide: true, onclose: () => { if (!focoAtivo()) somParar(); } });
}

function startFocus(plano, task, intencao){
  Object.assign(FC, { plano, task, label: intencao || (task ? task.name : ''), fase: 'foco', ciclo: 1, feitos: 0, mudo: false });
  etapa();
  if (FP.telaCheia) try { document.documentElement.requestFullscreen?.(); } catch (e) {}
  somTocar(FP.som);
  showFocus();
  clearInterval(FC.t); FC.t = setInterval(focusTick, 250);
}
/* começa a etapa atual (foco ou pausa) do zero */
function etapa(){
  const p = FC.plano;
  if (p.id === 'cronometro'){ Object.assign(FC, { inicio: Date.now(), end: 0, left: 0, total: 0 }); return; }
  const min = FC.fase === 'foco' ? p.foco : (FC.ciclo % 4 === 0 ? p.longa : p.pausa);
  Object.assign(FC, { total: min * 60e3, end: Date.now() + min * 60e3, left: 0, inicio: 0 });
}
function showFocus(){
  if (FC.el.hidden){
    FC.el.hidden = false; document.body.classList.add('reading'); wantAwake(true);
    pushLayer(() => { FC.el.hidden = true; document.body.classList.remove('reading'); wantAwake(false); renderStudyToday(); });
  }
  paintFocus();
}
const restante = () => FC.plano && FC.plano.id === 'cronometro' ? (FC.inicio ? Date.now() - FC.inicio : FC.left) : (FC.end ? FC.end - Date.now() : FC.left);
function paintFocus(){
  const p = FC.plano, cron = p.id === 'cronometro', pausa = FC.fase === 'pausa';
  const rodando = cron ? !!FC.inicio : !!FC.end;
  const fase = cron ? 'Cronômetro' : pausa ? (FC.ciclo % 4 === 0 ? 'Pausa longa' : 'Pausa') : 'Foco';
  const ciclo = !cron && p.ciclos > 1 ? ` · ${Math.min(FC.ciclo, p.ciclos)} de ${p.ciclos}` : '';
  const b = (icone, rot, acao, cls) => h('button', { class: 'fc-b' + (cls ? ' ' + cls : ''), type: 'button', title: rot, 'aria-label': rot, onclick: acao }, ico(icone), h('span', { text: rot }));
  FC.el.classList.toggle('em-pausa', pausa);
  FC.el.replaceChildren(
    h('div', { class: 'fc-in' },
      h('span', { class: 'fc-fase', text: fase + ciclo }),
      FC.label ? h('h2', { class: 'fc-int', text: FC.label }) : null,
      h('b', { class: 'fc-clock', id: 'fcClock', text: fmtClock(Math.max(0, restante())) }),
      cron ? null : h('div', { class: 'fc-bar' }, h('i', { id: 'fcBar' })),
      h('div', { class: 'fc-acts' },
        b(rodando ? 'pause' : 'play', rodando ? 'Pausar' : 'Continuar', () => focoPausa(), 'principal'),
        cron ? null : b('plus', '5 min', () => { if (FC.end) FC.end += 5 * 60e3; else FC.left += 5 * 60e3; FC.total += 5 * 60e3; focusTick(); }),
        cron ? null : b('skip-forward', pausa ? 'Pular pausa' : 'Pular etapa', () => etapaFim(true)),
        FP.som ? b(FC.mudo ? 'volume-x' : 'volume-2', FC.mudo ? 'Som' : 'Silenciar', () => { FC.mudo = !FC.mudo; somVolume(); paintFocus(); }) : null,
        b('square', 'Encerrar', () => endFocus(false)),
        b('minimize-2', 'Minimizar', () => popLayer())),
      h('p', { class: 'fc-dica', text: 'Espaço pausa · Esc minimiza. O foco continua contando enquanto você usa o resto do Caderno.' })));
  focusTick();
}
function focoPausa(){
  if (FC.plano.id === 'cronometro'){ if (FC.inicio){ FC.left = Date.now() - FC.inicio; FC.inicio = 0; } else { FC.inicio = Date.now() - FC.left; FC.left = 0; } }
  else if (FC.end){ FC.left = FC.end - Date.now(); FC.end = 0; } else { FC.end = Date.now() + FC.left; FC.left = 0; }
  paintFocus();
}
function focusTick(){
  if (!FC.plano) return;
  const r = restante();
  const c = $('#fcClock'), bar = $('#fcBar');
  if (c) c.textContent = fmtClock(Math.max(0, r));
  if (bar && FC.total) bar.style.transform = `scaleX(${Math.min(1, 1 - r / FC.total).toFixed(4)})`;
  document.title = FC.el.hidden && focoAtivo() ? `${fmtClock(Math.max(0, r))} · Caderno` : 'Caderno';
  if (FC.end && r <= 0) etapaFim(false);
}
/* fim de uma etapa: foco vira pausa, pausa vira o próximo foco */
function etapaFim(pulou){
  const p = FC.plano;
  if (FC.fase === 'foco'){
    const feito = Math.round((FC.total - Math.max(0, restante())) / 60e3);
    focoRegistra(feito);
    if (FC.ciclo >= p.ciclos || !p.pausa){ endFocus(true); return; }
    FC.fase = 'pausa';
  } else { FC.fase = 'foco'; FC.ciclo++; }
  if (FP.sino && !pulou) sino();
  etapa(); paintFocus();
}
function focoRegistra(min){
  if (!(min > 0)) return;
  FC.feitos += min;
  const e = entryFor(todayKey()); e.foco = (e.foco || 0) + min; e.t = Date.now(); save('log');
}
function endFocus(done){
  clearInterval(FC.t);
  if (!done && FC.plano){
    if (FC.plano.id === 'cronometro') focoRegistra(Math.round(restante() / 60e3));
    else if (FC.fase === 'foco') focoRegistra(Math.round((FC.total - Math.max(0, restante())) / 60e3));
  }
  const task = FC.task, feitos = FC.feitos;
  Object.assign(FC, { end: 0, left: 0, inicio: 0, task: null, plano: null });
  document.title = 'Caderno';
  somParar();
  try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {}
  if (!FC.el.hidden) popLayer();
  if (done){
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
    if (FP.sino) sino();
  }
  if (task) toast(`${feitos ? feitos + ' min de foco. ' : ''}Marcar “${task.name}” como feita?`, 'Marcar', () => {
    const e = entryFor(todayKey()); e.done[task.id] = { min: task.min, area: task.area }; e.t = Date.now(); save('log');
    if (currentView === 'hoje') renderToday();
  });
  else if (feitos) toast(`${feitos} min de foco hoje neste bloco. Levante, beba água, e volte.`);
  renderStudyToday();
}
document.addEventListener('keydown', e => {
  if (FC.el.hidden || !FC.plano || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.key === ' '){ e.preventDefault(); focoPausa(); }
  else if (e.key === 'Escape'){ e.preventDefault(); popLayer(); }
});

/* Sino: duas notas suaves (não precisa de arquivo de áudio) */
function sino(){
  try {
    const ac = new AudioContext();
    [[660, 0], [880, .18]].forEach(([f, t0]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, ac.currentTime + t0); g.gain.exponentialRampToValueAtTime(.16, ac.currentTime + t0 + .02);
      g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + t0 + 1.6);
      o.connect(g).connect(ac.destination); o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + 1.7);
    });
    setTimeout(() => ac.close(), 2200);
  } catch (e) {}
}
/* Som ambiente: ruído gerado num buffer de 4 s que se repete */
const SOM = { ac: null, src: null, g: null, tipo: '' };
function somTocar(tipo, amostra){
  somParar();
  if (!tipo) return;
  try {
    const ac = SOM.ac = new AudioContext(), n = ac.sampleRate * 4, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    let ult = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++){
      const w = Math.random() * 2 - 1;
      if (tipo === 'branco') d[i] = w * .5;
      else if (tipo === 'marrom'){ ult = (ult + .02 * w) / 1.02; d[i] = ult * 3.2; }
      else { b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926; }
    }
    SOM.src = ac.createBufferSource(); SOM.src.buffer = buf; SOM.src.loop = true;
    SOM.g = ac.createGain(); SOM.tipo = tipo; somVolume();
    SOM.src.connect(SOM.g).connect(ac.destination); SOM.src.start();
    if (amostra) setTimeout(() => { if (!focoAtivo()) somParar(); }, 2500);
  } catch (e) {}
}
function somVolume(){ if (SOM.g) SOM.g.gain.value = FC.mudo ? 0 : FP.volume * FP.volume; }
function somParar(){ try { SOM.src && SOM.src.stop(); SOM.ac && SOM.ac.close(); } catch (e) {} Object.assign(SOM, { ac: null, src: null, g: null, tipo: '' }); }

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

/* ---------- Trazer do Caderno antigo ----------
   O primeiro Caderno (grbrands.com.br/caderno) guarda tudo no navegador,
   num endereço que este app não consegue ler. A página levar.html de lá
   lê esses dados e os devolve aqui por postMessage; o resultado se mescla
   com o que já existe, como uma importação (nada é apagado). */
const ORIGEM_ANTIGA = 'https://grbrands.com.br';
function trazerDoAntigo(rot){
  if (!rot || !Array.isArray(rot.routine) || !Array.isArray(rot.plans)){ toast('Não reconheci os dados do Caderno antigo.'); return false; }
  state = mergeStates(state, rot); saveLocal(); save('log');
  toast('Rotina, planos e progresso do Caderno antigo trazidos para cá.');
  refreshView();
  return true;
}
addEventListener('message', (e) => {
  if (e.origin !== ORIGEM_ANTIGA || !e.data || e.data.tipo !== 'caderno-antigo') return;
  trazerDoAntigo(e.data.estado);
});
$('#btnAntigo').addEventListener('click', () => {
  const w = window.open(ORIGEM_ANTIGA + '/caderno/levar.html', 'caderno-antigo', 'width=480,height=560');
  if (!w) toast('O navegador bloqueou a janela. Libere os pop-ups deste site e tente de novo.');
  else toast('Abri o Caderno antigo numa janela: ele manda seus dados para cá sozinho.');
});

/* ---------- Diário no Escritor ---------- */
$('#diaryOpen').addEventListener('click', () => {
  const e = entryFor(viewDay);
  e.diary = $('#diary').value; e.t = Date.now(); save('log');
  openDiary(viewDay);
});

/* ---------- Início ---------- */
(async () => {
  await loadE();
  /* sem sincronização, os ajustes pessoais da rotina valem já (com ela, depois de mesclar com o Gist) */
  if (!sync.token && typeof ajustesPessoais === 'function' && ajustesPessoais(state)) saveLocal();
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

/* ---------- Barra do topo ----------
   Ir para (Ctrl+O) e Foco à direita; o fio de baixo só aparece depois
   de rolar, como no Escritor. */
$('#navIr').addEventListener('click', () => { if ($('#modal').hidden) quickSwitch(); });
$('#navFoco').addEventListener('click', () => focusSetup());
const marcaRolagem = () => document.body.classList.toggle('rolou', scrollY > 4);
addEventListener('scroll', marcaRolagem, { passive: true });
marcaRolagem();

/* ---------- Tema: automático (segue o sistema), claro ou escuro ---------- */
const TEMAS = [['auto', 'sun-moon', 'Tema automático (segue o sistema)'], ['claro', 'sun', 'Tema claro'], ['escuro', 'moon', 'Tema escuro']];
const escuroAtivo = () => document.documentElement.dataset.tema === 'escuro' || (!document.documentElement.dataset.tema && matchMedia('(prefers-color-scheme: dark)').matches);
function temaPinta(){
  let t = 'auto'; try { t = localStorage.getItem('caderno-tema') || 'auto'; } catch (e) {}
  const [, icone, nome] = TEMAS.find(x => x[0] === t) || TEMAS[0];
  const b = $('#navTema'); b.replaceChildren(ico(icone)); b.title = nome + ' · clique para trocar'; b.setAttribute('aria-label', nome);
  if (!document.body.classList.contains('reading')) document.querySelector('meta[name="theme-color"]').content = escuroAtivo() ? '#191a1c' : '#ffffff';
  if (typeof RD !== 'undefined' && RD.eng && RS.theme === 'auto'){ applyRS(); }
}
$('#navTema').addEventListener('click', () => {
  let t = 'auto'; try { t = localStorage.getItem('caderno-tema') || 'auto'; } catch (e) {}
  const prox = TEMAS[(TEMAS.findIndex(x => x[0] === t) + 1) % TEMAS.length][0];
  try { prox === 'auto' ? localStorage.removeItem('caderno-tema') : localStorage.setItem('caderno-tema', prox); } catch (e) {}
  if (prox === 'auto') delete document.documentElement.dataset.tema; else document.documentElement.dataset.tema = prox;
  temaPinta();
  toast(TEMAS.find(x => x[0] === prox)[2] + '.');
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', temaPinta);
temaPinta();
