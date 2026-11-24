/* ═══════════════════════════════════════════════════════════
   Personalizar, sumário, buscar e substituir
   ───────────────────────────────────────────────────────────
   Carrega depois de app.js e usa o que ele deixa no escopo global
   (prefs, editor, desenhar, aplicarPrefs, avisar, COR_TEMA…).

   - Painel “Aa” (Ctrl+,): um <dialog> no meio da tela, com seções
     (Estilos, Aparência, Texto, Escrita, Sons, Revisão, Tela e meta,
     Obsidian, Atalhos), busca de ajustes, amostra ao vivo, estilos
     prontos, estilos salvos e exportar/importar os ajustes.
   - Sumário (Ctrl+Shift+O): também central, com filtro e teclado.
   - Buscar e substituir (Ctrl+F / Ctrl+H) e tipografia inteligente.

   A regra do Escritor continua valendo: nada aqui muda a QUANTIDADE
   de caracteres do espelho. O espaço entre letras entra igual na
   textarea e no espelho, por isso o cursor continua no lugar.
   ═══════════════════════════════════════════════════════════ */
'use strict';

/* ── catálogo ────────────────────────────────────────────── */
const PAPEIS = [
  ['claro', 'Claro'], ['papel', 'Papel'], ['sepia', 'Sépia'], ['nevoa', 'Névoa'],
  ['escuro', 'Escuro'], ['noite', 'Noite'], ['grafite', 'Grafite'], ['contraste', 'Contraste'],
];
const ESCUROS = new Set(['escuro', 'noite', 'grafite', 'contraste']);
const CORES = [
  ['padrao', 'Do papel', null],
  ['azul', 'Azul', ['#2b7fff', '#5c9dff']],
  ['verde', 'Verde', ['#1f9d57', '#3fcf7f']],
  ['vermelho', 'Vermelho', ['#e3362e', '#ff6b63']],
  ['laranja', 'Laranja', ['#e57a12', '#ffa149']],
  ['roxo', 'Roxo', ['#7c5cd6', '#a68cff']],
  ['rosa', 'Rosa', ['#d63f86', '#ff7ab6']],
  ['tinta', 'Tinta', ['#1c1c1e', '#e8e8ea']],
];
const FONTES = [
  ['duo', 'Duo', 'Negrito e itálico de verdade'],
  ['mono', 'Mono', 'Monoespaçada, de máquina'],
  ['quattro', 'Quattro', 'Proporcional; itálico pela cor'],
  ['serifa', 'Serifa', 'De livro; ênfase pela cor'],
  ['sans', 'Inter', 'A da interface; ênfase pela cor'],
  ['legivel', 'Legível', 'Atkinson, feita para ler sem esforço'],
];
const SINAIS   = [['visiveis', 'Visíveis'], ['discretos', 'Discretos'], ['ocultos', 'Ocultos']];
const TITULOS  = [['tinta', 'Tinta'], ['destaque', 'Destaque']];
const ESCOPOS  = [['nenhum', 'Desligado'], ['frase', 'Frase'], ['paragrafo', 'Parágrafo'], ['linha', 'Linha']];
const ESMAECER = [['leve', 'Leve'], ['medio', 'Médio'], ['forte', 'Forte']];
const CLASSES  = [
  ['nenhuma', 'Desligado'], ['g-subst', 'Substantivos'], ['g-verbo', 'Verbos'], ['g-adj', 'Adjetivos'],
  ['g-adv', 'Advérbios'], ['g-conj', 'Conectivos'], ['todas', 'Todas'],
];
const PPM = [[150, 'Calmo'], [200, 'Médio'], [250, 'Rápido']];
const METAS = [[0, 'Sem meta'], [250, '250'], [500, '500'], [1000, '1.000'], [1667, '1.667'], [2000, '2.000']];
const CONTAGEM_NOMES = ['Palavras', 'Caracteres', 'Caracteres sem espaços', 'Frases', 'Parágrafos'];

/* chaves liga/desliga, por seção: [prefs, rótulo, explicação, busca] */
const CHAVES = {
  optEscrita: [
    ['maquina', 'Máquina de escrever', 'A folha desce enquanto você digita; clicar não mexe na página.', 'ctrl+t rolar centro'],
    ['tipografia', 'Tipografia inteligente', '"aspas" viram “aspas” e ... vira …. O -- vira — sempre, ligada ou não.', 'aspas curvas reticências travessão'],
    ['poeta', 'Modo Poeta', 'Régua de recuo e versos alinhados.', 'poesia verso recuo régua'],
  ],
  optSons: [
    ['sons', 'Sons do teclado', 'Cada tecla soa como um teclado mecânico, em qualquer campo do Escritor.', 'ligar desligar som áudio'],
    ['somSoltar', 'Som ao soltar a tecla', 'A volta da tecla também soa, mais baixa e mais aguda.', 'subida volta soltar'],
  ],
  optRevisao: [
    ['ortografia', 'Ortografia', 'Sublinha palavras suspeitas e trocas como por que e porque, mas e mais.', 'ctrl+p corretor erro porque porquê mas mais mal mau onde aonde senão demais afim tampouco'],
    ['estilo', 'Revisão de estilo', 'Repetições, clichês e frases longas.', 'ctrl+r repetição clichê'],
  ],
  optTela: [
    ['barraSome', 'Esconder a barra enquanto escrevo', 'Ela volta ao mexer o mouse ou rolar.', 'barra superior menu sumir distração'],
    ['rodape', 'Mostrar o rodapé', 'Contagem, leitura, meta e “salvo”.', 'rodapé estatística'],
    ['mostrarTempo', 'Mostrar o tempo de leitura', 'O “min de leitura” ao lado da contagem.', 'minutos leitura'],
  ],
};

/* Os atalhos em três grupos, cada um num cartão: o que abre e guarda,
   o que se faz escrevendo e o que ajuda a revisar. */
const ATALHOS = [
  ['Geral', [['Personalizar', 'Ctrl+,'], ['Sumário', 'Ctrl+Shift+O'], ['Notas', 'Ctrl+O'], ['Nova nota', 'Ctrl+Alt+N'],
    ['Salvar ou baixar', 'Ctrl+S'], ['Visualizar', 'Ctrl+E'], ['Tela cheia', 'Ctrl+Shift+F'], ['Buscar', 'Ctrl+F']]],
  ['Escrever', [['Desfazer', 'Ctrl+Z'], ['Refazer', 'Ctrl+Y'], ['Negrito', 'Ctrl+B'], ['Itálico', 'Ctrl+I'],
    ['Ligação [[nota]]', 'Ctrl+K'], ['Realçar', 'Ctrl+Shift+H'], ['Comentário', 'Ctrl+/']]],
  ['Revisar', [['Substituir', 'Ctrl+H'], ['Modo Foco', 'Ctrl+D'], ['Máquina de escrever', 'Ctrl+T'], ['Classes gramaticais', 'Ctrl+G'],
    ['Ortografia', 'Ctrl+P'], ['Revisão de estilo', 'Ctrl+R'], ['Corrigir a palavra', 'Ctrl+;']]],
];

const PADRAO = {
  tema: 'claro', autoClaro: 'claro', autoEscuro: 'escuro', cor: 'padrao', corPropria: '#2b7fff',
  titulos: 'tinta', sinais: 'visiveis', fonte: 'duo', corpo: 18, altura: 1.75, letras: 0, coluna: 46,
  escopo: 'nenhum', esmaecer: 'medio', maquina: false, tipografia: false,
  ortografia: true, estilo: true, classe: 'nenhuma',
  barraSome: true, rodape: true, mostrarTempo: true, contagem: 0, ppm: 200, meta: 0,
  sons: false, switch: 'creamy', somVolume: 60, somSoltar: true,
};

/* O que um estilo guarda: o visual e o jeito de escrever. Meta,
   contagem e a pasta do Obsidian ficam de fora: não são “estilo”. */
