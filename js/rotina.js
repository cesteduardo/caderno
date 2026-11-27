/* =====================================================================
   Caderno — rotina e progresso
   ---------------------------------------------------------------------
   1. CONFIG    áreas, rotina, planos (com horas estimadas) e recursos
   2. STORE     estado único salvo no localStorage
   3. UTIL      datas, formatação e criação de elementos
   4. CÁLCULOS  progresso do dia, ritmo semanal, fase atual e previsões
   5. VIEWS     uma função render por aba
   6. INÍCIO    roteador, backup e inicialização
   7. SYNC      sincronização entre aparelhos via GitHub Gist + app instalável
   Funciona abrindo o index.html direto no navegador.
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------------
   1. CONFIG
   --------------------------------------------------------------------- */

const STORAGE_KEY = 'caderno-v6'; // v6: ids fixos (sincronização entre aparelhos)
/* O que é pessoal (rotina, planos, trilha de música, recursos, textos e
   o dia em que tudo começou) NÃO fica no código, que é público: fica no
   estado de cada pessoa (state.perfil), salvo no aparelho, no Gist da
   sincronização e no backup. Quem abre o link pela primeira vez começa
   com um Caderno vazio. */
const inicioPlano = () => state.inicio || (state.perfil && state.perfil.inicio) || Object.keys(state.log || {}).sort()[0] || todayKey();

/* Áreas: as de quem usa ficam no perfil (state.perfil.areas); quem chega
   começa com esta lista genérica. Cores com contraste sobre fundo claro. */
const AREAS_PADRAO = [
  { id: 'estudo', name: 'Estudo',      color: '#2f6bed' },
  { id: 'leit',   name: 'Leitura',     color: '#8a6a4f' },
  { id: 'esc',    name: 'Escrita',     color: '#8650d8' },
  { id: 'web',    name: 'Programação', color: '#5458d6' },
  { id: 'design', name: 'Design',      color: '#b07f1f' },
  { id: 'ilu',    name: 'Ilustração',  color: '#d24f8e' },
  { id: 'idioma', name: 'Idiomas',     color: '#109c86' },
  { id: 'musica', name: 'Música',      color: '#de4040' },
  { id: 'saude',  name: 'Saúde',       color: '#22a75a' },
];
const listaAreas = () => (state && state.perfil && state.perfil.areas && state.perfil.areas.length) ? state.perfil.areas : AREAS_PADRAO;
const areaById = id => listaAreas().find(a => a.id === id) || { id, name: 'Outra', color: '#8a8a8f' };

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];  // segunda → domingo
const DAY_NAMES  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const DAY_SHORT  = ['D','S','T','Q','Q','S','S'];
const MONTHS     = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MON_SHORT  = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

/* when: 'manha' | 'noite' aparece como etiqueta na aba Hoje.
   days: 0 = domingo … 6 = sábado. notes: detalhe por dia (opcional). */
const EVERY = [0,1,2,3,4,5,6];
const WHEN = { manha:'Manhã', noite:'Noite' };

// Agrupamento usado pelo filtro da aba Planos
/* Status de cada plano. Com pouco tempo livre, só dois planos andam
   como prioridade; os outros ficam em manutenção ou pausados. */
const STATUS = {
  base:       { name:'Base',       order:0 }, // hábitos fixos
  prioridade: { name:'Prioridade', order:1 },
  manutencao: { name:'Manutenção', order:2 },
  pausado:    { name:'Pausado',    order:3 },
};
/* Tarefa sugerida ao retomar um plano que não tem tarefas guardadas:
   a do perfil, se houver; senão uma genérica. */
const sugerida = (area, nome) => (state.perfil && state.perfil.sugeridas && state.perfil.sugeridas[area]) || { name: nome || areaById(area).name, min: 30, days: [6] };

const PLAN_GROUPS = [
  { id:'all',        name:'Todos' },
  { id:'prioridade', name:'Base e prioridade' },
  { id:'manutencao', name:'Manutenção' },
  { id:'pausado',    name:'Pausados' },
];

/* Biblioteca. Canais abrem a busca do YouTube (links que não quebram). */
const yt = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
/* ---------------------------------------------------------------------
   2. STORE
   --------------------------------------------------------------------- */

const uid = () => Math.random().toString(36).slice(2, 10);

function initialState(){
  return {
    routine: [],
    plans: [],
    // log['AAAA-MM-DD'] = { done: { tarefaId: { min, area } }, diary: '', t: carimbo }
    log: {},
    // tarefas de planos pausados, guardadas por área até a retomada
    parked: {},
    configAt: 0,
    inicio: (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date()),
  };
}

/* Tarefas obrigatórias (required) valem todos os dias. */
function ensureRequired(s){
  for (const t of s.routine || []) if (t.required) t.days = [...EVERY];
  return s;
}

function load(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw){
      const s = JSON.parse(raw);
      if (Array.isArray(s.routine) && Array.isArray(s.plans)) return ensureRequired({ log: {}, parked: {}, ...s });
    }
  } catch (e) { /* sem armazenamento ou dado corrompido: começa do zero */ }
  return initialState();
}

let state = load();

/* save('config') marca mudança de rotina/planos; save('log') marca só
   o dia (que já recebeu seu próprio carimbo de hora em entry.t).
   Os carimbos permitem mesclar dois aparelhos sem perder nada. */
function save(kind = 'config'){
  if (kind === 'config') state.configAt = Date.now();
  saveLocal();
  if (typeof schedulePush === 'function') schedulePush();
}
function saveLocal(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('Não foi possível salvar.', e); }
}

/* ---------------------------------------------------------------------
   3. UTIL
   --------------------------------------------------------------------- */

const $ = sel => document.querySelector(sel);

