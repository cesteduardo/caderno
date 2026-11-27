/* =====================================================================
   Ajustes pessoais da rotina
   ---------------------------------------------------------------------
   O Caderno é pessoal desde 27/11/2026 (ver README): mudanças que o dono
   pede na rotina podem vir no código. Cada ajuste roda UMA vez, no
   primeiro aparelho que abrir o app depois dele, e fica marcado em
   state.ajustes; a sincronização leva o resultado ao Gist e aos outros
   aparelhos, que veem a marca e não repetem.

   Quando roda: com sincronização ligada, logo depois de o estado do Gist
   ser mesclado (para não passar por cima de uma edição feita no outro
   aparelho); sem sincronização, ao abrir. Com a rotina vazia não roda.

   As tarefas são achadas pelo nome aproximado (o dono pode ter escrito
   "Rezar o terço" ou "Terço"): a que existe mantém o nome e ganha a
   duração, os dias e o horário pedidos; a que falta é criada.
   ===================================================================== */
'use strict';

const AJ_TODOS = [0, 1, 2, 3, 4, 5, 6], AJ_UTEIS = [1, 2, 3, 4, 5];

/* 27/11/2026: a manhã andou 30 minutos e entrou o Trabalho (pedido do dono) */
function ajusteManha20261127(s){
  let lista = s.perfil && Array.isArray(s.perfil.areas) && s.perfil.areas.length ? s.perfil.areas : null;
  /* Trabalho numa área própria: as 55 h por semana não entram na conta dos estudos */
  if (!(lista || AREAS_PADRAO).some(a => a.id === 'trabalho')){
    if (!lista){ s.perfil = { ...(s.perfil || {}), areas: JSON.parse(JSON.stringify(AREAS_PADRAO)) }; lista = s.perfil.areas; }
    lista.push({ id: 'trabalho', name: 'Trabalho', color: '#6b7280' });
    s.perfil.t = Date.now();
  }
  lista = lista || AREAS_PADRAO;
  const area = (...ids) => ids.find(id => lista.some(a => a.id === id)) || lista[0].id;
  const BLOCOS = [
    { re: /ter[çc]o/i,             nome: 'Terço',                     at: '05:40', min: 25,  dias: AJ_TODOS, area: () => area('fe', 'oracao', 'saude') },
    { re: /b[íi]blia/i,            nome: 'Bíblia',                    at: '06:05', min: 25,  dias: AJ_TODOS, area: () => area('fe', 'oracao', 'leit') },
    { re: /literatura/i,           nome: 'Literatura',                at: '06:30', min: 25,  dias: AJ_TODOS, area: () => area('leit', 'esc') },
    { re: /espresso|expresso/i,    nome: 'Espresso e música',         at: '06:55', min: 15,  dias: AJ_TODOS, area: () => area('musica', 'saude') },
    { re: /efe?sc/i,               nome: 'Aula do EFSC',              at: '07:10', min: 60,  dias: AJ_TODOS, area: () => area('esc', 'estudo') },
    { re: /^\s*escrever\b/i,       nome: 'Escrever',                  at: '08:10', min: 15,  dias: AJ_TODOS, area: () => area('esc') },
    { re: /preparar.*sair/i,       nome: 'Preparar para sair',        at: '09:55', min: 5,   dias: AJ_UTEIS, area: () => 'trabalho' },
    { re: /caminhada/i,            nome: 'Caminhada para o trabalho', at: '10:00', min: 21,  dias: AJ_UTEIS, area: () => 'trabalho' },
    { re: /^\s*trabalho\b/i,       nome: 'Trabalho',                  at: '10:30', min: 660, dias: AJ_UTEIS, area: () => 'trabalho' },
  ];
  s.routine = s.routine.filter(t => !/html/i.test(t.name || ''));   // "Estudar HTML" saiu
  const usadas = new Set();
  for (const b of BLOCOS){
    const t = s.routine.find(x => !usadas.has(x) && b.re.test(x.name || ''));
    if (t){ t.min = b.min; t.at = b.at; if (!t.required) t.days = [...b.dias]; usadas.add(t); }
    else { const n = { id: uid(), area: b.area(), name: b.nome, min: b.min, days: [...b.dias], at: b.at, notes: {} }; s.routine.push(n); usadas.add(n); }
  }
}

const AJUSTES = [
  ['manha-2026-11-27', ajusteManha20261127],
];

/* Aplica no estado s o que ainda não foi aplicado; diz se mudou algo */
function ajustesPessoais(s){
  if (!s || !Array.isArray(s.routine) || !s.routine.length) return false;
  s.ajustes = Array.isArray(s.ajustes) ? s.ajustes : [];
  let mudou = false;
  for (const [id, fn] of AJUSTES){
    if (s.ajustes.includes(id)) continue;
    try { fn(s); s.ajustes.push(id); mudou = true; }
    catch (e) { console.warn('ajuste ' + id, e); }
  }
  if (mudou){ s.configAt = Date.now(); if (typeof ensureRequired === 'function') ensureRequired(s); }
  return mudou;
}