const CHAVES_ESTILO = ['tema', 'cor', 'titulos', 'sinais', 'fonte', 'corpo', 'altura', 'letras', 'coluna',
  'escopo', 'esmaecer', 'maquina', 'barraSome', 'rodape', 'classe'];
const base = Object.fromEntries(CHAVES_ESTILO.map(k => [k, PADRAO[k]]));
const ESTILOS = [
  ['padrao', 'Escritor', 'O de fábrica', {}],
  ['livro', 'Livro', 'Serifa no papel creme', { tema: 'papel', fonte: 'serifa', corpo: 19, altura: 1.85, coluna: 38, sinais: 'ocultos' }],
  ['noturno', 'Noturno', 'Azul-noite, sinais baixos', { tema: 'noite', fonte: 'quattro', altura: 1.8, coluna: 44, letras: 0.01, sinais: 'discretos', titulos: 'destaque' }],
  ['foco', 'Concentração', 'Uma frase por vez', { tema: 'nevoa', corpo: 19, altura: 1.8, coluna: 40, sinais: 'discretos', escopo: 'frase', esmaecer: 'forte', maquina: true, rodape: false }],
  ['datilografo', 'Datilógrafo', 'Mono na sépia', { tema: 'sepia', fonte: 'mono', altura: 1.9, coluna: 42, letras: 0.01, maquina: true, escopo: 'linha', esmaecer: 'leve' }],
  ['revisao', 'Revisão', 'Coluna larga, tudo à vista', { fonte: 'mono', corpo: 17, altura: 1.7, coluna: 52, titulos: 'destaque', barraSome: false }],
  ['grafite', 'Grafite', 'Escuro macio, sem serifa', { tema: 'grafite', fonte: 'sans', altura: 1.8, coluna: 42, letras: 0.01, sinais: 'discretos' }],
  ['contraste', 'Alto contraste', 'Letra grande, preto e branco', { tema: 'contraste', fonte: 'sans', corpo: 21, altura: 1.9, coluna: 42, letras: 0.02, titulos: 'destaque' }],
].map(([id, nome, dica, v]) => ({ id, nome, dica, valores: Object.assign({}, base, v) }));

/* ── papel automático e cor de destaque ──────────────────── */
const mqEscuro = matchMedia('(prefers-color-scheme: dark)');
function temaEfetivo(){
  if (prefs.tema !== 'auto') return prefs.tema;
  return mqEscuro.matches ? prefs.autoEscuro : prefs.autoClaro;
}
mqEscuro.addEventListener('change', () => { if (prefs.tema === 'auto') aplicarPrefs(); });