// Datas como 'AAAA-MM-DD' no fuso local
const toKey   = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromKey = k => { const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); };
const shift   = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); };
const todayKey = () => toKey(new Date());
const mondayOf = k => shift(k, -((fromKey(k).getDay() + 6) % 7));

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const fmtH  = min => nf.format(min / 60) + ' h';                       // 7,3 h
const fmtHM = min => `${Math.floor(min/60)}h${min % 60 ? String(min % 60).padStart(2,'0') : ''}`; // 4h30
const fmtMonth = d => `${MON_SHORT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
const fmtSpan = weeks => weeks < 8 ? `~${Math.max(1, Math.round(weeks))} sem` : `~${Math.round(weeks / 4.35)} meses`;
const countWords = s => (s.trim().match(/\S+/g) || []).length;

/* Cria elementos sem innerHTML: texto do usuário nunca vira HTML.
   h('div', { class:'x', style:{'--c':'red'}, onclick:fn }, 'texto', filho) */
function h(tag, props = {}, ...children){
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)){
    if (v == null || v === false) continue;
    if (k === 'style') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else if (typeof v === 'boolean') el[k] = v;           // checked, hidden…
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const tint = id => ({ '--c': areaById(id).color });

/* Horário (opcional) de cada tarefa: t.at = 'HH:MM'. Sem horário, a tarefa
   segue no grupo da área, como antes. */
const atMin = at => { const m = /^(\d{1,2}):(\d{2})$/.exec(at || ''); return m ? +m[1] * 60 + +m[2] : null; };
const fmtAt = min => { min = ((min % 1440) + 1440) % 1440; const hh = Math.floor(min / 60), mm = min % 60; return hh + 'h' + (mm ? String(mm).padStart(2, '0') : ''); }; // 5h40, 10h
const faixa = t => { const a = atMin(t.at); return a == null ? '' : `${fmtAt(a)} às ${fmtAt(a + t.min)}`; };
// ordem do dia: com horário primeiro, pelo relógio; depois o resto
const porHorario = (a, b) => (atMin(a.at) ?? 1e4) - (atMin(b.at) ?? 1e4);

/* ---------- Animações ----------
   Barras usam transform: scaleX(--p) (roda na GPU, sem recalcular layout).
   Cada barra nasce com o valor anterior (ou 0) e desliza até o novo. */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const barFill = (p, key) => h('i', { 'data-p': String(Math.max(0, Math.min(1, p))), 'data-k': key || null, style: { '--p': '0' } });
function barsOf(root){
  const m = {};
  root?.querySelectorAll('[data-k]').forEach(el => { m[el.dataset.k] = el.style.getPropertyValue('--p') || el.dataset.p; });
  return m;
}
function settleBars(root, prev = {}){
  const els = [...root.querySelectorAll('[data-p]')];
  els.forEach(el => { const k = el.dataset.k; el.style.setProperty('--p', k && prev[k] != null ? prev[k] : (reduceMotion ? el.dataset.p : '0')); });
  requestAnimationFrame(() => requestAnimationFrame(() => els.forEach(el => el.style.setProperty('--p', el.dataset.p))));
}
// Números que contam até o valor novo
function countTo(el, to, suffix = ''){
  const from = parseFloat(el.dataset.v ?? '') || 0;
  el.dataset.v = to;
  cancelAnimationFrame(el._raf);
  if (reduceMotion || from === to){ el.textContent = to + suffix; return; }
  const t0 = performance.now(), dur = 450;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e) + suffix;
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}
const areaChip = id => h('span', { class: 'chip', style: tint(id) }, h('i'), areaById(id).name);

/* ---------------------------------------------------------------------
   4. CÁLCULOS
   --------------------------------------------------------------------- */

const entryFor = k => (state.log[k] ||= { done: {}, diary: '' });
const tasksFor = k => { const wd = fromKey(k).getDay(); return state.routine.filter(t => t.days.includes(wd)); };

/* ---------- Cronômetro de tarefa ----------
   ▶ Iniciar numa tarefa do Hoje (ou num bloco da Agenda) conta o tempo;
   dá para pausar e continuar; marcar como feita registra os minutos reais.
   Fica no dia: entry.run[id] = { ms: tempo acumulado, ini: início da
   contagem em andamento ou null }. Uma tarefa por vez: iniciar outra pausa
   a anterior. Vai junto na sincronização, como o resto do dia. */
const corrida = k => (state.log[k] && state.log[k].run) || {};
function tempoTarefa(id, k = todayKey()){ const r = corrida(k)[id]; return r ? (r.ms || 0) + (r.ini ? Date.now() - r.ini : 0) : 0; }
const tarefaRodando = (k = todayKey()) => Object.keys(corrida(k)).find(id => corrida(k)[id].ini) || null;
const fmtCrono = ms => { const s = Math.floor(ms / 1000), hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); };
function pausarTarefa(id, quieto){
  const e = entryFor(todayKey()), r = e.run && e.run[id];
  if (!r || !r.ini) return;
  r.ms = (r.ms || 0) + Date.now() - r.ini; r.ini = null; e.t = Date.now();
  if (!quieto){ save('log'); aposCronometro(); }
}
function iniciarTarefa(id){
  const k = todayKey(), e = entryFor(k);
  e.run ||= {};
  const outra = tarefaRodando(k);
  if (outra && outra !== id) pausarTarefa(outra, true);
  delete e.done[id];
  const r = e.run[id] ||= { ms: 0, ini: null };
  if (!r.ini) r.ini = Date.now();
  e.t = Date.now(); save('log'); aposCronometro();
}
function concluirTarefa(id){
  const t = state.routine.find(x => x.id === id); if (!t) return;
  pausarTarefa(id, true);
  const e = entryFor(todayKey()), ms = tempoTarefa(id);
  e.done[id] = ms >= 60e3 ? { min: Math.round(ms / 60e3), area: t.area, real: true } : { min: t.min, area: t.area };
  e.t = Date.now(); save('log'); aposCronometro();
}
function aposCronometro(){ if (currentView === 'hoje') renderToday(); else tiqueTarefa(); }
/* a cada segundo: o relógio e a barra da tarefa em andamento, e o título da aba */
function tiqueTarefa(){
  const id = tarefaRodando(), t = id && state.routine.find(x => x.id === id);
  document.querySelectorAll('[data-crono]').forEach(el => {
    const tt = state.routine.find(x => x.id === el.dataset.crono); if (!tt) return;
    const ms = tempoTarefa(tt.id), p = Math.min(1, ms / (tt.min * 60e3));
    const txt = el.querySelector('.crono-txt'); if (txt) txt.textContent = `${fmtCrono(ms)} de ${tt.min} min` + (ms > tt.min * 60e3 ? ` · +${Math.floor((ms - tt.min * 60e3) / 60e3)} min` : '');
    el.style.setProperty('--p', String(p));
    el.classList.toggle('passou-do-tempo', ms > tt.min * 60e3);
  });
  if (typeof FC === 'undefined' || !FC.end) document.title = t ? `▶ ${fmtCrono(tempoTarefa(id))} · ${t.name}` : (document.title.startsWith('▶') ? 'Caderno' : document.title);
  if (t && currentView === 'hoje' && (tiqueTarefa.n = (tiqueTarefa.n || 0) + 1) % 30 === 0) paintTodayStats();
}
setInterval(() => { if (tarefaRodando() || document.querySelector('[data-crono]')) tiqueTarefa(); }, 1000);

/* Ao marcar, guardamos minutos e área da tarefa naquele dia.
   Assim, editar a rotina depois não reescreve o histórico. */
function dayStats(k){
  const tasks = tasksFor(k);
  const done = (state.log[k] && state.log[k].done) || {};
  const planned = tasks.reduce((s, t) => s + t.min, 0);
  const doneTasks = tasks.filter(t => t.id in done);
  /* feitas contam os minutos registrados; a que está em andamento (ou
     pausada) conta o tempo já cronometrado, até a duração prevista */
  const completed = doneTasks.reduce((s, t) => s + (done[t.id].min || t.min), 0)
    + tasks.filter(t => !(t.id in done)).reduce((s, t) => s + Math.min(t.min, Math.floor(tempoTarefa(t.id, k) / 60e3)), 0);
  return { tasks, planned, completed, doneCount: doneTasks.length, ratio: planned ? Math.min(1, completed / planned) : 0 };
}

// Minutos por semana que a rotina dedica a uma área
const weeklyMin = areaId => state.routine.filter(t => t.area === areaId).reduce((s, t) => s + t.min * t.days.length, 0);

// Minutos registrados (tarefas marcadas) por área, em todo o histórico
function investedMin(areaId){
  let m = 0;
  for (const e of Object.values(state.log))
    for (const v of Object.values(e.done || {})) if (v.area === areaId) m += v.min;
  return m;
}

// Fase atual = primeira fase com etapa em aberto (-1 = plano concluído)
/* fase sem etapas ainda não foi feita: conta como aberta */
const currentPhase = plan => plan.phases.findIndex(ph => !ph.steps.length || ph.steps.some(s => !s.done));
const phaseRatio = ph => ph.steps.length ? ph.steps.filter(s => s.done).length / ph.steps.length : 0;

function planProgress(plan){
  const all = plan.phases.flatMap(ph => ph.steps);
  const done = all.filter(s => s.done).length;
  return { done, total: all.length, ratio: all.length ? done / all.length : 0 };
}

/* Previsão: horas que faltam em cada fase (proporcional às etapas em
   aberto) divididas pelo ritmo semanal da área na rotina. */
function forecast(plan){
  const perWeekH = weeklyMin(plan.area) / 60;
  let accWeeks = 0;
  const phases = plan.phases.map(ph => {
    const leftH = ph.hours * (1 - phaseRatio(ph));
    const weeks = perWeekH ? ph.hours / perWeekH : Infinity;   // duração da fase inteira
    accWeeks += perWeekH ? leftH / perWeekH : Infinity;
    return { weeks, endWeeks: accWeeks };
  });
  const end = Number.isFinite(accWeeks) ? fromKey(shift(todayKey() > inicioPlano() ? todayKey() : inicioPlano(), Math.ceil(accWeeks * 7))) : null;
  return { perWeekH, phases, end, totalH: plan.phases.reduce((s, p) => s + p.hours, 0) };
}

// Um dia conta para a sequência se metade dos minutos planejados foi feita
const dayCounts = k => { const s = dayStats(k); return s.planned > 0 && s.ratio >= 0.5; };
function streak(){
  let k = todayKey(), n = 0;
  if (!dayCounts(k)) k = shift(k, -1);            // hoje ainda está em andamento
  while (k >= inicioPlano() && dayCounts(k)){ n++; k = shift(k, -1); }
  return n;
}

/* ---------------------------------------------------------------------
   5. VIEWS
   --------------------------------------------------------------------- */

/* ---------- Status dos planos ↔ rotina ----------
   Pausar tira da semana as tarefas da área e as guarda em state.parked.
   Retomar devolve as guardadas (mesmos ids, então o histórico continua
   ligado) ou cria a tarefa sugerida. Trocar entre Base, Prioridade e
   Manutenção não mexe na rotina. */
const DAY_ABBR = ['dom','seg','ter','qua','qui','sex','sáb'];
const listDays = days => {
  const d = WEEK_ORDER.filter(x => days.includes(x)).map(x => DAY_ABBR[x]);
  return d.length === 7 ? 'todos os dias' : d.length > 1 ? d.slice(0, -1).join(', ') + ' e ' + d[d.length - 1] : d[0] || 'nenhum dia';
};
const weeklyOf = tasks => tasks.reduce((s, t) => s + t.min * t.days.length, 0);

function setPlanStatus(plan, next){
  const prev = plan.status || 'manutencao';
  if (prev === next) return true;

  if (next === 'pausado'){
    const tasks = state.routine.filter(t => t.area === plan.area && !t.required);
    if (tasks.length && !confirm(`Pausar ${plan.name}?\n\n${tasks.length === 1 ? 'A tarefa' : `As ${tasks.length} tarefas`} dessa área (${fmtHM(weeklyOf(tasks))} por semana) saem da rotina e ficam guardadas para quando você retomar.`)) return false;
    state.parked[plan.area] = [...(state.parked[plan.area] || []), ...tasks];
    state.routine = state.routine.filter(t => !tasks.includes(t));
    plan.status = next; save();
    toast(tasks.length ? `${plan.name} pausado. ${fmtHM(weeklyOf(tasks))} por semana liberados.` : `${plan.name} pausado.`);
    return true;
  }

  if (prev === 'pausado'){
    let tasks = state.parked[plan.area] || [];
    const suggested = !tasks.length && sugerida(plan.area, plan.name);
    if (suggested) tasks = [{ id: uid(), area: plan.area, notes: {}, ...JSON.parse(JSON.stringify(suggested)) }];
    delete state.parked[plan.area];
    state.routine.push(...tasks);
    plan.status = next; save();
    const what = tasks.map(t => `${t.min} min, ${listDays(t.days)}`).join('; ');
    toast(tasks.length ? `${plan.name} voltou para a rotina${suggested ? ' com uma sugestão' : ''}: ${what}.` : `${plan.name} retomado.`, 'Ajustar na Semana', () => go('semana'));
    return true;
  }

  plan.status = next; save();
  return true;
}

// Uma tarefa colocada numa área pausada retoma o plano daquela área
function resumeIfPaused(areaId){
  const plan = state.plans.find(p => p.area === areaId && p.status === 'pausado');
  if (!plan) return;
  const parked = state.parked[areaId] || [];
  if (parked.length){ state.routine.push(...parked); delete state.parked[areaId]; }
  plan.status = 'manutencao'; save();
  toast(`${plan.name} saiu da pausa e está em manutenção.` + (parked.length ? ` As tarefas guardadas voltaram.` : ''));
}

// Aviso discreto no rodapé, com ação opcional
let toastTimer;
function toast(msg, actionLabel, action){
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = h('div', { class: 'toast', role: 'status' }, h('span', { text: msg }),
    actionLabel ? h('button', { type: 'button', text: actionLabel, onclick: () => { el.remove(); action(); } }) : null);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  toastTimer = setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 7000);
}

let viewDay = todayKey();


/* Álbum do dia: um álbum de música clássica por dia, todos os dias, da
   discoteca de js/discoteca.js (só gravações de referência) */
function renderTrack(){
  const box = $('#track');
  const a = typeof albumDoDia === 'function' ? albumDoDia(viewDay) : null;
  box.hidden = !a;
  if (!a) return;
  const q = buscaAlbum(a);
  box.replaceChildren(
    h('div', { class: 'track-text' },
      h('span', { class: 'eyebrow', text: `Álbum do dia · ${a.t} · ${a.i + 1} de ${a.n}` }),
      h('b', { text: `${a.c} — ${a.w}` }),
      h('span', { class: 'track-by', text: a.p })),
    h('div', { class: 'track-links' },
      h('a', { href: spotifyBusca(q), target: '_blank', rel: 'noopener', text: 'Spotify ↗' }),
      h('a', { href: ytMusicBusca(q), target: '_blank', rel: 'noopener', text: 'YouTube Music ↗' })));
}

/* ---------- HOJE ---------- */
function renderToday(){
  if (typeof renderStudyToday === 'function') renderStudyToday();
  const d = fromKey(viewDay), wd = d.getDay();
  const isToday = viewDay === todayKey();
  const n = Math.floor((d - fromKey(inicioPlano())) / 864e5) + 1;

  $('#dayIndicator').textContent = n >= 1 ? `${DAY_NAMES[wd]} · dia ${n}` : `${DAY_NAMES[wd]} · o plano começa em ${fromKey(inicioPlano()).getDate()} de ${MONTHS[fromKey(inicioPlano()).getMonth()]}`;
  $('#t-hoje').textContent = isToday ? 'Hoje' : DAY_NAMES[wd];
  $('#dateLabel').textContent = `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  $('#backToday').hidden = isToday;

  const st = paintTodayStats();

  renderTrack();
  if (typeof renderAgenda === 'function') renderAgenda();
  const list = $('#todayList');
  list.replaceChildren();
  if (!state.routine.length) list.append(boasVindas());
  else if (!st.tasks.length) list.append(h('p', { class: 'empty', text: 'Nada planejado para este dia.' }));
  const done = (state.log[viewDay] && state.log[viewDay].done) || {};

  // tarefas agrupadas por área, na ordem das áreas
  // grupos na ordem do dia: manhã, depois o que não tem período, depois noite
  const rank = t => ({ manha: 0, noite: 2 })[t.when] ?? 1;
  const groupRank = id => Math.min(...st.tasks.filter(t => t.area === id).map(rank));
  /* grupos na ordem do relógio: vale a primeira tarefa com horário de cada área (sem horário, vão depois) */
  const primeiraHora = id => Math.min(1e4, ...st.tasks.filter(t => t.area === id).map(t => atMin(t.at) ?? 1e4));
  const areas = listaAreas().filter(a => st.tasks.some(t => t.area === a.id))
                     .sort((a, b) => primeiraHora(a.id) - primeiraHora(b.id) || groupRank(a.id) - groupRank(b.id) || listaAreas().indexOf(a) - listaAreas().indexOf(b));
  // uma linha de tarefa (marcar só mexe nesta linha e nos números do topo)
  const taskRow = (t, comHorario) => {
    const isDone = t.id in done;
    const note = [comHorario && faixa(t), WHEN[t.when], t.notes && t.notes[wd]].filter(Boolean).join(' · ');
    const box = h('input', { type: 'checkbox', class: 'check', checked: isDone, 'aria-label': `${t.name}, ${t.min} minutos` });
    /* cronômetro: só no dia de hoje e em tarefa não feita */
    const run = isToday && !isDone ? corrida(viewDay)[t.id] : null, rodando = !!(run && run.ini);
    const play = isToday && !isDone ? h('button', { class: 'task-play' + (rodando ? ' on' : ''), type: 'button',
      title: rodando ? 'Pausar' : run ? 'Continuar' : 'Iniciar: conta o tempo da tarefa', 'aria-label': rodando ? 'Pausar' : run ? 'Continuar' : 'Iniciar',
      onclick: ev => { ev.preventDefault(); ev.stopPropagation(); rodando ? pausarTarefa(t.id) : iniciarTarefa(t.id); } }, ico(rodando ? 'pause' : 'play')) : null;
    const minFeitos = isDone && done[t.id].real ? done[t.id].min : null;
    const row = h('label', { class: 'row task' + (isDone ? ' done' : '') + (comHorario ? ' timed' : '') + (run ? ' crono' : '') + (rodando ? ' rodando' : ''), style: comHorario ? tint(t.area) : null, 'data-crono': run ? t.id : null },
      box,
      comHorario ? h('span', { class: 'task-at', text: fmtAt(atMin(t.at)) }) : null,
      h('span', { class: 'task-text' }, h('span', { class: 'task-name', text: t.name }),
        run ? h('span', { class: 'task-sub crono-txt', text: '' }) : note ? h('span', { class: 'task-sub', text: note }) : null,
        run ? h('i', { class: 'task-prog' }) : null),
      t.required ? h('span', { class: 'req', text: 'Obrigatório' }) : null,
      play,
      h('span', { class: 'task-min', text: minFeitos != null ? `${minFeitos} de ${t.min} min` : t.min + ' min', title: minFeitos != null ? 'Minutos cronometrados' : null }));
    box.addEventListener('change', () => {
      if (box.checked && isToday){ concluirTarefa(t.id); return; }
      const e = entryFor(viewDay);
      if (box.checked) e.done[t.id] = { min: t.min, area: t.area }; else delete e.done[t.id];
      row.classList.toggle('done', box.checked);
      e.t = Date.now();
      save('log'); renderToday();
    });
    return row;
  };

  for (const area of areas){
    /* dentro da área, na ordem do relógio; a hora aparece na frente (a agenda do dia fica no cartão Agenda, js/agenda.js) */
    const tasks = st.tasks.filter(t => t.area === area.id).sort(porHorario);
    if (!tasks.length) continue;
    const group = h('section', { class: 'group', style: tint(area.id) },
      h('header', { class: 'group-head' }, areaChip(area.id), h('span', { class: 'group-sum', text: tasks.reduce((s, t) => s + t.min, 0) + ' min' })));

    for (const t of tasks) group.append(taskRow(t, atMin(t.at) != null));
    list.append(group);
  }

  // diário: só recarrega o campo quando o dia muda
  const diary = $('#diary');
  if (diary.dataset.day !== viewDay){
    diary.value = (state.log[viewDay] && state.log[viewDay].diary) || '';
    diary.dataset.day = viewDay;
  }
  updateWordCount();
  tiqueTarefa();
}

