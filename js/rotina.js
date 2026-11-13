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
const PLAN_START  = '2026-10-06'; // terça-feira, 6 de outubro: primeiro dia do plano

// Cores de acento por área, escolhidas para contraste sobre fundo claro
const AREAS = [
  { id: 'fe',     name: 'Oração',      color: '#8a6a4f' }, // terracota suave
  { id: 'web',    name: 'Programação', color: '#2f6bed' }, // azul
  { id: 'design', name: 'Design',      color: '#b07f1f' }, // dourado
  { id: 'ilu',    name: 'Ilustração',  color: '#d24f8e' }, // rosa / magenta
  { id: 'esc',    name: 'Escrita',     color: '#8650d8' }, // roxo
  { id: 'en',     name: 'Inglês',      color: '#109c86' }, // verde-água
  { id: 'zh',     name: 'Chinês',      color: '#de4040' }, // vermelho
  { id: 'es',     name: 'Espanhol',    color: '#e2ac0a' }, // amarelo
  { id: 'body',   name: 'Calistenia',  color: '#22a75a' }, // verde
  { id: 'linux',  name: 'Linux',       color: '#5458d6' }, // roxo azulado
];
const areaById = id => AREAS.find(a => a.id === id) || AREAS[0];

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];  // segunda → domingo
const DAY_NAMES  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const DAY_SHORT  = ['D','S','T','Q','Q','S','S'];
const MONTHS     = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MON_SHORT  = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

/* Rotina padrão — trabalho das 8h às 18h (sai às 7h, volta às 19h30).
   Cerca de 2 h por dia útil em casa:
     · manhã, 5h00–6h40: terço, café e um bloco de foco
       (treino, escrita ou aula da EFESC)
     · noite, ~20h45: um bloco curto (programação ou escrita)
   O trajeto é só música (ver TRILHA). Sexta à noite livre, sábado com
   a sessão longa, domingo leve. Total ≈ 14h30 por semana.
   when: 'manha' | 'noite' — aparece como etiqueta na aba Hoje.
   days: 0 = domingo … 6 = sábado. notes: detalhe por dia (opcional). */
const EVERY = [0,1,2,3,4,5,6];
const DEFAULT_ROUTINE = [
  { key:'terco', area:'fe', name:'Rezar o terço', min:25, days:EVERY, required:true, when:'manha', notes:{ 6:'Se der, junto com sua mulher', 0:'Se der, junto com sua mulher' } },

  // manhã, depois do terço e do café
  { area:'esc',  name:'Escrita literária', min:40, days:[1], when:'manha', notes:{ 1:'Conto em andamento' } },
  { area:'body', name:'Calistenia · força', min:45, days:[2,4,6], when:'manha', notes:{ 2:'Treino A', 4:'Treino B', 6:'Alterne A e B a cada semana' } },
  { area:'esc',  name:'Aula da EFESC', min:40, days:[3,5], when:'manha', notes:{ 3:'Primeira metade da aula', 5:'Segunda metade da aula' } },
  { area:'body', name:'Mobilidade', min:10, days:[1,3,5,0], when:'manha', notes:{ 0:'Alongamento leve' } },

  // noite
  { area:'web', name:'Programação · freeCodeCamp', min:45, days:[1,3], when:'noite', notes:{ 1:'Próxima lição', 3:'Próxima lição' } },
  { area:'esc', name:'Escrita literária', min:40, days:[2,4], when:'noite', notes:{ 2:'Conto ou exercício da EFESC', 4:'Conto ou exercício da EFESC' } },
  { area:'en',  name:'Inglês · Busuu', min:15, days:[2,4], when:'noite' },

  // sábado
  { area:'web',    name:'Programação · sessão longa', min:90, days:[6], notes:{ 6:'Curso ou projeto autoral, e subir no GitHub' } },
  { area:'design', name:'Estudo de design', min:45, days:[6] },
  { area:'en',     name:'Inglês · Busuu', min:20, days:[6] },
  { area:'es',     name:'Espanhol · Busuu', min:20, days:[6] },

  // domingo
  { area:'esc', name:'Leitura de um conto', min:30, days:[0], notes:{ 0:'Ler com atenção e anotar o que funcionou' } },
];
const WHEN = { manha:'Manhã', noite:'Noite' };

/* Trilha do trajeto: um álbum completo por dia útil, num ciclo de
   4 semanas. Tema fixo por dia: seg Bach · ter piano · qua sinfonia ·
   qui concerto · sex música sacra. Ouça na ida e repita na volta. */