function luminancia(hex){
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
/* Uma cor escolhida à mão precisa aparecer em qualquer papel: escura
   demais no papel escuro clareia, clara demais no papel claro escurece. */
function corLegivel(hex, escuro){
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const l = luminancia(hex);
  if (escuro && l < .2) return `color-mix(in srgb, ${hex} 62%, #fff)`;
  if (!escuro && l > .55) return `color-mix(in srgb, ${hex} 62%, #000)`;
  return hex;
}
function corDeDestaque(){
  const escuro = ESCUROS.has(temaEfetivo());
  if (prefs.cor === 'propria') return corLegivel(prefs.corPropria, escuro);
  const par = (CORES.find(c => c[0] === prefs.cor) || [])[2];
  return par ? par[escuro ? 1 : 0] : null;
}

/* ── aplicar (chamada no fim de aplicarPrefs) ────────────── */
function aplicarExtras(){
  const raiz = document.documentElement.style;
  const tema = temaEfetivo();
  corpo.dataset.theme = tema;
  document.querySelector('meta[name=theme-color]').content = COR_TEMA[tema] || '#ffffff';
  raiz.setProperty('--altura', String(prefs.altura));
  raiz.setProperty('--coluna', prefs.coluna + 'rem');
  raiz.setProperty('--letras', (+prefs.letras || 0) + 'em');
  corpo.dataset.sinais = prefs.sinais;
  corpo.dataset.rodape = prefs.rodape ? '1' : '0';
  corpo.dataset.titulos = prefs.titulos;
  corpo.dataset.esmaecer = prefs.esmaecer;
  corpo.dataset.tempo = prefs.mostrarTempo ? '1' : '0';
  const c = corDeDestaque();
  if (c){
    corpo.style.setProperty('--caret', c);
    corpo.style.setProperty('--c-link', c);
    corpo.style.setProperty('--selecao', `color-mix(in srgb, ${c} 22%, transparent)`);
  } else {
    ['--caret', '--c-link', '--selecao'].forEach(v => corpo.style.removeProperty(v));
  }
  if (!prefs.barraSome) corpo.dataset.chrome = 'visivel';
  if (painel.open) sincronizar();
  if (editor) pintarMeta(editor.value);
}

/* A barra só some se a preferência deixar */
esconderChrome = function(){ if (prefs.barraSome && corpo.dataset.chrome !== 'oculto') corpo.dataset.chrome = 'oculto'; };

/* ── utilidades de DOM ───────────────────────────────────── */
function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function botao(conteudo, attrs = {}, onclick){
  const b = el('button');
  b.type = 'button';
  for (const [k, v] of Object.entries(attrs)) if (v != null) b.setAttribute(k, v);
  if (typeof conteudo === 'string') b.textContent = conteudo; else b.append(...conteudo);
  if (onclick) b.onclick = onclick;
  return b;
}
const normal = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* O que precisa redesenhar o espelho; o resto é só CSS */
const REDESENHA = new Set(['fonte', 'corpo', 'altura', 'coluna', 'letras', 'sinais', 'maquina', 'escopo', 'classe', 'ortografia', 'estilo']);
function mudar(chave, valor){
  prefs[chave] = valor;
  aplicarPrefs();
  if (REDESENHA.has(chave)) desenhar();
  if (chave === 'maquina' && prefs.maquina) centralizarCursor();
  if (chave === 'letras' && prefs.poeta) atualizarRegua();
}
function aplicarVarios(valores){
  Object.assign(prefs, valores);
  aplicarPrefs();
  desenhar();
  if (prefs.maquina) centralizarCursor();
}

/* ═══════════════════════════════════════════════════════════
   O painel
   ═══════════════════════════════════════════════════════════ */
const painel = $('#ajustes');
const rolagem = $('#ajRolagem');
const secoes = [...painel.querySelectorAll('.aj-secao')];
const navBotoes = [...painel.querySelectorAll('.aj-nav [data-ir]')];

/* grupo de rádios: o estado vai em aria-checked; as setas andam e escolhem */
function grupo(id, itens, chave, desenho, aoEscolher){
  const caixa = $('#' + id);
  caixa.replaceChildren(...itens.map((it) => {
    const valor = it[0];
    const b = botao(desenho(it), { role: 'radio', 'data-v': String(valor), title: it[1] });
    b.onclick = () => aoEscolher ? aoEscolher(valor) : mudar(chave, valor);
    return b;
  }));
  caixa.dataset.chave = chave;
}
const rotulo = (it) => [el('span', null, it[1])];

function amostraDePapel(tema, fonte, letra = 'Aa'){
  const i = el('i', 'aj-pg p-' + tema);
  i.append(el('b', 'f-' + fonte, letra), el('i', 'aj-pg-linhas'));
  return i;
}

/* A miniatura de um estilo é uma página de verdade em ponto pequeno: o
   papel, a fonte, o corpo e a largura da coluna dele, os sinais do
   Markdown como ele mostra, o título em destaque quando é o caso, o foco
   esmaecendo o resto e o cursor da máquina de escrever. */
const FOLHA_ESCUROS = new Set(['escuro', 'noite', 'grafite', 'contraste']);
function amostraDeEstilo(v){
  const tema = v.tema === 'auto' ? (mqEscuro.matches ? v.autoEscuro : v.autoClaro) || 'claro' : v.tema || 'claro';
  const pg = el('i', 'aj-pg aj-mini p-' + tema + (FOLHA_ESCUROS.has(tema) ? ' aj-mini--escuro' : ''));
  const folha = el('span', 'aj-mini-folha f-' + (v.fonte || 'duo'));
  const corpo = +v.corpo || 18, coluna = +v.coluna || 46;
  folha.style.setProperty('--mini-fs', (corpo * 0.42).toFixed(2) + 'px');
  folha.style.setProperty('--mini-lh', String(v.altura || 1.75));
  folha.style.setProperty('--mini-w', Math.min(88, Math.max(56, coluna * 1.55)).toFixed(0) + '%');
  folha.style.setProperty('--mini-ls', ((+v.letras || 0)) + 'em');
  const tit = el('b', 'aj-mini-tit' + (v.titulos === 'destaque' ? ' is-destaque' : ''));
  if (v.sinais !== 'ocultos') tit.append(el('i', 'aj-mini-sinal' + (v.sinais === 'discretos' ? ' is-discreto' : ''), '# '));
  tit.append('Capítulo um');
  const foco = v.escopo && v.escopo !== 'nenhum';
  const apaga = { leve: .55, medio: .34, forte: .2 }[v.esmaecer] || .34;
  const txt = el('span', 'aj-mini-txt');
  const um = el('span', null, 'A folha estava em branco. ');
  const resto = el('span', null, 'Depois veio a primeira frase, e com ela o resto da página.');
  if (foco) resto.style.opacity = String(apaga);
  txt.append(um, resto);
  if (v.maquina) txt.append(el('i', 'aj-mini-cursor'));
  folha.append(tit, txt);
  pg.append(folha);
  return pg;
}

function montar(){
  /* estilos prontos */
  $('#ajEstilos').replaceChildren(...ESTILOS.map(e => {
    const b = botao([amostraDeEstilo(e.valores), el('b', 'aj-est-nome', e.nome), el('small', null, e.dica)],
      { 'aria-pressed': 'false', 'data-estilo': e.id, title: `Usar o estilo ${e.nome}` },
      () => usarEstilo(e.valores, e.nome));
    return b;
  }));

  /* papel: o Automático primeiro, depois os oito */
  grupo('optTema', [['auto', 'Automático'], ...PAPEIS], 'tema', ([id, nome]) => {
    const pg = id === 'auto' ? el('i', 'aj-pg aj-pg--auto') : amostraDePapel(id, 'serifa');
    if (id === 'auto') pg.append(el('b', null, 'Aa'));
    return [pg, el('span', null, nome)];
  });
  grupo('optAutoClaro', PAPEIS.filter(p => !ESCUROS.has(p[0])), 'autoClaro', ([id, nome]) => [el('i', 'aj-ponto p-' + id), el('span', null, nome)]);
  grupo('optAutoEscuro', PAPEIS.filter(p => ESCUROS.has(p[0])), 'autoEscuro', ([id, nome]) => [el('i', 'aj-ponto p-' + id), el('span', null, nome)]);

  /* cores: as prontas e uma escolhida à mão */
  grupo('optCor', CORES.filter(c => c[0] !== 'propria'), 'cor', ([id, nome]) => {
    const i = el('i', 'aj-bola' + (id === 'padrao' ? ' aj-bola--papel' : ''));
    i.dataset.cor = id;
    return [i, el('span', 'aj-sr', nome)];
  });
  const propria = el('label', 'aj-propria');
  propria.title = 'Escolher outra cor';
  const seletor = el('input');
  seletor.type = 'color';
  seletor.id = 'corPropria';
  seletor.setAttribute('aria-label', 'Escolher outra cor de destaque');
  seletor.oninput = () => { prefs.corPropria = seletor.value; mudar('cor', 'propria'); };
  propria.append(el('i', 'aj-bola aj-bola--propria'), seletor);
  $('#optCor').append(propria);

  grupo('optTitulos', TITULOS, 'titulos', rotulo);
  grupo('optSinais', SINAIS, 'sinais', rotulo);
  grupo('optFonte', FONTES, 'fonte', ([id, nome, dica]) => {
    const t = el('span', 'aj-fonte-txt');
    t.append(el('b', null, nome), el('small', null, dica));
    return [el('span', 'aj-fonte-amostra f-' + id, 'Água, café.'), t];
  });
  grupo('optEscopo', ESCOPOS, 'escopo', rotulo);
  grupo('optEsmaecer', ESMAECER, 'esmaecer', rotulo);
  grupo('optClasse', CLASSES, 'classe', ([id, nome]) => [el('span', 'aj-classe ' + (id.startsWith('g-') ? 'c-' + id : ''), nome)]);
  grupo('optPpm', PPM, 'ppm', ([n, nome]) => [el('span', null, nome), el('small', null, String(n))], (n) => { mudar('ppm', n); atualizarNumeros(editor.value); });
  grupo('optMeta', METAS, 'meta', rotulo);

  /* chaves */
  for (const [id, lista] of Object.entries(CHAVES)){
    $('#' + id).replaceChildren(...lista.map(([k, nome, dica, busca]) => {
      const txt = el('span', 'aj-rot');
      txt.append(el('b', null, nome), el('small', null, dica));
      const b = botao([txt, el('i', 'aj-interruptor')], { class: 'aj-chave', role: 'switch', 'aria-checked': 'false', 'data-k': k, 'data-busca': busca });
      b.onclick = () => {
        if (k === 'poeta'){ $('#togPoeta').click(); sincronizar(); return; }
        mudar(k, !prefs[k]);
        if (k === 'sons' && SONS) SONS.preparar();
      };
      return b;
    }));
  }

  /* sons: o switch, a acústica, o volume e o campo de teste */
  if (SONS){
    grupo('optSwitch', SONS.SWITCHES.map(s => [s.id, s.nome, s]), 'switch', ([, nome, s]) => {
      const topo = el('span', 'aj-sw-topo');
      const txt = el('span', 'aj-sw-txt');
      txt.append(el('b', null, nome), el('small', null, `${s.tipo} · ${s.modelo}`));
      topo.append(desenhoDoSwitch(s), txt);
      return [topo, el('small', 'aj-sw-dica', s.dica)];
    }, (id) => { prefs.sons = true; mudar('switch', id); SONS.preparar(); });
  }
  $('#rngSom').oninput = (e) => { prefs.somVolume = +e.target.value; salvarPrefs(); if (SONS) SONS.volume(); pintarVolume(); };

  /* contagem */
  $('#selContagem').replaceChildren(...CONTAGENS.map((_, i) => { const o = el('option', null, CONTAGEM_NOMES[i] || ('Contagem ' + (i + 1))); o.value = i; return o; }));
  $('#selContagem').onchange = (e) => { prefs.contagem = +e.target.value; salvarPrefs(); atualizarNumeros(editor.value); pintarAmostra(); };

  /* atalhos */
  $('#ajAtalhos').replaceChildren(...ATALHOS.map(([titulo, lista]) => {
    const sec = el('section', 'aj-at-grupo');
    const dl = el('dl', 'aj-at-lista');
    lista.forEach(([o, t]) => {
      const linha = el('div', 'aj-at-linha');
      const dd = el('dd');
      // no Mac o atalho é uma tecla só, com os símbolos: ⇧⌘O
      if (MAC) dd.append(el('kbd', null, paraSO(t)));
      else dd.append(...t.split('+').map(p => el('kbd', null, p)));
      linha.append(el('dt', null, o), dd);
      dl.append(linha);
    });
    sec.append(el('h4', 'aj-at-tit', titulo), dl);
    return sec;
  }));

  /* faixas */
  $('#rngCorpo').oninput = (e) => definirCorpo(+e.target.value);
  $('#rngAltura').oninput = (e) => mudar('altura', +e.target.value);
  $('#rngLetras').oninput = (e) => mudar('letras', +e.target.value);
  $('#rngColuna').oninput = (e) => mudar('coluna', +e.target.value);
  $('#numMeta').onchange = (e) => mudar('meta', Math.max(0, Math.round(+e.target.value || 0)));

  /* autoria: grava a cada letra, sem redesenhar a folha */
  const autoria = (chave) => (e) => { prefs[chave] = e.target.value.trim(); salvarPrefs(); pintarAutoria(); };
  $('#txtAutor').oninput = autoria('autor');
  $('#txtAutorLink').oninput = autoria('autorLink');
}

/* O switch visto de cima, sem a tecla: a carcaça e a haste em cruz,
   na cor que dá nome a ele. */
function desenhoDoSwitch(s){
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', 'aj-sw-desenho');
  svg.setAttribute('aria-hidden', 'true');
  const escura = luminancia(s.haste) < .05;
  const traco = escura ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.22)';
  svg.innerHTML =
    `<rect x="2.5" y="2.5" width="43" height="43" rx="8" fill="${s.base}" stroke="rgba(0,0,0,.14)"/>` +
    `<rect x="6.5" y="6.5" width="35" height="35" rx="5.5" fill="${s.topo}"/>` +
    `<rect x="19" y="8.5" width="10" height="3.5" rx="1.5" fill="rgba(0,0,0,.3)"/>` +
    `<g class="aj-sw-haste"><rect x="12.5" y="14" width="23" height="23" rx="5" fill="${s.haste}" stroke="${traco}"/>` +
    `<path d="M21.6 16.5h4.8v6.1h6.1v4.8h-6.1v6.1h-4.8v-6.1h-6.1v-4.8h6.1z" fill="${escura ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.42)'}" stroke="${escura ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.18)'}" stroke-width=".8"/></g>`;
  return svg;
}
function pintarVolume(){
  $('#rngSom').value = prefs.somVolume;
  $('#outSom').textContent = Math.round(prefs.somVolume) + '%';
  pintarFaixas();
}

