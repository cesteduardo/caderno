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
  if (comHora.length) return [...MARCOS, ...comHora.map(t => ({ hora: t.at, fim: somaHora(t.at, t.min), nome: t.name, dias: t.days }))];
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
  if (!box) return;
  const itens = agendaDoDia(viewDay);
  box.hidden = !itens.length;
  if (!itens.length) return;
  const agora = new Date(), hoje = viewDay === todayKey();
  const m = agora.getHours() * 60 + agora.getMinutes();
  const lista = h('ol', { class: 'ag-lista' }, ...itens.map(b => {
    const estado = !hoje ? '' : m >= b.fimMin ? ' passou' : m >= b.ini ? ' agora' : '';
    return h('li', { class: 'ag-item' + estado },
      h('span', { class: 'ag-hora', text: b.fim ? `${fmtHora(b.hora)} às ${fmtHora(b.fim)}` : fmtHora(b.hora) }),
      h('span', { class: 'ag-nome', text: b.nome }),
      estado === ' agora' ? h('span', { class: 'ag-agora', text: 'Agora' }) : null);
  }));
  const ini = itens[0], fim = itens[itens.length - 1];
  box.replaceChildren(
    h('div', { class: 'card-head' }, h('h2', { text: 'Agenda' }),
      h('span', { class: 'pill-muted', text: `${fmtHora(ini.hora)} às ${fmtHora(fim.fim || fim.hora)}` })),
    lista);
}

// o "Agora" anda sozinho enquanto a aba Hoje está aberta
setInterval(() => {
  if (document.visibilityState === 'visible' && $('#v-hoje') && $('#v-hoje').classList.contains('on')) renderAgenda();
}, 60e3);