// Anel e números do topo da aba Hoje
function paintTodayStats(){
  const st = dayStats(viewDay);
  $('#ringFill').style.setProperty('--p', st.ratio);
  $('#diaCard').classList.toggle('completo', st.ratio >= 1);
  countTo($('#ringPct'), Math.round(st.ratio * 100), '%');
  countTo($('#minDone'), st.completed);
  countTo($('#minPlanned'), st.planned);
  countTo($('#minLeft'), Math.max(0, st.planned - st.completed));
  $('#taskCount').textContent = `${st.doneCount}/${st.tasks.length}`;
  return st;
}

function updateWordCount(){
  const n = countWords($('#diary').value);
  $('#wordCount').textContent = `${n.toLocaleString('pt-BR')} ${n === 1 ? 'palavra' : 'palavras'}`;
}
let diaryTimer;
$('#diary').addEventListener('input', e => {
  const entry = entryFor(viewDay);
  entry.diary = e.target.value;
  entry.t = Date.now();
  updateWordCount();
  clearTimeout(diaryTimer);
  diaryTimer = setTimeout(() => { diaryTimer = null; save('log'); }, 400);   // grava depois que você para de digitar
});
const flush = () => { if (diaryTimer){ clearTimeout(diaryTimer); diaryTimer = null; save('log'); } };
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
$('#prevDay').addEventListener('click', () => { viewDay = shift(viewDay, -1); renderToday(); });
$('#nextDay').addEventListener('click', () => { viewDay = shift(viewDay, 1); renderToday(); });
$('#backToday').addEventListener('click', () => { viewDay = todayKey(); renderToday(); });