/* A prévia é a própria assinatura dos arquivos exportados. */
function pintarAutoria(){
  const caixa = $('#autPrevia');
  if (!caixa) return;
  caixa.innerHTML = assinaturaHTML();
  caixa.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
  const campo = $('#txtAutorLink');
  campo.toggleAttribute('aria-invalid', !!prefs.autorLink && !linkDoAutor());
}

/* As faixas pintam a parte já percorrida na cor de destaque, como no
   macOS. O CSS lê a fração em --p. */
function pintarFaixas(){
  painel.querySelectorAll('input[type=range]').forEach(r => {
    const min = +r.min || 0, max = +r.max || 100;
    r.style.setProperty('--p', ((+r.value - min) / (max - min) * 100).toFixed(2) + '%');
  });
}
painel.addEventListener('input', (e) => { if (e.target.type === 'range') pintarFaixas(); });

/* estado → tela: só atributos, nada é recriado, e o foco do teclado não se perde */
function sincronizar(){
  painel.querySelectorAll('[role=radiogroup][data-chave]').forEach(g => {
    const atual = String(prefs[g.dataset.chave]);
    g.querySelectorAll('[role=radio]').forEach(b => {
      const sim = b.dataset.v === atual;
      b.setAttribute('aria-checked', String(sim));
      b.tabIndex = sim ? 0 : -1;
    });
    if (!g.querySelector('[aria-checked="true"]')){ const p = g.querySelector('[role=radio]'); if (p) p.tabIndex = 0; }
  });
  // a cor própria não é um rádio do grupo: ela se marca sozinha
  const propria = painel.querySelector('.aj-propria');
  propria.classList.toggle('on', prefs.cor === 'propria');
  propria.querySelector('.aj-bola').style.background = prefs.corPropria;
  $('#corPropria').value = /^#[0-9a-f]{6}$/i.test(prefs.corPropria) ? prefs.corPropria : '#2b7fff';
  painel.querySelectorAll('.aj-bola[data-cor]').forEach(i => {
    const par = (CORES.find(c => c[0] === i.dataset.cor) || [])[2];
    if (par) i.style.background = par[ESCUROS.has(temaEfetivo()) ? 1 : 0];
  });
  $('#ajAuto').hidden = prefs.tema !== 'auto';

  painel.querySelectorAll('.aj-chave[data-k]').forEach(b => b.setAttribute('aria-checked', String(!!prefs[b.dataset.k])));

  $('#rngCorpo').value = prefs.corpo;
  $('#corpoMenos').disabled = prefs.corpo <= CORPO_MIN;
  $('#corpoMais').disabled = prefs.corpo >= CORPO_MAX;
  $('#rngAltura').value = prefs.altura;
  $('#outAltura').textContent = Number(prefs.altura).toFixed(2).replace('.', ',');
  $('#rngLetras').value = prefs.letras;
  const l = Math.round((+prefs.letras || 0) * 1000) / 10;
  $('#outLetras').textContent = l === 0 ? 'normal' : (l > 0 ? '+' : '−') + String(Math.abs(l)).replace('.', ',') + '%';
  $('#rngColuna').value = prefs.coluna;
  $('#outColuna').textContent = prefs.coluna + ' rem';
  const cpl = letrasPorLinha();
  $('#outColunaDica').textContent = cpl ? `Cerca de ${cpl} letras por linha. Entre 60 e 75 é o confortável.` : 'Entre 60 e 75 letras por linha é o confortável.';
  pintarFaixas();
  if (typeof medirPilulas === 'function') medirPilulas();
  pintarVolume();
  $('#selContagem').value = String(prefs.contagem);
  if (document.activeElement !== $('#numMeta')) $('#numMeta').value = prefs.meta || '';
  if (document.activeElement !== $('#txtAutor')) $('#txtAutor').value = prefs.autor || '';
  if (document.activeElement !== $('#txtAutorLink')) $('#txtAutorLink').value = prefs.autorLink || '';
  pintarAutoria();

  /* estilos: marca o que bate com o estado de agora */
  const bate = (v) => Object.entries(v).every(([k, x]) => prefs[k] === x);
  painel.querySelectorAll('[data-estilo]').forEach(b => {
    const e = ESTILOS.find(x => x.id === b.dataset.estilo);
    b.setAttribute('aria-pressed', String(bate(e.valores)));
  });
  pintarMeus(bate);
  pintarAmostra();
}

/* ── estilos ─────────────────────────────────────────────── */
function usarEstilo(valores, nome){
  aplicarVarios(valores);
  avisar(`estilo ${nome}`);
}
function pintarMeus(bate){
  const lista = Array.isArray(prefs.meusEstilos) ? prefs.meusEstilos : [];
  const caixa = $('#ajMeus');
  if (!lista.length){ caixa.replaceChildren(el('p', 'aj-vazio', 'Nenhum ainda. Ajuste do seu jeito e dê um nome.')); return; }
  const focado = document.activeElement && document.activeElement.closest('#ajMeus') ? document.activeElement.dataset.i : null;
  caixa.replaceChildren(...lista.map((e, i) => {
    const v = e.valores || {};
    const item = el('div', 'aj-meu');
    const usar = botao([amostraDeEstilo(Object.assign({}, base, v)), el('b', 'aj-est-nome', e.nome)],
      { 'aria-pressed': String(bate(v)), 'data-i': String(i), title: `Usar ${e.nome}` }, () => usarEstilo(v, e.nome));
    const tirar = botao('×', { class: 'aj-meu-x', 'aria-label': `Apagar o estilo ${e.nome}`, title: 'Apagar' }, () => {
      prefs.meusEstilos = lista.filter((_, j) => j !== i);
      salvarPrefs(); sincronizar();
      avisar(`“${e.nome}” apagado`);
    });
    item.append(usar, tirar);
    return item;
  }));
  if (focado != null){ const b = caixa.querySelector(`[data-i="${focado}"]`); if (b) b.focus(); }
}
$('#ajSalvarForm').onsubmit = (e) => {
  e.preventDefault();
  const campo = $('#ajNomeEstilo');
  const nome = campo.value.trim().replace(/\s+/g, ' ');
  if (!nome){ campo.focus(); avisar('dê um nome ao estilo'); return; }
  const lista = Array.isArray(prefs.meusEstilos) ? prefs.meusEstilos.slice() : [];
  const valores = Object.fromEntries([...CHAVES_ESTILO, 'autoClaro', 'autoEscuro', 'corPropria'].map(k => [k, prefs[k]]));
  const i = lista.findIndex(x => normal(x.nome) === normal(nome));
  if (i >= 0) lista[i] = { nome, valores };
  else {
    if (lista.length >= 12){ avisar('até 12 estilos; apague um antes'); return; }
    lista.push({ nome, valores });
  }
  prefs.meusEstilos = lista;
  salvarPrefs();
  campo.value = '';
  sincronizar();
  avisar(i >= 0 ? `“${nome}” atualizado` : `“${nome}” salvo`);
};