const TRILHA = [
  [ { c:'J. S. Bach',  w:'Variações Goldberg',            p:'Glenn Gould (1981)' },
    { c:'Chopin',      w:'Noturnos',                      p:'Arthur Rubinstein' },
    { c:'Beethoven',   w:'Sinfonias nº 5 e nº 7',         p:'Carlos Kleiber, Filarmônica de Viena' },
    { c:'Vivaldi',     w:'As Quatro Estações',            p:'Fabio Biondi, Europa Galante' },
    { c:'Mozart',      w:'Réquiem',                       p:'Karl Böhm, Filarmônica de Viena' } ],
  [ { c:'J. S. Bach',  w:'Suítes para violoncelo',        p:'Yo-Yo Ma, "Six Evolutions"' },
    { c:'Schubert',    w:'Sonata para piano D. 960',      p:'Alfred Brendel' },
    { c:'Brahms',      w:'Sinfonia nº 4',                 p:'Carlos Kleiber, Filarmônica de Viena' },
    { c:'Rachmaninoff',w:'Concerto para piano nº 2',      p:'Sviatoslav Richter' },
    { c:'Palestrina',  w:'Missa Papae Marcelli',          p:'The Tallis Scholars' } ],
  [ { c:'J. S. Bach',  w:'Concertos de Brandemburgo',     p:'Trevor Pinnock, The English Concert' },
    { c:'Debussy',     w:'Prelúdios',                     p:'Krystian Zimerman' },
    { c:'Tchaikovsky', w:'Sinfonia nº 6, "Patética"',     p:'Evgeny Mravinsky, Filarmônica de Leningrado' },
    { c:'Beethoven',   w:'Concerto para piano nº 5, "Imperador"', p:'Krystian Zimerman, Leonard Bernstein' },
    { c:'Fauré',       w:'Réquiem',                       p:'Philippe Herreweghe' } ],
  [ { c:'J. S. Bach',  w:'Missa em si menor',             p:'John Eliot Gardiner' },
    { c:'Satie',       w:'Gymnopédies e Gnossiennes',     p:'Pascal Rogé' },
    { c:'Dvořák',      w:'Sinfonia nº 9, "Do Novo Mundo"',p:'István Kertész, Sinfônica de Londres' },
    { c:'Villa-Lobos', w:'Bachianas Brasileiras',         p:'regidas pelo próprio Villa-Lobos' },
    { c:'Canto gregoriano', w:'Chant',                    p:'Monges de Santo Domingo de Silos' } ],
];
const TRILHA_TEMAS = ['Bach','Piano','Sinfonia','Concerto','Música sacra'];

/* Planos. Cada fase: [nome, horas estimadas, etapas].
   As horas são estimativas de estudo dedicado; a data prevista sai
   de horas ÷ (minutos semanais da área na rotina). */
