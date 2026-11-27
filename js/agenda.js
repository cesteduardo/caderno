/* Agenda do dia: os horários fixos do dono do Caderno (o app é pessoal desde
   27/11/2026, então a agenda pode ficar no código). state.perfil.agenda, se
   existir, tem a palavra final.
   hora/fim em "HH:MM"; dias = 0 (dom) a 6 (sáb), sem dias = todos;
   desde = primeiro dia em que o bloco vale (YYYY-MM-DD). */
const UTEIS = [1, 2, 3, 4, 5];
const AGENDA = [
  { hora: '05:30', nome: 'Acordar' },
  { hora: '05:40', nome: 'Terço' },
  { hora: '06:05', nome: 'Bíblia' },
  { hora: '06:30', nome: 'Literatura' },
  { hora: '06:55', nome: 'Espresso e música' },
  { hora: '07:10', fim: '08:10', nome: 'Aula da EFESC' },
  { hora: '08:10', fim: '08:25', nome: 'Escrever' },
  { hora: '09:55', fim: '10:00', nome: 'Preparar para sair', dias: UTEIS },
  { hora: '10:00', fim: '10:21', nome: 'Caminhada para o trabalho', dias: UTEIS },
  { hora: '10:30', fim: '21:30', nome: 'Trabalho', dias: UTEIS, desde: '2026-11-27' },
];

/* De onde vem a agenda: os horários das tarefas da rotina (editáveis em
   Rotina → Editar rotina), com os marcos que não são tarefa (Acordar).
   Sem nenhuma tarefa com horário, vale state.perfil.agenda ou a lista acima. */