/* ── amostra ao vivo ─────────────────────────────────────────
   Pedaços: [classe, texto, grupo do foco, classe gramatical] */
const AMOSTRA = [
  [['mk', '# ', 0], ['t-h', 'O farol', 0, 'g-subst']],
  [],
  [['', 'A ', 1], ['mk', '**', 1], ['t-forte', 'chuva', 1, 'g-subst'], ['mk', '**', 1], ['', ' ', 1], ['', 'voltou', 1, 'g-verbo'], ['', ' às ', 1], ['mk', '_', 1], ['t-enf', 'três', 1], ['mk', '_', 1], ['', ' da ', 1], ['', 'tarde', 1, 'g-subst'], ['', '. ', 1],
   ['', 'Ninguém ', 2], ['', 'lembrava', 2, 'g-verbo'], ['', ' uma ', 2], ['erro', 'excessão', 2, 'g-subst'], ['', ' ', 2], ['', 'tão', 2, 'g-adv'], ['', ' ', 2], ['', 'antiga', 2, 'g-adj'], ['', ', ', 2], ['', 'e', 2, 'g-conj'], ['', ' ', 2], ['estilo', 'de repente', 2], ['', ' a luz apagou.', 2]],
  [],
  [['t-lista', '- ', 3], ['', 'um ', 3], ['mk', '[', 3], ['t-link', 'caderno', 3], ['mk', '](', 3], ['t-url', 'url', 3], ['mk', ')', 3], ['', ' e um ', 3], ['t-cod', '`código`', 3]],
];
function pintarAmostra(){
  const ativos = { nenhum: null, frase: [1], paragrafo: [1, 2], linha: [1] }[prefs.escopo];
  const folha = $('#ajFolha');
  folha.replaceChildren(...AMOSTRA.map(linha => {
    const p = el('div', 'aj-folha-linha');
    if (!linha.length) p.append(' ');
    for (const [cls, txt, g, gram] of linha){
      const classes = [];
      if (cls === 'erro'){ if (prefs.ortografia) classes.push('erro'); }
      else if (cls === 'estilo'){ if (prefs.estilo) classes.push('estilo'); }
      else if (cls) classes.push(cls);
      if (gram && (prefs.classe === 'todas' || prefs.classe === gram)) classes.push(gram);
      if (ativos && !ativos.includes(g)) classes.push('dim');
      if (!classes.length){ p.append(txt); continue; }
      p.append(el('span', classes.join(' '), txt));
    }
    return p;
  }));
  const nome = (FONTES.find(f => f[0] === prefs.fonte) || ['', 'Duo'])[1];
  const papel = prefs.tema === 'auto' ? `Automático (${(PAPEIS.find(p => p[0] === temaEfetivo()) || ['', ''])[1]})` : (PAPEIS.find(p => p[0] === prefs.tema) || ['', ''])[1];
  $('#ajAmostraPe').textContent = `${papel} · ${nome} ${prefs.corpo} px · entrelinha ${Number(prefs.altura).toFixed(2).replace('.', ',')}`;
}

/* letras por linha da coluna atual, medidas com a fonte de verdade */
function letrasPorLinha(){
  try {
    const est = getComputedStyle(editor);
    const ctx = (letrasPorLinha.c || (letrasPorLinha.c = document.createElement('canvas'))).getContext('2d');
    ctx.font = `400 ${prefs.corpo}px ${est.fontFamily}`;
    const frase = 'A chuva voltou às três da tarde e ninguém lembrava de nada assim';
    const media = ctx.measureText(frase).width / frase.length + (+prefs.letras || 0) * prefs.corpo;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const util = Math.min(prefs.coluna * rem, innerWidth) - 2 * parseFloat(est.paddingLeft || 0);
    return media > 0 ? Math.max(10, Math.round(util / media)) : 0;
  } catch { return 0; }
}

/* ── abrir e fechar ──────────────────────────────────────── */
const toast = $('#toast');
let focoAntes = null;
function abrirDialogo(d){
  $$('.menu').forEach(m => m.classList.remove('aberto'));
  if (d._terminarSaida) d._terminarSaida();      // reabrindo no meio do fechar
  focoAntes = document.activeElement;
  d.classList.remove('saindo');
  d.showModal();
  d.append(toast);                       // o aviso precisa ficar acima do painel
  document.documentElement.classList.add('folha-aberta');
}
/* O fechar espera a animação de saída OU um tempo limite, o que vier
   primeiro, e depois desarma o outro. Antes o ouvinte da animação ficava
   armado quando o tempo vencia, e a animação de ENTRADA da próxima
   abertura o disparava: o painel abria e fechava sozinho em seguida. */
function fecharDialogo(d){
  if (!d.open || d.classList.contains('saindo')) return;
  const painelInterno = d.querySelector('.aj-painel');
  let relogio = 0;
  const aoAnimar = (e) => { if (e.target === painelInterno) fim(); };
  const fim = () => {
    clearTimeout(relogio);
    painelInterno.removeEventListener('animationend', aoAnimar);
    d._terminarSaida = null;
    d.classList.remove('saindo');
    if (d.open) d.close();
  };
  if (reduzido()) return fim();
  d.classList.add('saindo');
  d._terminarSaida = fim;
  painelInterno.addEventListener('animationend', aoAnimar);
  relogio = setTimeout(fim, 260);
}
const DIALOGOS = [painel, $('#sumario'), $('#revisao'), $('#comentarios')];
for (const d of DIALOGOS){
  d.addEventListener('close', () => {
    document.body.append(toast);
    if (!DIALOGOS.some(x => x.open)) document.documentElement.classList.remove('folha-aberta');
    $('#btnAa').setAttribute('aria-pressed', String(painel.open));
    if (d === painel) guardarPosicao();
    if (d.id === 'revisao'){
      $('#stRevisao').setAttribute('aria-expanded', 'false');
      if (!prefs.visualizando) editor.focus({ preventScroll: true });
      return;
    }
    if (!prefs.visualizando && (!focoAntes || focoAntes === document.body || focoAntes === editor || focoAntes.closest('.menu, .bar, .stats'))) editor.focus({ preventScroll: true });
    else if (focoAntes && focoAntes.focus) focoAntes.focus({ preventScroll: true });
  });
  d.addEventListener('cancel', (e) => { e.preventDefault(); fecharDialogo(d); });
  // as teclas param no painel: os atalhos do editor (no document) não agem por baixo
  d.addEventListener('keydown', (e) => e.stopPropagation());
  // clicar fora do painel fecha; o <dialog> ocupa a tela inteira
  d.addEventListener('mousedown', (e) => { d._fora = e.target === d; });
  d.addEventListener('click', (e) => { if (e.target === d && d._fora) fecharDialogo(d); });
}