const DEFAULT_PLANS = [
  { area:'web', name:'Programador Web',
    status:'prioridade',
    goal:'Ficar pronto para o primeiro trabalho como dev web. Com 3 h por semana, é um caminho de cerca de 3 anos; é o primeiro plano a ganhar tempo quando algo for pausado.',
    phases:[
      ['Fundamentos', 90,  ['HTML semântico (freeCodeCamp)','CSS: box model, Flexbox e Grid','Página pessoal responsiva publicada','Git e GitHub: um commit por sessão']],
      ['JavaScript', 140,  ['Tipos, funções, arrays e objetos','DOM e eventos','fetch, APIs e async/await','3 projetos: tarefas, clima e quiz']],
      ['Front-end', 110,   ['npm e Vite','React: componentes, estado e efeitos','Acessibilidade e performance básicas','App em React publicado']],
      ['Back-end e projetos', 140, ['Node.js e Express','Banco de dados SQL','API própria com autenticação','Projeto autoral full stack no portfólio']] ] },
  { area:'design', name:'Designer',
    status:'manutencao',
    goal:'Projetar interfaces e identidades com intenção. Por enquanto, só aos sábados, como apoio à programação.',
    phases:[
      ['Fundamentos', 30, ['Hierarquia e contraste','Grid e composição','Tipografia: escala e pares','10 composições de estudo']],
      ['Cor e interface', 30, ['Teoria da cor aplicada','Figma: auto layout e componentes','Redesenhar 3 telas de apps reais']],
      ['Sistemas', 30, ['Identidade visual de uma marca fictícia','Mini design system','Estudo de caso escrito']],
      ['Portfólio', 25, ['3 estudos de caso completos','Projetar e programar o mesmo projeto','Revisão com outra pessoa']] ] },
  { area:'ilu', name:'Ilustrador',
    status:'pausado',
    goal:'Desenhar com construção sólida e terminar ilustrações completas. Pausado até o conto ficar pronto.',
    phases:[
      ['Forma', 30, ['Drawabox: lição 1','Drawabox: lição 2','250 caixas, divididas em sessões']],
      ['Construção', 30, ['Perspectiva de 1, 2 e 3 pontos','Drawabox: lições 3 e 4','20 objetos do cotidiano construídos']],
      ['Figura', 40, ['Gesto: 10 poses de 1 min por sessão','Proporções do corpo','Cabeça pelo método Loomis','Mãos e pés']],
      ['Valor e cor', 40, ['Valor em escala de cinza','Luz e sombra em formas simples','Pintura digital no Krita','Ilustração final: capa do seu conto']] ] },
  { area:'esc', name:'Escritor',
    status:'prioridade',
    goal:'Em cerca de 8 meses, um conto revisado e pronto para envio, com as aulas da EFESC nas manhãs de quarta e sexta. O livro fica para o próximo ciclo.',
    phases:[
      ['Ofício', 30, ['Diário de observação 3x por semana','Ler e analisar 10 contos','Exercícios da EFESC do mês']],
      ['Contos curtos', 40, ['3 contos de 1.000 a 2.000 palavras','Ficha de personagem: desejo, medo, contradição','Levar um conto para a turma da EFESC']],
      ['Conto principal', 35, ['Escolher a ideia e esboçar o arco','Primeiro rascunho completo, sem revisar no meio']],
      ['Revisão e envio', 30, ['Deixar o rascunho descansar uma semana','Reescrita estrutural','Leitura crítica na EFESC','Enviar a um concurso ou revista']] ] },
  { area:'en', name:'Inglês',
    status:'manutencao',
    goal:'Manter o contato: 15 min em duas noites e 20 min no sábado. Comece pelo teste de nível: as fases que você já domina podem ser marcadas de cara.',
    phases:[
      ['A1', 40,  ['Teste de nível no Busuu','Unidades do A1','Teste de fim de nível']],
      ['A2', 60,  ['Unidades do A2','Exercícios corrigidos por nativos','Teste de fim de nível']],
      ['B1', 120, ['Unidades do B1','Ler documentação do MDN em inglês','Teste de fim de nível']],
      ['B2', 160, ['Unidades do B2','Assistir a uma série sem legenda','Conversa de 10 min com um nativo']] ] },
  { area:'zh', name:'Chinês',
    status:'pausado',
    goal:'Do pinyin ao HSK 3. Pausado por enquanto: retome quando a rotina tiver espaço.',
    phases:[
      ['Pinyin', 15,  ['Os 4 tons e pares de tons','Teclado pinyin no Linux (fcitx5)','Pleco instalado']],
      ['HSK 1', 60,   ['Unidades iniciais no Busuu','Vocabulário do HSK 1','Primeiros 100 caracteres à mão','Simulado do HSK 1']],
      ['HSK 2', 90,   ['Vocabulário do HSK 2','Gramática: 了, 过, 在 e comparações','Simulado do HSK 2']],
      ['HSK 3', 130,  ['Vocabulário do HSK 3','Mandarin Corner sem legenda em inglês','Simulado do HSK 3']] ] },
  { area:'es', name:'Espanhol',
    status:'manutencao',
    goal:'Manter contato aos sábados, aproveitando a proximidade com o português.',
    phases:[
      ['A1', 15, ['Teste de nível no Busuu','Unidades do A1','Falsos cognatos mais comuns']],
      ['A2', 25, ['Unidades do A2','Exercícios corrigidos por nativos']],
      ['B1', 50, ['Unidades do B1','Dreaming Spanish: 50 horas de input']],
      ['B2', 70, ['Unidades do B2','Um livro inteiro em espanhol','Conversa de 10 min com um nativo']] ] },
  { area:'body', name:'Calistenia', status:'base',
    goal:'1,75 m e 55 kg: ganhar força e massa aos poucos. Três treinos de 45 min de manhã (ter, qui, sáb), depois do café, e 10 min de mobilidade nos outros dias.',
    phases:[
      ['Adaptação · 4 sem', 12,  ['Aprender a técnica dos treinos A e B','Flexão: 3×8 com corpo reto','Remada australiana: 3×8','Pendurar na barra: 3×20 s','Pesar-se 1x por semana, mesmo horário']],
      ['Base · 12 sem', 35,      ['Primeira barra fixa','Flexão: 3×12','Dips com apoio: 3×8','Agachamento búlgaro: 3×8 por perna','Ganhar peso aos poucos (≈ 0,5 kg por mês)']],
      ['Força · 12 sem', 35,     ['5 barras seguidas','20 flexões seguidas','10 dips','Pistol assistido: 5 por perna']],
      ['Habilidades · 16 sem', 47, ['10 barras seguidas','Parada de mão na parede: 30 s','Tuck L-sit: 15 s','Testar máximos e montar o próximo ciclo']] ],
    guide:[
      ['Aquecimento · 5 min', ['Punhos, ombros e quadril','1 série leve do primeiro exercício']],
      ['Treino A · 40 min', ['Barra fixa (ou negativas de 5 s) + Dips com apoio: 3×5–8 cada','Agachamento búlgaro + Remada australiana: 3×8–12 cada','Flexão + Hollow hold: 3×8–12 e 3×20 s']],
      ['Treino B · 40 min', ['Remada australiana + Pike push-up: 3×8–12 e 3×5–8','Agachamento (rumo ao pistol) + Ponte de glúteo com uma perna: 3×10 cada','Flexão inclinada + Prancha lateral: 3×8–12 e 3×30 s']],
      ['Mobilidade · 10 min', ['Punhos, ombros e quadril','A partir da fase Base: 2×20 s de parada de mão na parede']],
      ['Regras', ['Exercícios em pares (superséries): faz um, descansa 60 s, faz o outro','Fez todas as séries no topo da faixa com boa técnica? Avance a variação','Dor articular aguda: pare e troque o exercício','Coma bem: refeições regulares, com proteína em todas','Durma 7 a 9 horas: é na recuperação que a força cresce']] ] },
  { area:'linux', name:'Linux',
    status:'manutencao',
    goal:'Aprender usando: o terminal entra nas sessões de programação, sem horário próprio por enquanto.',
    phases:[
      ['Base', 10,          ['Navegação, caminhos e permissões','Pipes e redirecionamento','grep, find e less']],
      ['Shell', 15,         ['Variáveis, condicionais e laços em Bash','3 scripts úteis para o seu dia']],
      ['Administração', 15, ['systemd e journalctl','Processos e recursos','Rede e SSH com chaves']],
      ['Automação', 10,     ['Backup com rsync e um timer do systemd','Dotfiles versionados no Git']] ] },
];