/* ---------- SEMANA ---------- */
function renderWeek(){
  const ld = $('#semanaLead');
  ld.dataset.padrao ||= ld.textContent;
  ld.textContent = (state.perfil && state.perfil.textoSemana) || ld.dataset.padrao;
  const total = state.routine.reduce((s, t) => s + t.min * t.days.length, 0);
  $('#weekTotal').textContent = fmtHM(total);

  // barra de distribuição (como uma carteira de investimentos)
  const per = listaAreas().map(a => ({ a, m: weeklyMin(a.id) })).filter(x => x.m > 0);
  $('#allocTotal').textContent = `${fmtH(total)} por semana`;
  $('#allocBar').replaceChildren(...per.map(({ a, m }) =>
    h('span', { style: { ...tint(a.id), 'flex-grow': String(m) }, title: `${a.name}: ${fmtHM(m)}` })));
  $('#allocLegend').replaceChildren(...per.map(({ a, m }) =>
    h('li', { style: tint(a.id) }, h('i'), h('span', { text: a.name }), h('b', { text: fmtHM(m) }), h('em', { text: Math.round(m / total * 100) + '%' }))));

  // os sete dias
  const week = $('#week');
  week.replaceChildren();
  const wdToday = new Date().getDay();
  const order = id => listaAreas().findIndex(a => a.id === id);
  for (const wd of WEEK_ORDER){
    const tasks = state.routine.filter(t => t.days.includes(wd)).sort((a, b) => porHorario(a, b) || order(a.area) - order(b.area));
    const sum = tasks.reduce((s, t) => s + t.min, 0);
    week.append(h('div', { class: 'day' + (wd === wdToday ? ' is-today' : '') },
      h('header', { class: 'day-head' }, h('b', { text: DAY_NAMES[wd] }), h('span', { text: fmtHM(sum) })),
      h('div', { class: 'day-slots' }, tasks.map(t =>
        h('div', { class: 'slot', style: tint(t.area), title: [faixa(t), t.name, t.min + ' min'].filter(Boolean).join(' · ') }, h('i'),
          atMin(t.at) != null
            ? h('span', { class: 'slot-text' }, h('span', { class: 'slot-at', text: fmtAt(atMin(t.at)) }), h('span', { class: 'slot-name', text: t.name }))
            : h('span', { class: 'slot-name', text: areaById(t.area).name }),
          h('span', { class: 'slot-min', text: t.min + "'" }))))));
  }
  renderEditor();
}

// Editor: nome, área, horário (opcional), duração e dias de cada tarefa
/* Ordem do dia no editor: as com horário pelo relógio, depois as sem
   horário na ordem da lista. Mover (↑ ↓) segue essa ordem: duas com
   horário trocam de lugar no dia (cada uma mantém a duração, e o vão entre
   elas fica); duas sem horário trocam de posição na lista, que é a ordem
   em que aparecem no Hoje. */
const ordemEditor = () => [...state.routine.filter(t => atMin(t.at) != null).sort(porHorario), ...state.routine.filter(t => atMin(t.at) == null)];
const hhmm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
/* a vem antes de b no dia: b passa para o início de a, e a vem logo depois
   (cada uma com a sua duração; o vão que havia entre as duas continua) */
function trocaHorario(a, b){
  const ini = atMin(a.at), vao = Math.max(0, atMin(b.at) - (ini + a.min));
  b.at = hhmm(ini); a.at = hhmm(ini + b.min + vao);
}
/* Arrastar na Agenda: leva a tarefa à posição "para" entre as tarefas com
   horário daquele dia, trocando de lugar com as vizinhas uma a uma */