let posicao = 0;
function guardarPosicao(){ posicao = rolagem.scrollTop; }
function abrirAjustes(secao){
  // ainda saindo (a animação do fechar): termina de fechar e abre de novo
  if (painel._terminarSaida) painel._terminarSaida();
  if (painel.open){ if (secao) irSecao(secao); else fecharDialogo(painel); return; }
  if ($('#ajBusca').value){ $('#ajBusca').value = ''; filtrar(); }
  if ($('#sumario').open) $('#sumario').close();
  // ao abrir, nada anima: chaves e pílulas já aparecem no lugar
  painel.setAttribute('data-sem-anim', '');
  abrirDialogo(painel);
  sincronizar();
  medirPilulas(true);
  requestAnimationFrame(() => requestAnimationFrame(() => painel.removeAttribute('data-sem-anim')));
  $('#btnAa').setAttribute('aria-pressed', 'true');
  irSecao(secao || secaoAtual);
  // no computador o foco vai para a busca; no celular isso abriria o teclado
  if (matchMedia('(pointer: fine)').matches) $('#ajBusca').focus({ preventScroll: true });
  else (navBotoes.find(b => b.getAttribute('aria-current') === 'true') || navBotoes[0]).focus({ preventScroll: true });
}
$('#btnAa').onclick = (e) => { e.stopPropagation(); abrirAjustes(); };
$('#ajFechar').onclick = () => fecharDialogo(painel);
$('#ajPronto').onclick = () => fecharDialogo(painel);

/* ── seções: uma por vez, escolhida na fileira de ícones ───
   Antes era uma rolagem só com um marcador que seguia a seção na tela,
   e ele se perdia nas seções curtas do fim (Obsidian, Atalhos). Agora
   cada ícone mostra a sua seção, como nas Preferências do macOS; a
   busca é que junta as seções, mostrando tudo o que bate. */
let secaoAtual = 'estilos';
function irSecao(id){
  if (!secoes.some(x => x.dataset.secao === id)) return;
  secaoAtual = id;
  if (id === 'amostra' && typeof pintarAmostra === 'function') pintarAmostra();
  secoes.forEach(x => x.classList.toggle('atual', x.dataset.secao === id));
  marcar(id);
  rolagem.scrollTop = 0;
}
function marcar(id){
  navBotoes.forEach(b => b.setAttribute('aria-current', String(b.dataset.ir === id)));
  if (typeof medirPilulas === 'function') medirPilulas();
  const ativo = navBotoes.find(b => b.dataset.ir === id);
  if (ativo && painel.open) ativo.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function marcarSecao(){ marcar(secaoAtual); }
navBotoes.forEach(b => b.onclick = () => {
  if ($('#ajBusca').value){ $('#ajBusca').value = ''; filtrar(); }
  irSecao(b.dataset.ir);
});

/* ── busca de ajustes ────────────────────────────────────── */
function filtrar(){
  const termos = normal($('#ajBusca').value.trim()).split(/\s+/).filter(Boolean);
  const bate = (t) => { const n = normal(t); return termos.every(x => n.includes(x)); };
  let achou = 0;
  for (const s of secoes){
    const daSecao = !termos.length || bate(s.querySelector('h3').textContent + ' ' + (s.dataset.busca || ''));
    let algum = false;
    s.querySelectorAll('.aj-linha, .aj-chave, .aj-estilos').forEach(u => {
      const sim = daSecao || bate((u.dataset.busca || '') + ' ' + u.textContent);
      u.classList.toggle('aj-fora', !sim);
      if (sim) algum = true;
    });
    s.hidden = !(daSecao || algum);
    s.classList.toggle('buscando', !!termos.length && !daSecao);
    const nb = navBotoes.find(b => b.dataset.ir === s.dataset.secao);
    nb.classList.toggle('apagado', s.hidden);
    if (!s.hidden) achou++;
  }
  const nada = $('#ajNada');
  nada.hidden = !!achou;
  nada.textContent = achou ? '' : `Nenhum ajuste com “${$('#ajBusca').value.trim()}”.`;
  painel.toggleAttribute('data-buscando', termos.length > 0);
  rolagem.scrollTop = 0;
  if (!termos.length) irSecao(secaoAtual);
  else {
    // com busca, a fileira acende a primeira seção que achou algo
    const primeira = secoes.find(x => !x.hidden);
    if (primeira) marcar(primeira.dataset.secao);
  }
}
$('#ajBusca').addEventListener('input', filtrar);

/* ── teclado nos grupos de rádio: setas andam e escolhem ─── */
painel.addEventListener('keydown', (e) => {
  const r = e.target.closest && e.target.closest('[role=radio]');
  if (!r || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const todos = [...r.parentElement.querySelectorAll('[role=radio]')];
  let i = todos.indexOf(r);
  if (e.key === 'Home') i = 0;
  else if (e.key === 'End') i = todos.length - 1;
  else i = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + todos.length) % todos.length;
  e.preventDefault();
  todos[i].click();
  todos[i].focus();
});

/* ── padrão, exportar, importar ──────────────────────────── */
let desfazerPadrao = null, relogioPadrao = 0;
$('#btnPadrao').onclick = () => {
  const b = $('#btnPadrao');
  if (desfazerPadrao){
    aplicarVarios(desfazerPadrao);
    desfazerPadrao = null; clearTimeout(relogioPadrao);
    b.textContent = 'Voltar ao padrão';
    avisar('ajustes de antes de volta');
    return;
  }
  desfazerPadrao = Object.fromEntries(Object.keys(PADRAO).map(k => [k, prefs[k]]));
  aplicarVarios(PADRAO);
  atualizarNumeros(editor.value);
  b.textContent = 'Desfazer';
  avisar('tudo como veio de fábrica');
  clearTimeout(relogioPadrao);
  relogioPadrao = setTimeout(() => { desfazerPadrao = null; b.textContent = 'Voltar ao padrão'; }, 8000);
};
const CHAVES_ARQUIVO = [...Object.keys(PADRAO), 'meusEstilos', 'obsidianAuto', 'autor', 'autorLink'];
$('#ajExportar').onclick = () => {
  const dados = { escritor: 'ajustes', versao: 1, ajustes: Object.fromEntries(CHAVES_ARQUIVO.map(k => [k, prefs[k]])) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
  const a = el('a');
  a.href = url; a.download = 'escritor-ajustes.json';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  avisar('ajustes exportados');
};
$('#ajImportar').onclick = () => $('#ajArquivo').click();
$('#ajArquivo').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const bruto = JSON.parse(await f.text());
    const fonte = bruto && bruto.ajustes ? bruto.ajustes : bruto;
    const novo = {};
    for (const k of CHAVES_ARQUIVO){
      if (!(k in fonte)) continue;
      const v = fonte[k];
      if (k === 'meusEstilos' ? Array.isArray(v) : typeof v === typeof PADRAO[k] || (k === 'obsidianAuto' && typeof v === 'boolean')) novo[k] = v;
    }
    if (!Object.keys(novo).length) throw new Error('vazio');
    if (novo.meusEstilos) novo.meusEstilos = novo.meusEstilos.filter(x => x && typeof x.nome === 'string' && x.valores && typeof x.valores === 'object').slice(0, 12);
    aplicarVarios(novo);
    atualizarNumeros(editor.value);
    avisar('ajustes importados');
  } catch {
    avisar('esse arquivo não tem ajustes do Escritor');
  }
};

/* ── meta de palavras no rodapé ──────────────────────────── */
function pintarMeta(texto){
  const box = $('#stMeta');
  if (!prefs.meta){ box.hidden = true; return; }
  const n = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  const p = Math.min(1, n / prefs.meta);
  box.hidden = false;
  box.classList.toggle('feita', p >= 1);
  $('#metaFill').style.transform = `scaleX(${p})`;
  $('#metaTexto').textContent = p >= 1 ? 'meta cumprida' : `faltam ${(prefs.meta - n).toLocaleString('pt-BR')}`;
}
{
  const original = atualizarNumeros;
  atualizarNumeros = function(texto){ original(texto); pintarMeta(texto); };
}