// Agrupamento usado pelo filtro da aba Planos
/* Status de cada plano. Com pouco tempo livre, só dois planos andam
   como prioridade; os outros ficam em manutenção ou pausados. */
const STATUS = {
  base:       { name:'Base',       order:0 }, // hábitos fixos, como a calistenia
  prioridade: { name:'Prioridade', order:1 },
  manutencao: { name:'Manutenção', order:2 },
  pausado:    { name:'Pausado',    order:3 },
};
/* Tarefa sugerida ao retomar um plano que não tem tarefas guardadas.
   Pensadas para caber na rotina de quem trabalha das 8h às 18h. */
const SUGGESTED = {
  web:    { name:'Programação · freeCodeCamp', min:45, days:[1,3], when:'noite' },
  design: { name:'Estudo de design',           min:45, days:[6] },
  ilu:    { name:'Estudo de desenho',          min:30, days:[0], notes:{ 0:'Drawabox' } },
  esc:    { name:'Escrita literária',          min:40, days:[2,4], when:'noite' },
  en:     { name:'Inglês · Busuu',             min:15, days:[2,4], when:'noite' },
  zh:     { name:'Chinês · Busuu',             min:20, days:[6,0] },
  es:     { name:'Espanhol · Busuu',           min:20, days:[6] },
  body:   { name:'Calistenia · força',         min:45, days:[2,4,6], when:'manha' },
  linux:  { name:'Linux no terminal',          min:30, days:[6] },
};

const PLAN_GROUPS = [
  { id:'all',        name:'Todos' },
  { id:'prioridade', name:'Base e prioridade' },
  { id:'manutencao', name:'Manutenção' },
  { id:'pausado',    name:'Pausados' },
];