function moverNoDia(id, para, k = viewDay){
  const wd = fromKey(k).getDay();
  const dia = () => state.routine.filter(t => t.days.includes(wd) && atMin(t.at) != null).sort(porHorario);
  let lista = dia();
  const t = lista.find(x => x.id === id);
  if (!t) return false;
  para = Math.max(0, Math.min(lista.length - 1, para));
  let i = lista.indexOf(t), guarda = 60;
  if (i === para) return false;
  while (i !== para && guarda--){
    const v = lista[i + (para > i ? 1 : -1)];
    if (para > i) trocaHorario(t, v); else trocaHorario(v, t);
    lista = dia(); i = lista.indexOf(t);
  }
  save();
  if (currentView === 'hoje') renderToday();
  return true;
}
function moverTarefa(t, dir){
  const lista = ordemEditor(), v = lista[lista.indexOf(t) + dir];
  if (!v) return;
  const tH = atMin(t.at) != null, vH = atMin(v.at) != null;
  if (tH && vH){
    if (dir < 0) trocaHorario(v, t); else trocaHorario(t, v);
  } else if (!tH && !vH){
    const r = state.routine, x = r.indexOf(t), y = r.indexOf(v); r[x] = v; r[y] = t;
  } else return;
  save(); renderWeek();
  /* a linha movida pisca de leve e o foco fica no mesmo botão (dá para apertar de novo) */
  const row = document.querySelector(`#editorRows .erow[data-id="${CSS.escape(t.id)}"]`);
  if (row){ row.classList.add('movida'); setTimeout(() => row.classList.remove('movida'), 700); row.querySelector(dir < 0 ? '.mv-cima' : '.mv-baixo')?.focus(); row.scrollIntoView({ block: 'nearest' }); }
}
function renderEditor(){
  const rows = $('#editorRows');
  rows.replaceChildren();
  const ordem = ordemEditor();
  ordem.forEach((t, i) => {
    const name = h('input', { type: 'text', value: t.name, 'aria-label': 'Nome da tarefa' });
    name.addEventListener('change', () => { t.name = name.value.trim() || t.name; save(); renderWeek(); });

    const area = h('select', { 'aria-label': 'Área' }, listaAreas().map(a => h('option', { value: a.id, text: a.name })));
    area.value = t.area;
    area.addEventListener('change', () => { t.area = area.value; save(); resumeIfPaused(t.area); renderWeek(); });

    const min = h('input', { type: 'number', min: '5', step: '5', value: String(t.min), 'aria-label': 'Minutos' });
    min.addEventListener('change', () => { t.min = Math.max(5, parseInt(min.value, 10) || t.min); save(); renderWeek(); });

    const at = h('input', { type: 'time', step: '60', value: t.at || '', 'aria-label': 'Horário (opcional)', title: 'Horário de início (opcional). Apague para tirar.' });
    at.addEventListener('change', () => { if (atMin(at.value) != null) t.at = at.value; else delete t.at; save(); renderWeek(); });

    const days = h('div', { class: 'days', role: 'group', 'aria-label': 'Dias da semana' },
      WEEK_ORDER.map(wd => h('button', {
        type: 'button', text: DAY_SHORT[wd], title: DAY_NAMES[wd], 'aria-pressed': String(t.days.includes(wd)),
        disabled: !!t.required,
        onclick: () => { t.days = t.days.includes(wd) ? t.days.filter(x => x !== wd) : [...t.days, wd]; save(); renderWeek(); },
      })));

    const remove = t.required ? h('span', { class: 'lock', title: 'Tarefa obrigatória', text: '●' }) : h('button', { class: 'x', type: 'button', text: '×', 'aria-label': `Remover ${t.name}`,
      onclick: () => { if (confirm(`Remover "${t.name}" da rotina?`)){ state.routine.splice(state.routine.indexOf(t), 1); save(); renderWeek(); } } });

    /* ↑ ↓: só entre vizinhas do mesmo tipo (com horário com com horário, sem com sem) */
    const temH = atMin(t.at) != null, mesmo = x => x && (atMin(x.at) != null) === temH;
    const mover = h('div', { class: 'erow-mover', role: 'group', 'aria-label': 'Mover' },
      h('button', { class: 'mv-cima', type: 'button', title: temH ? 'Subir: troca de horário com a anterior' : 'Subir', 'aria-label': `Subir ${t.name}`, disabled: !mesmo(ordem[i - 1]), onclick: () => moverTarefa(t, -1) }, ico('chevron-up')),
      h('button', { class: 'mv-baixo', type: 'button', title: temH ? 'Descer: troca de horário com a seguinte' : 'Descer', 'aria-label': `Descer ${t.name}`, disabled: !mesmo(ordem[i + 1]), onclick: () => moverTarefa(t, 1) }, ico('chevron-down')));

    rows.append(h('div', { class: 'erow', style: tint(t.area), 'data-id': t.id },
      h('i', { class: 'erow-dot' }), name, area, h('label', { class: 'at-field' }, at), h('label', { class: 'min-field' }, min, h('span', { text: 'min' })), days, mover, remove));
  });
}
$('#addTask').addEventListener('click', () => {
  state.routine.push({ id: uid(), area: 'web', name: 'Nova tarefa', min: 30, days: [1,2,3,4,5], notes: {} });
  save(); renderWeek();
  const inputs = document.querySelectorAll('#editorRows input[type=text]');
  inputs[inputs.length - 1]?.select();
});

/* ---------- PLANOS ---------- */
let planGroup = 'all';
const openPhase = {}; // fase exibida por plano (padrão: a atual)

function renderPlans(){
  // filtro segmentado
  $('#planFilters').replaceChildren(...PLAN_GROUPS.map(g => h('button', {
    type: 'button', text: g.name, 'aria-pressed': String(planGroup === g.id),
    onclick: () => { planGroup = g.id; renderPlans(); },
  })));

  const order = p => (STATUS[p.status] || STATUS.manutencao).order;
  const inGroup = p => planGroup === 'all' || (p.status || 'manutencao') === planGroup || (planGroup === 'prioridade' && p.status === 'base');
  const list = state.plans.filter(inGroup).sort((a, b) => order(a) - order(b));

  $('#planCount').textContent = state.plans.length || '';
  const wrap = $('#plans');
  const prev = barsOf(wrap);
  wrap.replaceChildren(...(list.length ? list.map(planCard) : [h('p', { class: 'empty', text: state.plans.length ? 'Nenhum plano aqui.' : 'Nenhum plano ainda. Um plano é um objetivo longo dividido em fases com horas estimadas; a previsão sai do tempo que a rotina dá para a área.' })]),
    h('div', { class: 'plan-novo' }, h('button', { class: 'btn', type: 'button', text: '+ Novo plano', onclick: novoPlano })));
  settleBars(wrap, prev);
}

/* Novo plano: nome, área, objetivo e a primeira fase (as etapas entram
   no próprio cartão, no campo "adicionar etapa") */
function novoPlano(){
  const nome = h('input', { type: 'text', placeholder: 'Ex.: Ler os clássicos russos', maxlength: 80 });
  const area = h('select', {}, listaAreas().map(a => h('option', { value: a.id, text: a.name })));
  const meta = h('textarea', { rows: 3, placeholder: 'Aonde você quer chegar, e em quanto tempo' });
  const fase = h('input', { type: 'text', value: 'Fase 1', maxlength: 60 });
  const horas = h('input', { type: 'number', min: 1, max: 999, value: 20 });
  modal('Novo plano', h('div', { class: 'form' },
    h('label', {}, 'Nome', nome), h('label', {}, 'Área', area), h('label', {}, 'Objetivo', meta),
    h('div', { class: 'form-row' }, h('label', {}, 'Primeira fase', fase), h('label', {}, 'Horas', horas))), [
    { label: 'Cancelar' },
    { label: 'Criar plano', primary: true, onclick: () => {
      if (!nome.value.trim()){ nome.focus(); return false; }
      const id = 'p-' + uid();
      state.plans.push({ id, area: area.value, name: nome.value.trim(), goal: meta.value.trim(), guide: null, status: 'prioridade',
        phases: [{ name: fase.value.trim() || 'Fase 1', hours: Math.max(1, +horas.value || 20), steps: [] }] });
      save(); planGroup = 'all'; renderPlans();
    } },
  ]);
}

/* Caderno vazio (primeira visita): o que fazer primeiro */
function boasVindas(){
  return h('div', { class: 'boas-vindas' },
    h('h2', { text: 'Seu Caderno começa vazio.' }),
    h('p', { text: 'Tudo o que você puser aqui fica só neste aparelho (e, se quiser, no seu GitHub, pela sincronização). Comece pela rotina da semana, ou traga o que já tem.' }),
    h('div', { class: 'row-btns' },
      h('button', { class: 'btn', type: 'button', text: 'Montar a rotina', onclick: () => { go('semana'); setTimeout(() => $('#addTask')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200); } }),
      h('button', { class: 'btn ghost', type: 'button', text: 'Importar um backup', onclick: () => $('#fileImport').click() }),
      h('button', { class: 'btn ghost', type: 'button', text: 'Ligar a sincronização', onclick: () => go('progresso') })));
}