/* ═══════════════════════════════════════════════════════════
   Sumário, central
   ═══════════════════════════════════════════════════════════ */
const sumario = $('#sumario');
let sumItens = [], sumSel = 0;
function titulosDoTexto(){
  const out = [];
  let pos = 0, codigo = false;
  for (const linha of editor.value.split('\n')){
    if (/^\s*(```|~~~)/.test(linha)) codigo = !codigo;
    else if (!codigo){
      const m = linha.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (m) out.push({ nivel: m[1].length, texto: m[2].replace(/[*_`]/g, ''), pos });
    }
    pos += linha.length + 1;
  }
  return out;
}
function pintarSumario(){
  const lista = $('#listaSumario');
  const termos = normal($('#sumBusca').value.trim()).split(/\s+/).filter(Boolean);
  const todos = titulosDoTexto();
  sumItens = todos.filter(t => termos.every(x => normal(t.texto).includes(x)));
  if (!todos.length){ lista.replaceChildren(el('li', 'sum-vazio', 'Sem títulos ainda. Linhas que começam com # viram títulos e aparecem aqui.')); return; }
  if (!sumItens.length){ lista.replaceChildren(el('li', 'sum-vazio', 'Nenhum título com esse nome.')); return; }
  sumSel = Math.max(0, Math.min(sumSel, sumItens.length - 1));
  lista.replaceChildren(...sumItens.map((t, i) => {
    const li = el('li');
    li.style.setProperty('--nivel', t.nivel - 1);
    const b = botao([el('i', 'sum-nivel', '#'.repeat(t.nivel)), el('span', null, t.texto)],
      { role: 'option', 'aria-selected': String(i === sumSel), id: 'sum-' + i, tabindex: '-1' }, () => irParaTitulo(i));
    b.onmousemove = () => { if (sumSel !== i){ sumSel = i; marcarSum(); } };
    li.append(b);
    return li;
  }));
  marcarSum();
}
function marcarSum(){
  $$('#listaSumario [role=option]').forEach((b, i) => b.setAttribute('aria-selected', String(i === sumSel)));
  const atual = $('#sum-' + sumSel);
  $('#sumBusca').setAttribute('aria-activedescendant', atual ? atual.id : '');
  if (atual) atual.scrollIntoView({ block: 'nearest' });
}
function irParaTitulo(i){
  const t = sumItens[i];
  if (!t) return;
  fecharDialogo(sumario);
  focoAntes = editor;
  irPara(t.pos, t.pos);
}
function abrirSumario(){
  if (sumario.open){ fecharDialogo(sumario); return; }
  if (painel.open) painel.close();
  $('#sumBusca').value = '';
  const c = editor.selectionStart;
  sumSel = 0;
  titulosDoTexto().forEach((t, i) => { if (t.pos <= c) sumSel = i; });
  pintarSumario();
  abrirDialogo(sumario);
  $('#sumBusca').focus();
  marcarSum();
}
$('#sumBusca').addEventListener('input', () => { sumSel = 0; pintarSumario(); });
$('#sumBusca').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    e.preventDefault();
    if (!sumItens.length) return;
    sumSel = (sumSel + (e.key === 'ArrowDown' ? 1 : -1) + sumItens.length) % sumItens.length;
    marcarSum();
  } else if (e.key === 'Enter'){ e.preventDefault(); irParaTitulo(sumSel); }
});
$('#sumFechar').onclick = () => fecharDialogo(sumario);
$('#btnSumario').onclick = abrirSumario;

function irPara(a, b){
  if (prefs.visualizando) definirVisualizacao(false);
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(a, b);
  desenhar();
  rolarAte(a);
}

/* ═══════════════════════════════════════════════════════════
   Buscar e substituir
   ═══════════════════════════════════════════════════════════ */
const busca = { aberta: false, termo: '', caixa: false, palavra: false, lista: [], i: -1, texto: null };
function regexBusca(){
  if (!busca.termo) return null;
  let src = busca.termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (busca.palavra) src = `(?<![${LETRA}0-9_])${src}(?![${LETRA}0-9_])`;
  try { return new RegExp(src, busca.caixa ? 'g' : 'gi'); } catch { return null; }
}
/* chamada por desenhar(): devolve as faixas [ini, fim] dos achados */
function achadosDaBusca(texto){
  if (!busca.aberta || !busca.termo) { busca.lista = []; return []; }
  if (busca.texto !== texto){
    const re = regexBusca();
    busca.lista = [];
    if (re){ let m; while ((m = re.exec(texto)) && busca.lista.length < 5000){ if (!m[0]) { re.lastIndex++; continue; } busca.lista.push([m.index, m.index + m[0].length]); } }
    busca.texto = texto;
    if (busca.i >= busca.lista.length) busca.i = busca.lista.length - 1;
    pintarConta();
  }
  return busca.lista;
}
function achadoDaVez(){ return busca.lista[busca.i] || null; }
function pintarConta(){
  const n = busca.lista.length;
  $('#buscaConta').textContent = !busca.termo ? '' : n ? `${busca.i + 1 > 0 ? busca.i + 1 : '–'} de ${n.toLocaleString('pt-BR')}` : 'nada';
  $('#buscaConta').classList.toggle('vazio', !!busca.termo && !n);
}
function recalcular(){ busca.texto = null; achadosDaBusca(editor.value); }
function irAoAchado(dir){
  recalcular();
  const n = busca.lista.length;
  if (!n){ pintarConta(); desenhar(); return; }
  if (dir === 0){
    const c = editor.selectionStart;
    busca.i = busca.lista.findIndex(([a]) => a >= c);
    if (busca.i < 0) busca.i = 0;
  } else busca.i = (busca.i + dir + n) % n;
  const [a, b] = busca.lista[busca.i];
  pintarConta();
  editor.setSelectionRange(a, b);
  desenhar();
  rolarAte(a);
}
function abrirBusca(trocar){
  if (prefs.visualizando) definirVisualizacao(false);
  busca.aberta = true;
  $('#busca').hidden = false;
  corpo.dataset.busca = '1';
  const sel = editor.value.slice(editor.selectionStart, editor.selectionEnd);
  if (sel && !sel.includes('\n') && sel.length < 80) $('#buscaTermo').value = sel;
  busca.termo = $('#buscaTermo').value;
  medirBarra();
  const alvo = trocar ? $('#buscaTroca') : $('#buscaTermo');
  alvo.focus(); alvo.select();
  irAoAchado(0);
}
function fecharBusca(){
  busca.aberta = false;
  $('#busca').hidden = true;
  corpo.dataset.busca = '0';
  busca.lista = []; busca.texto = null;
  medirBarra();
  desenhar();
  editor.focus({ preventScroll: true });
}
/* troca respeitando o desfazer do navegador */
function inserirComoEdicao(a, b, texto){
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(a, b);
  const ok = document.execCommand && document.execCommand('insertText', false, texto);
  if (!ok){ editor.setRangeText(texto, a, b, 'end'); editor.dispatchEvent(new Event('input')); }
}
function substituirUm(){
  recalcular();
  const atual = achadoDaVez();
  if (!atual){ irAoAchado(0); return; }
  const [a, b] = atual;
  inserirComoEdicao(a, b, $('#buscaTroca').value);
  editor.setSelectionRange(a + $('#buscaTroca').value.length, a + $('#buscaTroca').value.length);
  busca.i = Math.max(-1, busca.i - 1);
  irAoAchado(1);
  $('#buscaTroca').focus();
}
function substituirTodos(){
  const re = regexBusca();
  if (!re) return;
  const v = editor.value;
  let n = 0;
  const novo = v.replace(re, () => { n++; return $('#buscaTroca').value; });
  if (!n){ avisar('nada para substituir'); return; }
  inserirComoEdicao(0, v.length, novo);
  recalcular(); pintarConta(); desenhar();
  avisar(`${n.toLocaleString('pt-BR')} ${n === 1 ? 'troca' : 'trocas'} · ${paraSO('Ctrl+Z')} desfaz`);
}
$('#btnBusca').onclick = () => abrirBusca(false);
$('#buscaFechar').onclick = fecharBusca;
$('#buscaProx').onclick = () => irAoAchado(1);
$('#buscaAnt').onclick = () => irAoAchado(-1);
$('#buscaUm').onclick = substituirUm;
$('#buscaTodos').onclick = substituirTodos;
$('#buscaCaixa').onclick = () => { busca.caixa = !busca.caixa; $('#buscaCaixa').setAttribute('aria-pressed', String(busca.caixa)); irAoAchado(0); };
$('#buscaPalavra').onclick = () => { busca.palavra = !busca.palavra; $('#buscaPalavra').setAttribute('aria-pressed', String(busca.palavra)); irAoAchado(0); };
$('#buscaTermo').addEventListener('input', (e) => { busca.termo = e.target.value; busca.i = -1; irAoAchado(0); e.target.focus(); });
for (const inp of [$('#buscaTermo'), $('#buscaTroca')]){
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); fecharBusca(); }
    else if (e.key === 'Enter'){
      e.preventDefault();
      if (inp.id === 'buscaTroca') (e.ctrlKey || e.metaKey ? substituirTodos : substituirUm)();
      else { irAoAchado(e.shiftKey ? -1 : 1); inp.focus(); }
    }
  });
}
editor.addEventListener('input', () => { if (busca.aberta) { busca.texto = null; } });