/* Biblioteca. Canais abrem a busca do YouTube (links que não quebram). */
const yt = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const RESOURCES = [
  { area:'web',    name:'freeCodeCamp',       kind:'Curso principal', url:'https://www.freecodecamp.org/learn', desc:'Trilha completa, com projetos.' },
  { area:'web',    name:'Kevin Powell',       kind:'YouTube', url:yt('Kevin Powell CSS'),     desc:'CSS, layout e front-end.' },
  { area:'web',    name:'Web Dev Simplified', kind:'YouTube', url:yt('Web Dev Simplified'),   desc:'Desenvolvimento web prático.' },
  { area:'web',    name:'Fireship',           kind:'YouTube', url:yt('Fireship'),             desc:'Tecnologia em formato rápido.' },
  { area:'design', name:'The Futur',          kind:'YouTube', url:yt('The Futur'),            desc:'Design, negócio e direção criativa.' },
  { area:'design', name:'Flux Academy',       kind:'YouTube', url:yt('Flux Academy'),         desc:'Web design e UI.' },
  { area:'ilu',    name:'Drawabox',           kind:'Curso principal', url:'https://drawabox.com/', desc:'Fundamentos de desenho, gratuito.' },
  { area:'ilu',    name:'Proko',              kind:'YouTube', url:yt('Proko'),                desc:'Desenho e anatomia.' },
  { area:'ilu',    name:'Marc Brunet',        kind:'YouTube', url:yt('Marc Brunet'),          desc:'Arte digital e concept art.' },
  { area:'esc',    name:'EFESC',              kind:'Curso principal', url:null,               desc:'Literatura. A rotina reserva tempo para os exercícios.' },
  { area:'en',     name:'Busuu',              kind:'Curso principal', url:'https://www.busuu.com/', desc:'Inglês, chinês e espanhol, do A1 ao B2.' },
  { area:'en',     name:'Rachel’s English',   kind:'YouTube', url:yt("Rachel's English"),     desc:'Pronúncia e inglês falado.' },
  { area:'zh',     name:'Mandarin Corner',    kind:'YouTube', url:yt('Mandarin Corner'),      desc:'Chinês real e compreensão auditiva.' },
  { area:'es',     name:'Dreaming Spanish',   kind:'YouTube', url:yt('Dreaming Spanish'),     desc:'Input compreensível.' },
  { area:'body',   name:'FitnessFAQs',        kind:'YouTube', url:yt('FitnessFAQs'),          desc:'Força e calistenia.' },
  { area:'linux',  name:'Learn Linux TV',     kind:'YouTube', url:yt('Learn Linux TV'),       desc:'Linux e administração de sistemas.' },
];

/* ---------------------------------------------------------------------
   2. STORE
   --------------------------------------------------------------------- */

const uid = () => Math.random().toString(36).slice(2, 10);

function initialState(){
  /* ids fixos para a rotina e os planos padrão: são iguais em todos os
     aparelhos, então uma tarefa marcada no celular é a mesma no PC */
  return {
    routine: DEFAULT_ROUTINE.map((t, i) => ({ id: t.key || 'r' + i, notes: {}, ...t, days: [...t.days] })),
    plans: DEFAULT_PLANS.map(p => {
      const pid = 'p-' + p.area;
      return {
        id: pid, area: p.area, name: p.name, goal: p.goal, guide: p.guide || null, status: p.status || 'manutencao',
        phases: p.phases.map(([name, hours, steps], fi) => ({
          name, hours, steps: steps.map((text, si) => ({ id: `${pid}-${fi}-${si}`, text, done: false })),
        })),
      };
    }),
    // log['AAAA-MM-DD'] = { done: { tarefaId: { min, area } }, diary: '', t: carimbo }
    log: {},
    // tarefas de planos pausados, guardadas por área até a retomada
    parked: {},
    configAt: 0,
  };
}

/* Tarefas obrigatórias (required) existem sempre, todos os dias.
   Se faltarem num estado salvo antigo, são adicionadas no topo. */