/* Redesenha só o cartão de um plano (marcar etapa, trocar de fase,
   adicionar ou remover etapa). As barras continuam de onde estavam. */
function refreshPlan(plan, focusAdd = false){
  const old = document.querySelector(`.plan[data-id="${plan.id}"]`);
  if (!old) return renderPlans();
  const prev = barsOf(old);
  const guideOpen = old.querySelector('details.guide')?.open;
  const fresh = planCard(plan);
  if (guideOpen) fresh.querySelector('details.guide').open = true;
  old.replaceWith(fresh);
  settleBars(fresh, prev);
  if (focusAdd) fresh.querySelector('input.add')?.focus();
}

function planCard(plan){
  const prog = planProgress(plan);
  const cur = currentPhase(plan);
  const fc = forecast(plan);
  const shown = openPhase[plan.id] ?? (cur === -1 ? plan.phases.length - 1 : cur);

  // seletor de status (pausar/retomar mexe na rotina, ver setPlanStatus)
  const status = h('select', { class: 'status-select s-' + (plan.status || 'manutencao'), 'aria-label': `Status de ${plan.name}` },
    Object.entries(STATUS).map(([id, s]) => h('option', { value: id, text: s.name })));
  status.value = plan.status || 'manutencao';
  status.addEventListener('change', () => {
    if (!setPlanStatus(plan, status.value)) status.value = plan.status || 'manutencao';
    renderPlans();
  });

  const head = h('header', { class: 'plan-head' },
    h('div', {}, h('div', { class: 'plan-tags' }, areaChip(plan.area), status), h('h2', { text: plan.name }), h('p', { class: 'plan-goal', text: plan.goal })),
    h('div', { class: 'plan-pct' }, h('b', { text: Math.round(prog.ratio * 100) + '%' }), h('span', { text: `${prog.done} de ${prog.total} etapas` })));

  if (plan.status === 'pausado'){
    return h('article', { class: 'card plan is-paused', 'data-id': plan.id, style: tint(plan.area) }, head,
      h('p', { class: 'paused-note', text: `Fase ${cur === -1 ? plan.phases.length : cur + 1} de ${plan.phases.length} · ${plan.phases.reduce((s, p) => s + p.hours, 0)} h no total. Para retomar, mude o status: ${(state.parked[plan.area] || []).length ? 'as tarefas guardadas voltam para a rotina' : 'entra uma tarefa sugerida na rotina'}.` }));
  }

  // fases: cada uma é um botão que mostra suas etapas
  const stepper = h('div', { class: 'stepper', role: 'tablist' }, plan.phases.map((ph, i) => {
    const status = cur === -1 || i < cur ? 'done' : i === cur ? 'current' : 'next';
    const eta = fc.phases[i];
    return h('button', {
      type: 'button', role: 'tab', class: `phase ${status}` + (i === shown ? ' open' : ''), 'aria-selected': String(i === shown),
      onclick: () => { openPhase[plan.id] = i; refreshPlan(plan); },
    },
      h('span', { class: 'phase-num', text: String(i + 1).padStart(2, '0') }),
      h('span', { class: 'phase-name', text: ph.name }),
      h('span', { class: 'phase-meta', text: `${ph.hours} h · ${Number.isFinite(eta.weeks) ? fmtSpan(eta.weeks) : 'sem ritmo'}` }),
      h('span', { class: 'mini' }, barFill(phaseRatio(ph), 'ph' + i)),
      status === 'current' ? h('span', { class: 'tag', text: 'Fase atual' }) : status === 'done' ? h('span', { class: 'tag tag-done', text: 'Concluída' }) : null);
  }));

  // etapas da fase aberta
  const ph = plan.phases[shown];
  const steps = h('ul', { class: 'steps' });
  ph.steps.forEach((s, j) => {
    const id = 'st-' + s.id;
    const box = h('input', { type: 'checkbox', class: 'check', id, checked: s.done });
    box.addEventListener('change', () => {
      s.done = box.checked;
      // ao concluir a fase aberta, acompanha o avanço para a próxima
      if (openPhase[plan.id] === shown && phaseRatio(ph) === 1) delete openPhase[plan.id];
      save(); refreshPlan(plan);
    });
    steps.append(h('li', { class: 'row' + (s.done ? ' done' : '') },
      box, h('label', { for: id, text: s.text }),
      h('button', { class: 'x', type: 'button', text: '×', 'aria-label': `Remover ${s.text}`,
        onclick: () => { ph.steps.splice(j, 1); save(); refreshPlan(plan); } })));
  });
  const add = h('input', { type: 'text', class: 'add', placeholder: '+ Adicionar etapa' });
  add.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !add.value.trim()) return;
    ph.steps.push({ id: uid(), text: add.value.trim(), done: false });
    save(); refreshPlan(plan, true);
  });

  const invested = investedMin(plan.area);
  return h('article', { class: 'card plan', 'data-id': plan.id, style: tint(plan.area) },
    head,
    h('div', { class: 'bar' }, barFill(prog.ratio, 'total')),
    h('dl', { class: 'plan-facts' },
      h('div', {}, h('dt', { text: 'Ritmo' }), h('dd', { text: fc.perWeekH ? fmtHM(Math.round(fc.perWeekH * 60)) + '/sem' : 'Fora da rotina' })),
      h('div', {}, h('dt', { text: 'Investido' }), h('dd', { text: `${fmtH(invested).replace(' h', '')} / ${fc.totalH} h` })),
      h('div', {}, h('dt', { text: 'Previsão' }), h('dd', { text: cur === -1 ? 'Concluído' : fc.end ? fmtMonth(fc.end) : '—' }))),
    stepper,
    h('div', { class: 'steps-box' },
      h('div', { class: 'steps-head' }, h('b', { text: ph.name }), h('span', { text: `${ph.steps.filter(s => s.done).length} de ${ph.steps.length}` })),
      steps, add),
    plan.guide ? h('details', { class: 'guide' },
      h('summary', {}, h('b', { text: 'Guia de treino' }), h('span', { text: 'Treinos A e B, mobilidade e regras' })),
      h('div', { class: 'guide-grid' }, plan.guide.map(([title, items]) =>
        h('div', { class: 'guide-block' }, h('h3', { text: title }), h('ul', {}, items.map(t => h('li', { text: t }))))))) : null);
}