const MARCOS = [{ hora: '05:30', nome: 'Acordar' }];
const somaHora = (hhmm, min) => { const t = paraMin(hhmm) + (min || 0); return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const agendaBase = () => {
  const comHora = (state.routine || []).filter(t => /^\d{1,2}:\d{2}$/.test(t.at || ''));
  if (comHora.length) return [...MARCOS.map(m => ({ ...m, marco: true })), ...comHora.map(t => ({ hora: t.at, fim: somaHora(t.at, t.min), nome: t.name, dias: t.days, area: t.area, id: t.id }))];
  return (state.perfil && Array.isArray(state.perfil.agenda) && state.perfil.agenda.length) ? state.perfil.agenda : AGENDA;
};
const paraMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const fmtHora = s => { const [h, m] = s.split(':').map(Number); return h + 'h' + (m ? String(m).padStart(2, '0') : ''); };

// blocos do dia, em ordem, cada um com início e fim em minutos
function agendaDoDia(dia){
  const wd = fromKey(dia).getDay();
  const itens = agendaBase()
    .filter(b => (!b.dias || b.dias.includes(wd)) && (!b.desde || dia >= b.desde))
    .slice().sort((a, b) => paraMin(a.hora) - paraMin(b.hora));
  return itens.map((b, i) => {
    const ini = paraMin(b.hora);
    const prox = itens[i + 1] ? paraMin(itens[i + 1].hora) : ini + 15;
    return { ...b, ini, fimMin: b.fim ? paraMin(b.fim) : Math.max(ini, prox) };
  });
}

function renderAgenda(){
  const box = $('#agenda');
  if (!box || AG.arrastando) return;
  const itens = agendaDoDia(viewDay);
  box.hidden = !itens.length;
  if (!itens.length) return;
  const agora = new Date(), hoje = viewDay === todayKey();
  const m = agora.getHours() * 60 + agora.getMinutes();
  /* Blocos: cada um com a cor da área, a faixa de horário e a duração. O
     de agora ganha contorno, o tempo que falta e uma barra que enche; os
     que passaram ficam apagados; blocos longos (Trabalho) ocupam duas casas. */
  const dur = min => min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}` : `${min} min`;
  const lista = h('ol', { class: 'ag-blocos' }, ...itens.map(b => {
    const estado = !hoje ? '' : b.marco ? (m >= b.ini ? ' passou' : '') : m >= b.fimMin ? ' passou' : m >= b.ini ? ' agora' : '';
    const total = b.fimMin - b.ini;
    const agora = estado === ' agora';
    const cor = b.area && typeof areaById === 'function' ? { '--c': areaById(b.area).color } : null;
    /* cronômetro da tarefa (rotina.js): ▶ no bloco; em andamento, o tempo e a barra seguem o cronômetro */
    const log = (state.log[viewDay] && state.log[viewDay].done) || {};
    const feito = b.id && b.id in log;
    const run = b.id && hoje && !feito && typeof corrida === 'function' ? corrida(viewDay)[b.id] : null, rodando = !!(run && run.ini);
    const play = b.id && hoje && !feito ? h('button', { class: 'ag-play' + (rodando ? ' on' : ''), type: 'button', title: rodando ? 'Pausar' : run ? 'Continuar' : 'Iniciar: conta o tempo da tarefa', 'aria-label': rodando ? 'Pausar' : run ? 'Continuar' : 'Iniciar',
      onclick: () => rodando ? pausarTarefa(b.id) : iniciarTarefa(b.id) }, ico(rodando ? 'pause' : 'play')) : null;
    const tarefa = b.id && state.routine.find(t => t.id === b.id);
    return h('li', { 'data-id': b.id || null, title: b.id ? 'Arraste para mudar a ordem do dia' : null, class: 'ag-bloco' + estado + (b.marco ? ' marco' : '') + (total >= 180 ? ' longo' : '') + (feito ? ' feito' : '') + (run ? ' crono' : '') + (rodando ? ' rodando' : ''), style: cor, 'data-crono': run ? b.id : null },
      h('span', { class: 'ag-hora', text: b.fim ? `${fmtHora(b.hora)} – ${fmtHora(b.fim)}` : fmtHora(b.hora) }),
      h('span', { class: 'ag-nome', text: b.nome }),
      b.marco ? null : run ? h('span', { class: 'ag-dur crono-txt', text: '' })
        : h('span', { class: 'ag-dur', text: feito ? `Feito · ${log[b.id].min} min` : agora ? `Agora · faltam ${dur(b.fimMin - m)}` : dur(total) }),
      play,
      run ? h('i', { class: 'ag-barra' }) : agora && !feito ? h('i', { class: 'ag-barra relogio', style: { '--p': String(Math.min(1, (m - b.ini) / Math.max(1, total))) } }) : null);
  }));
  const ini = itens[0], fim = itens[itens.length - 1];
  box.replaceChildren(
    h('div', { class: 'card-head' }, h('h2', { text: 'Agenda' }),
      h('span', { class: 'pill-muted', text: `${fmtHora(ini.hora)} às ${fmtHora(fim.fim || fim.hora)}` })),
    lista);
  if (typeof tiqueTarefa === 'function') tiqueTarefa();   // relógio do cronômetro já preenchido
  arrastoAgenda(lista);
}

/* ---------- arrastar blocos ----------
   Mouse: clicar e arrastar. Dedo: segurar um instante (para não brigar com a
   rolagem da página) e arrastar. Ao soltar sobre outro bloco, a tarefa vai
   para antes ou depois dele (pela metade em que o dedo está) e os horários
   se reorganizam (moverNoDia, em rotina.js): cada tarefa mantém a duração e
   os intervalos ficam. O Acordar não é tarefa e não se move. */
const AG = { arrastando: false };
function arrastoAgenda(ol){
  ol.addEventListener('pointerdown', e => {
    const li = e.target.closest('.ag-bloco[data-id]');
    if (!li || e.target.closest('button') || e.button > 0 || typeof moverNoDia !== 'function') return;
    const toque = e.pointerType !== 'mouse';
    const x0 = e.clientX, y0 = e.clientY;
    let ativo = false, timer = 0, alvo = null, depois = false;
    const bloqueia = ev => ev.preventDefault();
    const limpa = () => ol.querySelectorAll('.alvo-antes,.alvo-depois').forEach(x => x.classList.remove('alvo-antes', 'alvo-depois'));
    const ativa = () => {
      ativo = true; AG.arrastando = true;
      li.classList.add('arrastando'); ol.classList.add('arrastando');
      document.addEventListener('touchmove', bloqueia, { passive: false });
      try { navigator.vibrate && navigator.vibrate(12); } catch (err) {}
    };
    const move = ev => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!ativo){
        if (toque){ if (Math.hypot(dx, dy) > 9) fim(); return; }   // dedo andou antes do tempo: é rolagem
        if (Math.hypot(dx, dy) < 6) return;
        ativa();
      }
      ev.preventDefault();
      li.style.transform = `translate(${dx}px,${dy}px) scale(1.03)`;
      li.style.pointerEvents = 'none';
      const sob = document.elementFromPoint(ev.clientX, ev.clientY);
      li.style.pointerEvents = '';
      const o = sob && sob.closest('.ag-bloco[data-id]');
      limpa();
      alvo = o && o !== li && ol.contains(o) ? o : null;
      if (alvo){ const r = alvo.getBoundingClientRect(); depois = ev.clientX > r.left + r.width / 2; alvo.classList.add(depois ? 'alvo-depois' : 'alvo-antes'); }
    };
    const fim = () => {
      clearTimeout(timer);
      removeEventListener('pointermove', move); removeEventListener('pointerup', fim); removeEventListener('pointercancel', fim);
      document.removeEventListener('touchmove', bloqueia);
      li.style.transform = ''; li.classList.remove('arrastando'); ol.classList.remove('arrastando'); limpa();
      const era = ativo; ativo = false; AG.arrastando = false;
      if (!era) return;
      /* o clique que vem depois de soltar não conta */
      const engole = ev => { ev.stopPropagation(); ev.preventDefault(); };
      addEventListener('click', engole, { capture: true, once: true });
      setTimeout(() => removeEventListener('click', engole, true), 300);
      if (!alvo) return;
      const ids = [...ol.querySelectorAll('.ag-bloco[data-id]')].map(x => x.dataset.id);
      const de = ids.indexOf(li.dataset.id);
      let para = ids.indexOf(alvo.dataset.id) + (depois ? 1 : 0);
      if (de < para) para--;
      if (moverNoDia(li.dataset.id, para)){
        const nome = (li.querySelector('.ag-nome') || {}).textContent || 'Tarefa';
        toast(`${nome}: novo horário no dia. Os outros blocos se ajustaram.`);
      }
    };
    if (toque) timer = setTimeout(ativa, 320);
    addEventListener('pointermove', move, { passive: false });
    addEventListener('pointerup', fim);
    addEventListener('pointercancel', fim);
  });
}

// o "Agora" anda sozinho enquanto a aba Hoje está aberta
setInterval(() => {
  if (document.visibilityState === 'visible' && $('#v-hoje') && $('#v-hoje').classList.contains('on')) renderAgenda();
}, 60e3);