function ensureRequired(s){
  for (const t of DEFAULT_ROUTINE.filter(t => t.required)){
    const found = s.routine.find(r => r.key === t.key);
    if (!found) s.routine.unshift({ id: t.key, notes: {}, ...t, days: [...EVERY] });
    else { found.required = true; found.days = [...EVERY]; }
  }
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

/* Ao marcar, guardamos minutos e área da tarefa naquele dia.
   Assim, editar a rotina depois não reescreve o histórico. */
function dayStats(k){
  const tasks = tasksFor(k);
  const done = (state.log[k] && state.log[k].done) || {};
  const planned = tasks.reduce((s, t) => s + t.min, 0);
  const doneTasks = tasks.filter(t => t.id in done);
  const completed = doneTasks.reduce((s, t) => s + (done[t.id].min || t.min), 0);
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
const currentPhase = plan => plan.phases.findIndex(ph => ph.steps.some(s => !s.done));
const phaseRatio = ph => ph.steps.length ? ph.steps.filter(s => s.done).length / ph.steps.length : 1;

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
  const end = Number.isFinite(accWeeks) ? fromKey(shift(todayKey() > PLAN_START ? todayKey() : PLAN_START, Math.ceil(accWeeks * 7))) : null;
  return { perWeekH, phases, end, totalH: plan.phases.reduce((s, p) => s + p.hours, 0) };
}

// Um dia conta para a sequência se metade dos minutos planejados foi feita
const dayCounts = k => { const s = dayStats(k); return s.planned > 0 && s.ratio >= 0.5; };
function streak(){
  let k = todayKey(), n = 0;
  if (!dayCounts(k)) k = shift(k, -1);            // hoje ainda está em andamento
  while (k >= PLAN_START && dayCounts(k)){ n++; k = shift(k, -1); }
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
    const suggested = !tasks.length && SUGGESTED[plan.area];
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

/* Álbum do dia no trajeto (só dias úteis). A semana do ciclo conta a
   partir da semana de início do plano. */
function albumFor(k){
  const wd = fromKey(k).getDay();
  if (wd < 1 || wd > 5) return null;
  const weeks = Math.round((fromKey(mondayOf(k)) - fromKey(mondayOf(PLAN_START))) / (7 * 864e5));
  const cycle = ((weeks % 4) + 4) % 4;
  return { ...TRILHA[cycle][wd - 1], cycle, tema: TRILHA_TEMAS[wd - 1] };
}
const spotify = q => 'https://open.spotify.com/search/' + encodeURIComponent(q);

function renderTrack(){
  const box = $('#track');
  const a = albumFor(viewDay);
  box.hidden = !a;
  if (!a) return;
  const q = `${a.c} ${a.w} ${a.p.replace(/"/g, '')}`;
  box.replaceChildren(
    h('div', { class: 'track-text' },
      h('span', { class: 'eyebrow', text: `No trajeto · ${a.tema} · semana ${a.cycle + 1} de 4` }),
      h('b', { text: `${a.c} — ${a.w}` }),
      h('span', { class: 'track-by', text: a.p })),
    h('div', { class: 'track-links' },
      h('a', { href: spotify(q), target: '_blank', rel: 'noopener', text: 'Spotify ↗' }),
      h('a', { href: yt(q), target: '_blank', rel: 'noopener', text: 'YouTube ↗' })));
}

/* ---------- HOJE ---------- */
function renderToday(){
  if (typeof renderStudyToday === 'function') renderStudyToday();
  const d = fromKey(viewDay), wd = d.getDay();
  const isToday = viewDay === todayKey();
  const n = Math.floor((d - fromKey(PLAN_START)) / 864e5) + 1;

  $('#dayIndicator').textContent = n >= 1 ? `${DAY_NAMES[wd]} · dia ${n}` : `${DAY_NAMES[wd]} · o plano começa em ${fromKey(PLAN_START).getDate()} de ${MONTHS[fromKey(PLAN_START).getMonth()]}`;
  $('#t-hoje').textContent = isToday ? 'Hoje.' : DAY_NAMES[wd] + '.';
  $('#dateLabel').textContent = `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  $('#backToday').hidden = isToday;

  const st = paintTodayStats();

  renderTrack();
  const list = $('#todayList');
  list.replaceChildren();
  if (!st.tasks.length) list.append(h('p', { class: 'empty', text: 'Nada planejado para este dia.' }));
  const done = (state.log[viewDay] && state.log[viewDay].done) || {};

  // tarefas agrupadas por área, na ordem de AREAS
  // grupos na ordem do dia: manhã, depois o que não tem período, depois noite
  const rank = t => ({ manha: 0, noite: 2 })[t.when] ?? 1;
  const groupRank = id => Math.min(...st.tasks.filter(t => t.area === id).map(rank));
  const areas = AREAS.filter(a => st.tasks.some(t => t.area === a.id))
                     .sort((a, b) => groupRank(a.id) - groupRank(b.id) || AREAS.indexOf(a) - AREAS.indexOf(b));
  for (const area of areas){
    const tasks = st.tasks.filter(t => t.area === area.id);
    if (!tasks.length) continue;
    const group = h('section', { class: 'group', style: tint(area.id) },
      h('header', { class: 'group-head' }, areaChip(area.id), h('span', { class: 'group-sum', text: tasks.reduce((s, t) => s + t.min, 0) + ' min' })));

    for (const t of tasks){
      const isDone = t.id in done;
      const note = [WHEN[t.when], t.notes && t.notes[wd]].filter(Boolean).join(' · ');
      const box = h('input', { type: 'checkbox', class: 'check', checked: isDone, 'aria-label': `${t.name}, ${t.min} minutos` });
      const row = h('label', { class: 'row task' + (isDone ? ' done' : '') },
        box,
        h('span', { class: 'task-text' }, h('span', { class: 'task-name', text: t.name }), note ? h('span', { class: 'task-sub', text: note }) : null),
        t.required ? h('span', { class: 'req', text: 'Obrigatório' }) : null,
        h('span', { class: 'task-min', text: t.min + ' min' }));
      // marcar só mexe nesta linha e nos números do topo
      box.addEventListener('change', () => {
        const e = entryFor(viewDay);
        if (box.checked) e.done[t.id] = { min: t.min, area: t.area }; else delete e.done[t.id];
        row.classList.toggle('done', box.checked);
        e.t = Date.now();
        save('log'); paintTodayStats();
      });
      group.append(row);
    }
    list.append(group);
  }

  // diário: só recarrega o campo quando o dia muda
  const diary = $('#diary');
  if (diary.dataset.day !== viewDay){
    diary.value = (state.log[viewDay] && state.log[viewDay].diary) || '';
    diary.dataset.day = viewDay;
  }
  updateWordCount();
}

// Anel e números do topo da aba Hoje
function paintTodayStats(){
  const st = dayStats(viewDay);
  $('#ringFill').style.strokeDashoffset = 2 * Math.PI * 52 * (1 - st.ratio);
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
  const total = state.routine.reduce((s, t) => s + t.min * t.days.length, 0);
  $('#weekTotal').textContent = fmtHM(total);

  // barra de distribuição (como uma carteira de investimentos)
  const per = AREAS.map(a => ({ a, m: weeklyMin(a.id) })).filter(x => x.m > 0);
  $('#allocTotal').textContent = `${fmtH(total)} por semana`;
  $('#allocBar').replaceChildren(...per.map(({ a, m }) =>
    h('span', { style: { ...tint(a.id), 'flex-grow': String(m) }, title: `${a.name}: ${fmtHM(m)}` })));
  $('#allocLegend').replaceChildren(...per.map(({ a, m }) =>
    h('li', { style: tint(a.id) }, h('i'), h('span', { text: a.name }), h('b', { text: fmtHM(m) }), h('em', { text: Math.round(m / total * 100) + '%' }))));

  // os sete dias
  const week = $('#week');
  week.replaceChildren();
  const wdToday = new Date().getDay();
  const order = id => AREAS.findIndex(a => a.id === id);
  for (const wd of WEEK_ORDER){
    const tasks = state.routine.filter(t => t.days.includes(wd)).sort((a, b) => order(a.area) - order(b.area));
    const sum = tasks.reduce((s, t) => s + t.min, 0);
    week.append(h('div', { class: 'day' + (wd === wdToday ? ' is-today' : '') },
      h('header', { class: 'day-head' }, h('b', { text: DAY_NAMES[wd] }), h('span', { text: fmtHM(sum) })),
      h('div', { class: 'day-slots' }, tasks.map(t =>
        h('div', { class: 'slot', style: tint(t.area), title: `${t.name} · ${t.min} min` }, h('i'),
          h('span', { class: 'slot-name', text: areaById(t.area).name }),
          h('span', { class: 'slot-min', text: t.min + "'" }))))));
  }
  renderEditor();
}

// Editor: nome, área, duração e dias de cada tarefa
function renderEditor(){
  const rows = $('#editorRows');
  rows.replaceChildren();
  state.routine.forEach((t, i) => {
    const name = h('input', { type: 'text', value: t.name, 'aria-label': 'Nome da tarefa' });
    name.addEventListener('change', () => { t.name = name.value.trim() || t.name; save(); renderWeek(); });

    const area = h('select', { 'aria-label': 'Área' }, AREAS.map(a => h('option', { value: a.id, text: a.name })));
    area.value = t.area;
    area.addEventListener('change', () => { t.area = area.value; save(); resumeIfPaused(t.area); renderWeek(); });

    const min = h('input', { type: 'number', min: '5', step: '5', value: String(t.min), 'aria-label': 'Minutos' });
    min.addEventListener('change', () => { t.min = Math.max(5, parseInt(min.value, 10) || t.min); save(); renderWeek(); });

    const days = h('div', { class: 'days', role: 'group', 'aria-label': 'Dias da semana' },
      WEEK_ORDER.map(wd => h('button', {
        type: 'button', text: DAY_SHORT[wd], title: DAY_NAMES[wd], 'aria-pressed': String(t.days.includes(wd)),
        disabled: !!t.required,
        onclick: () => { t.days = t.days.includes(wd) ? t.days.filter(x => x !== wd) : [...t.days, wd]; save(); renderWeek(); },
      })));

    const remove = t.required ? h('span', { class: 'lock', title: 'Tarefa obrigatória', text: '●' }) : h('button', { class: 'x', type: 'button', text: '×', 'aria-label': `Remover ${t.name}`,
      onclick: () => { if (confirm(`Remover "${t.name}" da rotina?`)){ state.routine.splice(i, 1); save(); renderWeek(); } } });

    rows.append(h('div', { class: 'erow', style: tint(t.area) },
      h('i', { class: 'erow-dot' }), name, area, h('label', { class: 'min-field' }, min, h('span', { text: 'min' })), days, remove));
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

  const wrap = $('#plans');
  const prev = barsOf(wrap);
  wrap.replaceChildren(...(list.length ? list.map(planCard) : [h('p', { class: 'empty', text: 'Nenhum plano aqui.' })]));
  settleBars(wrap, prev);
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
  const days = ['Seg','Ter','Qua','Qui','Sex'];
  $('#trackCycle').replaceChildren(...TRILHA.map((week, i) => h('div', { class: 'cycle-week' },
    h('h3', { text: `Semana ${i + 1}` }),
    h('ol', {}, week.map((a, d) => h('li', {},
      h('span', { class: 'cycle-day', text: days[d] }),
      h('a', { href: spotify(`${a.c} ${a.w} ${a.p.replace(/"/g, '')}`), target: '_blank', rel: 'noopener' },
        h('b', { text: `${a.c} — ${a.w}` }), h('span', { text: a.p }))))))));
  const lib = $('#resourceList');
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
    const m = shift(mondayOf(PLAN_START), w * 7);
    let p = 0, c = 0;
    for (let d = 0; d < 7; d++){ const k = shift(m, d); if (k > tk) continue; const st = dayStats(k); p += st.planned; c += st.completed; }
    const r = p ? c / p : 0, future = m > mon;
    const lv = future || !r ? 0 : r >= 0.75 ? 3 : r >= 0.4 ? 2 : 1;
    map.append(h('div', { class: 'wk' + (future ? ' future' : '') + (m === mon ? ' cur' : ''), 'data-lv': String(lv),
      title: `Semana ${w + 1} · ${fromKey(m).toLocaleDateString('pt-BR')}` + (future ? '' : ` · ${Math.round(r * 100)}%`) }));
  }

  $('#hours').replaceChildren(...AREAS.filter(a => plan[a.id]).map(a => {
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
const navFor = view => [...document.querySelectorAll('.nav button')].find(b => b.dataset.view === view || (b.dataset.group || '').split(' ').includes(view));

// Pílula escura que desliza até a aba ativa
const navInd = document.querySelector('.nav-ind');
function moveNavInd(animate = true){
  const b = document.querySelector('.nav button[aria-current="page"]');
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
  document.querySelectorAll('.nav button').forEach(b =>
    b === nb ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (typeof onViewChange === 'function') onViewChange(view);
  moveNavInd(!first);
  const hash = '#' + view + (arg ? '/' + arg : '');
  if (location.hash !== hash) history.pushState(null, '', hash);
  VIEWS[view](arg);
  window.scrollTo(0, 0);
}
document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
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
      const merged = r ? mergeStates(state, r) : state;
      const mStr = JSON.stringify(merged);
      if (mStr !== JSON.stringify(state)){ state = merged; saveLocal(); refreshView(); }
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