/* ---------- RECURSOS ---------- */
function renderLibrary(){
  /* tudo daqui vem do perfil de quem usa; sem perfil, a aba explica */
  const pf = state.perfil || {};
  const adv = $('#v-recursos .advice'), cyc = $('#v-recursos .cycle');
  if (pf.textoRecursos) $('#recursosLead').textContent = pf.textoRecursos;
  adv.hidden = !pf.conselho;
  if (pf.conselho){
    adv.querySelector('.eyebrow').textContent = pf.conselho.rotulo || '';
    adv.querySelector('h2').textContent = pf.conselho.titulo || '';
    adv.querySelector('.advice-grid').replaceChildren(...(pf.conselho.itens || []).map(t => { const q = document.createElement('p'); q.innerHTML = t; return q; }));
  }
  /* a discoteca inteira, em blocos de 7 a partir de hoje (o de hoje primeiro) */
  const disco = typeof DISCOTECA !== 'undefined' ? DISCOTECA : [];
  cyc.hidden = !disco.length;
  if (!cyc.hidden){
    cyc.querySelector('h2').textContent = 'Discoteca';
    cyc.querySelector('.pill-muted').textContent = `${disco.length} álbuns · um por dia`;
    cyc.querySelector('.cycle-lead').textContent = 'Música clássica de todos os tipos, só gravações de referência. Um álbum por dia, todos os dias; a lista recomeça quando acaba. Cada nome abre no Spotify; o ▶ ao lado, no YouTube Music.';
  }
  const hojeK = todayKey(), semanas = [];
  for (let d = 0; d < disco.length; d++){
    const k = shift(hojeK, d), a = albumDoDia(k), dt = fromKey(k);
    if (d % 7 === 0) semanas.push([]);
    semanas[semanas.length - 1].push({ a, rot: d === 0 ? 'Hoje' : `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}` });
  }
  $('#trackCycle').replaceChildren(...semanas.map((sem, i) => h('div', { class: 'cycle-week' },
    h('h3', { text: i === 0 ? 'Esta semana' : `Daqui a ${i} ${i === 1 ? 'semana' : 'semanas'}` }),
    h('ol', {}, sem.map(({ a, rot }) => h('li', {},
      h('span', { class: 'cycle-day', text: rot }),
      h('a', { href: spotifyBusca(buscaAlbum(a)), target: '_blank', rel: 'noopener' },
        h('b', { text: `${a.c} — ${a.w}` }), h('span', { text: `${a.p} · ${a.t}` })),
      h('a', { class: 'cycle-yt', href: ytMusicBusca(buscaAlbum(a)), target: '_blank', rel: 'noopener', title: 'Abrir no YouTube Music', 'aria-label': 'YouTube Music', text: '▶' })))))));
  const lib = $('#resourceList');
  const RESOURCES = pf.recursos || [];
  lib.hidden = !RESOURCES.length;
  $('#recursosVazio').hidden = !!RESOURCES.length;
  lib.replaceChildren(...RESOURCES.map((r, i) => {
    const inner = [
      h('span', { class: 'idx-num', text: String(i + 1).padStart(2, '0') }),
      h('span', { class: 'idx-main' }, h('b', { text: r.name }), h('span', { text: r.desc })),
      h('span', { class: 'idx-kind' + (r.kind === 'Curso principal' ? ' main' : ''), text: r.kind }),
      areaChip(r.area),
      h('span', { class: 'arrow', text: r.url ? '→' : '' }),
    ];
    return r.url
      ? h('a', { class: 'row idx', href: r.url, target: '_blank', rel: 'noopener', style: tint(r.area) }, inner)
      : h('div', { class: 'row idx', style: tint(r.area) }, inner);
  }));
}

/* ---------- PROGRESSO ---------- */
function renderProgress(){
  renderSyncCard();
  const prevBars = barsOf($('#hours'));
  const tk = todayKey(), mon = mondayOf(tk);

  // horas desta semana por área (planejado x feito)
  const done = {}, plan = {};
  let wDone = 0, wPlan = 0;
  for (let i = 0; i < 7; i++){
    const k = shift(mon, i);
    const dn = (state.log[k] && state.log[k].done) || {};
    for (const t of tasksFor(k)){ plan[t.area] = (plan[t.area] || 0) + t.min; wPlan += t.min; }
    for (const v of Object.values(dn)){ done[v.area] = (done[v.area] || 0) + v.min; wDone += v.min; }
  }
  let total = 0; for (const e of Object.values(state.log)) for (const v of Object.values(e.done || {})) total += v.min;
  const steps = state.plans.reduce((a, p) => { const g = planProgress(p); return [a[0] + g.done, a[1] + g.total]; }, [0, 0]);
  const s = streak();

  $('#stats').replaceChildren(...[
    ['Sequência', `${s}`, s === 1 ? 'dia' : 'dias'],
    ['Esta semana', fmtH(wDone).replace(' h', ''), `h de ${fmtH(wPlan)}`],
    ['Total investido', fmtH(total).replace(' h', ''), 'horas'],
    ['Etapas', `${steps[0]}`, `de ${steps[1]}`],
  ].map(([label, big, unit]) => h('div', { class: 'stat' }, h('span', { text: label }), h('b', {}, big, h('small', { text: ' ' + unit })))));

  // últimos 28 dias
  const sq = $('#streakSquares');
  sq.replaceChildren();
  for (let i = 27; i >= 0; i--){
    const k = shift(tk, -i), st = dayStats(k);
    sq.append(h('i', { class: (st.ratio >= 0.5 ? 'on' : st.ratio > 0 ? 'half' : '') + (i === 0 ? ' today' : ''),
      title: `${fromKey(k).toLocaleDateString('pt-BR')} · ${Math.round(st.ratio * 100)}%` }));
  }

  // 26 semanas desde o início do plano
  const map = $('#weeksMap');
  map.replaceChildren();
  for (let w = 0; w < 26; w++){
    const m = shift(mondayOf(inicioPlano()), w * 7);
    let p = 0, c = 0;
    for (let d = 0; d < 7; d++){ const k = shift(m, d); if (k > tk) continue; const st = dayStats(k); p += st.planned; c += st.completed; }
    const r = p ? c / p : 0, future = m > mon;
    const lv = future || !r ? 0 : r >= 0.75 ? 3 : r >= 0.4 ? 2 : 1;
    map.append(h('div', { class: 'wk' + (future ? ' future' : '') + (m === mon ? ' cur' : ''), 'data-lv': String(lv),
      title: `Semana ${w + 1} · ${fromKey(m).toLocaleDateString('pt-BR')}` + (future ? '' : ` · ${Math.round(r * 100)}%`) }));
  }

  $('#hours').replaceChildren(...listaAreas().filter(a => plan[a.id]).map(a => {
    const v = done[a.id] || 0, p = plan[a.id];
    return h('div', { class: 'hrow', style: tint(a.id) },
      areaChip(a.id),
      h('div', { class: 'bar' }, barFill(v / p, 'h-' + a.id)),
      h('span', { class: 'hrow-val' }, h('b', { text: fmtH(v) }), ` / ${fmtH(p)}`));
  }));
  settleBars($('#hours'), prevBars);
}

/* ---------------------------------------------------------------------
   6. INÍCIO
   --------------------------------------------------------------------- */

const VIEWS = { hoje: renderToday, semana: renderWeek, planos: renderPlans, recursos: renderLibrary, progresso: renderProgress };
const navFor = view => [...document.querySelectorAll('.nav-tabs button')].find(b => b.dataset.view === view || (b.dataset.group || '').split(' ').includes(view));

// Pílula escura que desliza até a aba ativa
const navInd = document.querySelector('.nav-ind');
function moveNavInd(animate = true){
  const b = document.querySelector('.nav-tabs button[aria-current="page"]');
  if (!b || !navInd) return;
  navInd.classList.toggle('no-anim', !animate);
  navInd.style.width = b.offsetWidth + 'px';
  navInd.style.transform = `translateX(${b.offsetLeft}px)`;
}
addEventListener('resize', () => moveNavInd(false));
document.fonts?.ready.then(() => moveNavInd(false));

let currentView = null;
function go(view, arg){
  if (!VIEWS[view]) view = 'hoje';
  const first = currentView === null;
  currentView = view;
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + view));
  const nb = navFor(view);
  document.querySelectorAll('.nav-tabs button').forEach(b =>
    b === nb ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (typeof onViewChange === 'function') onViewChange(view);
  moveNavInd(!first);
  const hash = '#' + view + (arg ? '/' + arg : '');
  if (location.hash !== hash) history.pushState(null, '', hash);
  VIEWS[view](arg);
  window.scrollTo(0, 0);
}
document.querySelectorAll('.nav-tabs button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
// Endereço com #aba (e o botão voltar do navegador) também troca de aba
window.addEventListener('hashchange', () => { const [v, a] = location.hash.slice(1).split('/'); if (!document.querySelector('#v-' + v)?.classList.contains('on') || a) go(v, a && decodeURIComponent(a)); });

/* backup (exportar/importar) fica em js/app.js: inclui o estudo */

// Ao voltar para a aba depois da meia-noite, "Hoje" passa a ser o novo dia
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && $('#v-hoje').classList.contains('on')) renderToday();
});

/* ---------------------------------------------------------------------
   7. SYNC — sincronização entre aparelhos via GitHub Gist
   ---------------------------------------------------------------------
   Os dados ficam num Gist secreto da sua conta (um arquivo caderno.json).
   Cada aparelho guarda o token só no próprio navegador. Fluxo:
     · ao abrir e ao voltar para a página: baixa, mescla e, se preciso, envia
     · depois de cada mudança: envia (com 3 s de espera, para agrupar)
   Mesclagem: cada dia fica com a versão mais recente (entry.t); rotina e
   planos ficam com a configuração mais recente (configAt).
   --------------------------------------------------------------------- */