/* ── tipografia inteligente ──────────────────────────────── */
editor.addEventListener('beforeinput', (e) => {
  if (e.inputType !== 'insertText' || !e.data || e.data.length !== 1) return;
  const v = editor.value, a = editor.selectionStart, b = editor.selectionEnd;
  const antes = v[a - 1] || '';
  let troca = null, de = a;
  // O travessão vale sempre, com a tipografia inteligente ligada ou não:
  // “--” vira “—” em qualquer ponto, inclusive no começo da linha, onde
  // fica o do diálogo. Um terceiro hífen logo depois de um travessão
  // sozinho na linha devolve o “---” da linha horizontal. Ctrl+Z desfaz.
  if (e.data === '-' && a === b && antes === '-'){ troca = '—'; de = a - 1; }
  else if (e.data === '-' && a === b && antes === '—'){
    const inicio = v.lastIndexOf('\n', a - 1) + 1;
    if (/^\s*—$/.test(v.slice(inicio, a))){ troca = '---'; de = a - 1; }
  }
  // aspas curvas e reticências só com a tipografia inteligente ligada
  else if (prefs.tipografia){
    const abre = !antes || /[\s(\[{—–“‘-]/.test(antes);
    if (e.data === '"') troca = abre ? '“' : '”';
    else if (e.data === "'") troca = abre ? '‘' : '’';
    else if (e.data === '.' && a === b && v.slice(a - 2, a) === '..'){ troca = '…'; de = a - 2; }
  }
  if (troca == null) return;
  e.preventDefault();
  inserirComoEdicao(de, b, troca);
});

/* ── teclado ─────────────────────────────────────────────────
   Na captura, antes do app.js: com um painel aberto, os atalhos do
   editor não podem agir por baixo dele. */
document.addEventListener('keydown', (e) => {
  const cmd = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  const aberto = painel.open ? painel : sumario.open ? sumario : null;
  if (aberto){
    /* Esc fecha, como em todo pop-up, mesmo com algo escrito na busca
       (antes o primeiro Esc só limpava o campo). A busca recomeça
       vazia na próxima abertura. */
    if (e.key === 'Escape'){
      e.preventDefault();
      fecharDialogo(aberto);
      return;
    }
    if (cmd && !e.shiftKey && e.key === ','){ e.preventDefault(); fecharDialogo(aberto); if (aberto !== painel) abrirAjustes(); return; }
    if (cmd && e.shiftKey && k === 'o'){ e.preventDefault(); if (aberto === painel){ painel.close(); abrirSumario(); } else fecharDialogo(sumario); return; }
    if (cmd && k === 'f' && aberto === painel){ e.preventDefault(); $('#ajBusca').focus(); $('#ajBusca').select(); return; }
    return;
  }
  if (cmd && !e.altKey && !e.shiftKey && k === 'f'){ e.preventDefault(); abrirBusca(false); return; }
  if (cmd && !e.altKey && !e.shiftKey && k === 'h'){ e.preventDefault(); abrirBusca(true); return; }
  if (cmd && e.shiftKey && k === 'o'){ e.preventDefault(); e.stopImmediatePropagation(); abrirSumario(); return; }
  if (cmd && !e.shiftKey && !e.altKey && e.key === ','){ e.preventDefault(); abrirAjustes(); return; }
}, true);

montar();
aplicarPrefs();
desenhar();

/* ── rodapé: o ponto do "salvo" segue o texto que o app escreve ── */
{
  const salvo = $('#stSalvo');
  const marcar = () => {
    const t = salvo.textContent.trim();
    salvo.dataset.estado = t.startsWith('salvando') ? 'salvando' : t === 'salvo' || t.startsWith('salvo') ? 'salvo' : 'erro';
  };
  new MutationObserver(marcar).observe(salvo, { childList: true, characterData: true, subtree: true });
  marcar();
}

/* ── a pílula que desliza ───────────────────────────────────────
   O mesmo controle do GR Vagas: uma pílula atrás das opções vai até a
   escolhida, medindo posição e tamanho. Na primeira medida (e sempre
   que o painel abre) ela aparece já no lugar; depois disso desliza.
   Vale para os segmentados, as fichas, a barra lateral do Personalizar
   e o destaque dos menus da barra. */
const PILULAS = [];
function criarPilula(trilha, achar){
  const p = document.createElement('span');
  p.className = 'pilula';
  p.setAttribute('aria-hidden', 'true');
  trilha.prepend(p);
  trilha.classList.add('com-pilula');
  const medir = (semAnim, alvo) => {
    const a = alvo !== undefined ? alvo : achar(trilha);
    if (semAnim) trilha.removeAttribute('data-pronta');
    const visivel = !!a && a.offsetParent === trilha;
    trilha.toggleAttribute('data-sem-pilula', !visivel);
    if (visivel){
      trilha.style.setProperty('--px', a.offsetLeft + 'px');
      trilha.style.setProperty('--py', a.offsetTop + 'px');
      trilha.style.setProperty('--pw', a.offsetWidth + 'px');
      trilha.style.setProperty('--ph', a.offsetHeight + 'px');
    }
    if (semAnim || !trilha.hasAttribute('data-pronta'))
      requestAnimationFrame(() => requestAnimationFrame(() => trilha.setAttribute('data-pronta', '')));
  };
  const item = { trilha, medir };
  PILULAS.push(item);
  if (window.ResizeObserver) new ResizeObserver(() => { if (trilha.offsetParent) medir(true); }).observe(trilha);
  return item;
}
const marcado = (sel) => (t) => t.querySelector(sel);
painel.querySelectorAll('.aj-seg, .aj-fichas, .aj-mini').forEach(t => criarPilula(t, marcado('[role=radio][aria-checked="true"]')));
criarPilula($('#ajNav'), marcado('[aria-current="true"]'));
function medirPilulas(semAnim){ for (const p of PILULAS) if (p.trilha.offsetParent) p.medir(semAnim); }
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => medirPilulas(true)).catch(() => {});

/* Nos menus da barra a pílula só existe onde as opções correm da
   esquerda para a direita: as abas do Documento. O resto acende apenas
   sob o ponteiro (ou sob as setas do teclado). */
criarPilula($('#menuMais .mp-abas'), marcado('[aria-selected="true"]'));
$('#btnAtalhos').onclick = () => abrirAjustes('atalhos');


// a primeira seção (no fim do arquivo: as pílulas já existem)
irSecao('estilos');