function mergeStates(a, b){
  const base = (a.configAt || 0) > (b.configAt || 0) ? a : b;   // empate: vale a versão de fora (b)
  const out = JSON.parse(JSON.stringify({ ...base, log: {} }));
  out.configAt = Math.max(a.configAt || 0, b.configAt || 0);
  const days = new Set([...Object.keys(a.log || {}), ...Object.keys(b.log || {})]);
  for (const k of days){
    const x = (a.log || {})[k], y = (b.log || {})[k];
    out.log[k] = JSON.parse(JSON.stringify(!y ? x : !x ? y : ((y.t || 0) > (x.t || 0) ? y : x)));
  }
  /* perfil: vale o mais recente; quem não tem perfil não apaga o do outro */
  const pa = a.perfil, pb = b.perfil;
  out.perfil = pa && pb ? JSON.parse(JSON.stringify((pa.t || 0) > (pb.t || 0) ? pa : pb)) : JSON.parse(JSON.stringify(pa || pb || null));
  if (!out.perfil) delete out.perfil;
  const ini = [a.inicio, b.inicio, out.perfil && out.perfil.inicio].filter(Boolean).sort();
  if (ini.length) out.inicio = ini[0];
  return ensureRequired({ parked: {}, ...out });
}

const SYNC_KEY  = 'caderno-sync';
const GIST_FILE = 'caderno.json';
const GIST_ESTUDO = 'estudo.json';
const GIST_DESC = 'Caderno · sincronização (não apagar)';
let sync = (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch (e) { return {}; } })();
const saveSync = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); } catch (e) {} };

async function gh(path, opts = {}){
  const r = await fetch('https://api.github.com' + path, {
    ...opts, cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + sync.token, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (r.status === 401) throw new Error('token');
  if (r.status === 404) throw new Error('404');
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

// Primeiro aparelho cria o Gist; os outros o encontram pela descrição
async function ensureGist(){
  if (sync.gistId) return;
  const list = await gh('/gists?per_page=100');
  const found = list.find(g => g.description === GIST_DESC && g.files && g.files[GIST_FILE]);
  if (found) sync.gistId = found.id;
  else {
    const created = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: GIST_DESC, public: false, files: { [GIST_FILE]: { content: JSON.stringify(state) } } }) });
    sync.gistId = created.id;
  }
  saveSync();
}

async function pullRemote(){
  const g = await gh('/gists/' + sync.gistId);
  const rd = async f => f ? JSON.parse(f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content) : null;
  return { rotina: await rd(g.files[GIST_FILE]), estudo: await rd(g.files[GIST_ESTUDO]) };
}

let syncing = null, again = false, pushTimer;
async function syncNow(){
  if (!sync.token) return;
  if (syncing){ again = true; return syncing; }        // uma de cada vez
  setSyncStatus('busy');
  syncing = (async () => {
    try {
      await ensureGist();
      let remote = null;
      try { remote = await pullRemote(); }
      catch (e){ if (e.message !== '404') throw e; sync.gistId = null; await ensureGist(); }
      const r = remote && remote.rotina;
      const antes = JSON.stringify(state);
      const merged = r ? mergeStates(state, r) : state;
      /* ajustes pessoais (js/ajustes.js): só depois de mesclar com o Gist */
      if (typeof ajustesPessoais === 'function') ajustesPessoais(merged);
      const mStr = JSON.stringify(merged);
      if (mStr !== antes){ state = merged; saveLocal(); refreshView(); }
      const files = {};
      if (!r || mStr !== JSON.stringify(r)) files[GIST_FILE] = { content: mStr };
      // estudo (livros, destaques, notas, cartões e aulas) vai num segundo arquivo do mesmo Gist
      const es = typeof estudoForSync === 'function' ? estudoForSync(remote && remote.estudo) : null;
      if (es) files[GIST_ESTUDO] = { content: es };
      if (Object.keys(files).length)
        await gh('/gists/' + sync.gistId, { method: 'PATCH', body: JSON.stringify({ files }) });
      sync.lastAt = Date.now(); sync.error = null; saveSync();
      setSyncStatus('ok');
    } catch (e) {
      sync.error = e.message === 'token' ? 'Token inválido ou sem permissão de Gist.' : navigator.onLine === false ? 'Sem internet. Tento de novo quando voltar.' : 'Não consegui falar com o GitHub (' + e.message + ').';
      saveSync(); setSyncStatus('error');
    } finally {
      syncing = null;
      if (again){ again = false; syncNow(); }
    }
  })();
  return syncing;
}
function schedulePush(){
  if (!sync.token) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, 3000);
}

// Redesenha a aba atual depois de receber dados de outro aparelho
function refreshView(){
  const d = $('#diary');
  if (document.activeElement !== d) d.dataset.day = '';
  if (currentView) VIEWS[currentView]();
}

// Status no cartão de sincronização e no rodapé
function setSyncStatus(kind){
  const foot = $('#syncFoot');
  const t = sync.lastAt ? new Date(sync.lastAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  const text = !sync.token ? 'Só neste aparelho'
    : kind === 'busy' ? 'Sincronizando…'
    : kind === 'error' ? 'Erro na sincronização'
    : t ? `Sincronizado às ${t}` : 'Sincronização ativa';
  if (foot){ foot.textContent = text; foot.dataset.state = !sync.token ? 'off' : kind; }
  if (currentView === 'progresso') renderSyncCard();
}

function renderSyncCard(){
  const box = $('#syncCard');
  if (!box) return;
  if (!sync.token){
    const input = h('input', { type: 'password', placeholder: 'Cole aqui o token do GitHub', autocomplete: 'off', 'aria-label': 'Token do GitHub' });
    const go_ = h('button', { class: 'btn', type: 'button', text: 'Conectar', onclick: async () => {
      const token = input.value.trim();
      if (!token) return input.focus();
      sync = { token }; saveSync();
      await syncNow();
      if (sync.error){ toast(sync.error); sync = {}; saveSync(); }
      else toast('Sincronização ativa neste aparelho.');
      renderSyncCard(); setSyncStatus(sync.token ? 'ok' : 'off');
    } });
    box.replaceChildren(
      h('p', { class: 'sync-lead', text: 'Para ver o mesmo progresso no PC e no celular. Os dados ficam num Gist secreto da sua conta do GitHub; o token fica só neste navegador.' }),
      h('ol', { class: 'sync-steps' },
        h('li', {}, 'Crie um token clássico só com a permissão ', h('b', { text: 'gist' }), ': ',
          h('a', { href: 'https://github.com/settings/tokens/new?scopes=gist&description=Caderno', target: '_blank', rel: 'noopener', text: 'abrir no GitHub ↗' })),
        h('li', { text: 'Cole o token abaixo e conecte. Repita em cada aparelho, com o mesmo token.' })),
      h('div', { class: 'sync-form' }, input, go_));
    return;
  }
  const t = sync.lastAt ? new Date(sync.lastAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  box.replaceChildren(
    h('div', { class: 'sync-state' + (sync.error ? ' is-error' : '') },
      h('i'), h('div', {}, h('b', { text: sync.error ? 'Erro na sincronização' : 'Sincronização ativa' }),
        h('span', { text: sync.error || `Última sincronização: ${t}` }))),
    h('div', { class: 'sync-actions' },
      h('button', { class: 'btn', type: 'button', text: 'Sincronizar agora', onclick: () => syncNow() }),
      h('button', { class: 'btn-text', type: 'button', text: 'Desconectar este aparelho', onclick: () => {
        if (!confirm('Desconectar este aparelho? Os dados continuam aqui e no GitHub; só para de sincronizar.')) return;
        sync = {}; saveSync(); setSyncStatus('off'); renderSyncCard();
      } })));
}

// Sincroniza ao abrir, ao voltar para a página e quando a internet volta
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
addEventListener('online', () => syncNow());

// App instalável e offline (só quando servido por http/https, ex.: no seu site)
if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

/* a inicialização fica em js/app.js, depois dos outros módulos */
