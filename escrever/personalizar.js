/* ═══════════════════════════════════════════════════════════
   Personalizar, buscar, sumário
   ───────────────────────────────────────────────────────────
   Carrega depois de app.js e usa o que ele deixa no escopo global
   (prefs, editor, overlay, scroller, desenhar, aplicarPrefs…).

   - Gaveta “Aa”: papel, cor de destaque, fonte, corpo, entrelinha,
     largura, sinais do Markdown, barra, rodapé, tipografia
     inteligente, meta de palavras e a pasta do Obsidian.
   - Buscar e substituir (Ctrl+F / Ctrl+H): os achados aparecem
     realçados no espelho; substituir entra como edição sua (Ctrl+Z
     desfaz).
   - Sumário (Ctrl+Shift+O): os títulos do texto, para pular.
   - Tipografia inteligente: “aspas”, ‘apóstrofo’, … e — ao digitar.

   A regra do Escritor continua valendo: nada aqui muda a QUANTIDADE
   de caracteres do espelho. As fontes que não têm negrito e itálico
   de mesma largura (Serifa, Sem serifa) marcam ênfase e título só
   pela cor, como a Quattro já fazia com o itálico.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const PAPEIS = [
  ['claro', 'Claro'], ['papel', 'Papel'], ['sepia', 'Sépia'], ['nevoa', 'Névoa'],
  ['escuro', 'Escuro'], ['noite', 'Noite'], ['grafite', 'Grafite'], ['contraste', 'Contraste'],
];
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
  ['duo', 'Duo', 'negrito e itálico reais'],
  ['mono', 'Mono', 'monoespaçada'],
  ['quattro', 'Quattro', 'proporcional, itálico pela cor'],
  ['serifa', 'Serifa', 'de livro; ênfase pela cor'],
  ['sans', 'Sem serifa', 'Inter; ênfase pela cor'],
];
const SINAIS = [['visiveis', 'Visíveis'], ['discretos', 'Discretos'], ['ocultos', 'Ocultos']];
const CHAVES = [
  ['barraSome', 'Esconder a barra enquanto escrevo', 'Ela volta ao mexer o mouse ou rolar.'],
  ['rodape', 'Mostrar o rodapé', 'Contagem, tempo de leitura, meta e “salvo”.'],
  ['tipografia', 'Tipografia inteligente', '"aspas" viram “aspas”, ... vira … e -- vira —.'],
  ['maquina', 'Máquina de escrever', 'A linha do cursor fica no meio da tela.'],
  ['ortografia', 'Ortografia', 'Sublinha palavras suspeitas.'],
  ['estilo', 'Revisão de estilo', 'Repetições e frases longas.'],
];
const PADRAO = { tema: 'claro', fonte: 'duo', corpo: 18, cor: 'padrao', altura: 1.75, coluna: 46, sinais: 'visiveis', barraSome: true, rodape: true, tipografia: false, meta: 0 };
const ESCUROS = new Set(['escuro', 'noite', 'grafite', 'contraste']);

/* ── aplicar ─────────────────────────────────────────────── */
function aplicarExtras(){
  const raiz = document.documentElement.style;
  raiz.setProperty('--altura', String(prefs.altura));
  raiz.setProperty('--coluna', prefs.coluna + 'rem');
  corpo.dataset.sinais = prefs.sinais;
  corpo.dataset.rodape = prefs.rodape ? '1' : '0';
  const cor = CORES.find(c => c[0] === prefs.cor);
  if (cor && cor[2]){
    const c = cor[2][ESCUROS.has(prefs.tema) ? 1 : 0];
    corpo.style.setProperty('--caret', c);
    corpo.style.setProperty('--c-link', c);
    corpo.style.setProperty('--selecao', `color-mix(in srgb, ${c} 20%, transparent)`);
  } else {
    ['--caret', '--c-link', '--selecao'].forEach(v => corpo.style.removeProperty(v));
  }
  if (!prefs.barraSome) corpo.dataset.chrome = 'visivel';
  if (gaveta && !gaveta.hidden) pintarGaveta();
  if (typeof atualizarNumeros === 'function' && editor) pintarMeta(editor.value);
}

/* A barra só some se a preferência deixar */
esconderChrome = function(){ if (prefs.barraSome) corpo.dataset.chrome = 'oculto'; };

/* ── a gaveta ────────────────────────────────────────────── */
const gaveta = $('#gaveta');
let abaGaveta = 'pers';
function abrirGaveta(aba){
  $$('.menu').forEach(m => m.classList.remove('aberto'));
  if (!gaveta.hidden && (!aba || aba === abaGaveta)){ fecharGaveta(); return; }
  if (aba) abaGaveta = aba;
  gaveta.hidden = false;
  $('#btnAa').setAttribute('aria-pressed', 'true');
  corpo.dataset.gaveta = '1';
  pintarGaveta();
}
function fecharGaveta(){
  gaveta.hidden = true;
  $('#btnAa').setAttribute('aria-pressed', 'false');
  corpo.dataset.gaveta = '0';
  if (!prefs.visualizando) editor.focus({ preventScroll: true });
}
$('#btnAa').onclick = (e) => { e.stopPropagation(); abrirGaveta('pers'); };
$('#gavetaFechar').onclick = fecharGaveta;
$$('.gaveta-abas [data-aba]').forEach(b => b.onclick = () => { abaGaveta = b.dataset.aba; pintarGaveta(); });
gaveta.addEventListener('click', (e) => e.stopPropagation());

function botao(rotulo, attrs = {}, onclick){
  const b = document.createElement('button');
  b.type = 'button';
  for (const [k, v] of Object.entries(attrs)) if (v != null) b.setAttribute(k, v);
  if (typeof rotulo === 'string') b.textContent = rotulo; else b.append(...rotulo);
  if (onclick) b.onclick = onclick;
  return b;
}
function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function mudar(chave, valor){
  prefs[chave] = valor;
  aplicarPrefs();
  if (['fonte', 'corpo', 'altura', 'coluna', 'sinais'].includes(chave) || chave === 'maquina') desenhar();
  if (chave === 'maquina' && prefs.maquina) centralizarCursor();
}

function pintarGaveta(){
  $$('.gaveta-abas [data-aba]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.aba === abaGaveta)));
  $$('.gaveta-corpo').forEach(p => { p.hidden = p.dataset.painel !== abaGaveta; });
  if (abaGaveta === 'sum'){ pintarSumario(); return; }

  $('#optTema').replaceChildren(...PAPEIS.map(([id, nome]) =>
    botao([el('i', 'papel-amostra p-' + id, 'Aa'), el('span', null, nome)], { 'aria-pressed': String(prefs.tema === id), title: nome }, () => mudar('tema', id))));
  $('#optCor').replaceChildren(...CORES.map(([id, nome, par]) => {
    const i = el('i', 'cor-bola' + (par ? '' : ' do-papel'));
    if (par) i.style.background = par[ESCUROS.has(prefs.tema) ? 1 : 0];
    return botao([i], { 'aria-pressed': String(prefs.cor === id), title: nome, 'aria-label': nome }, () => mudar('cor', id));
  }));
  $('#optFonte').replaceChildren(...FONTES.map(([id, nome, dica]) =>
    botao([el('b', 'fonte-nome f-' + id, nome), el('span', null, dica)], { 'aria-pressed': String(prefs.fonte === id) }, () => mudar('fonte', id))));
  $('#rngCorpo').value = prefs.corpo;
  $('#rngAltura').value = prefs.altura;
  $('#outAltura').textContent = Number(prefs.altura).toFixed(2).replace('.', ',');
  $('#rngColuna').value = prefs.coluna;
  $('#outColuna').textContent = prefs.coluna + ' rem';
  $('#optSinais').replaceChildren(...SINAIS.map(([id, nome]) =>
    botao(nome, { role: 'radio', 'aria-checked': String(prefs.sinais === id) }, () => mudar('sinais', id))));
  $('#optChaves').replaceChildren(...CHAVES.map(([k, nome, dica]) => {
    const b = botao([el('span', 'chave-txt', null), el('i', 'chave-bt')], { role: 'switch', 'aria-checked': String(!!prefs[k]) }, () => mudar(k, !prefs[k]));
    b.firstChild.append(el('b', null, nome), el('small', null, dica));
    return b;
  }));
  $('#numMeta').value = prefs.meta || '';
}
$('#rngCorpo').oninput = (e) => definirCorpo(+e.target.value);
$('#rngAltura').oninput = (e) => mudar('altura', +e.target.value);
$('#rngColuna').oninput = (e) => mudar('coluna', +e.target.value);
$('#numMeta').onchange = (e) => mudar('meta', Math.max(0, Math.round(+e.target.value || 0)));
$('#btnPadrao').onclick = () => { Object.assign(prefs, PADRAO); aplicarPrefs(); desenhar(); avisar('tudo como veio de fábrica'); };

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

/* ── sumário ─────────────────────────────────────────────── */
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
  const ts = titulosDoTexto();
  const c = editor.selectionStart;
  let atual = -1;
  ts.forEach((t, i) => { if (t.pos <= c) atual = i; });
  if (!ts.length){ lista.replaceChildren(el('li', 'g-nota', 'Sem títulos ainda. Linhas que começam com # viram títulos e aparecem aqui.')); return; }
  lista.replaceChildren(...ts.map((t, i) => {
    const li = el('li');
    li.style.setProperty('--nivel', t.nivel - 1);
    li.append(botao(t.texto, { 'aria-current': i === atual ? 'true' : null }, () => irPara(t.pos, t.pos)));
    return li;
  }));
}
function irPara(a, b){
  if (prefs.visualizando) definirVisualizacao(false);
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(a, b);
  desenhar();
  rolarAte(a);
}
$('#btnSumario').onclick = () => abrirGaveta('sum');
let tSumario;
editor.addEventListener('input', () => { if (!gaveta.hidden && abaGaveta === 'sum'){ clearTimeout(tSumario); tSumario = setTimeout(pintarSumario, 400); } });

/* ── buscar e substituir ─────────────────────────────────── */
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
    // o primeiro a partir do cursor
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
  avisar(`${n.toLocaleString('pt-BR')} ${n === 1 ? 'troca' : 'trocas'} · Ctrl+Z desfaz`);
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
  if (!prefs.tipografia || e.inputType !== 'insertText' || !e.data || e.data.length !== 1) return;
  const v = editor.value, a = editor.selectionStart, b = editor.selectionEnd;
  const antes = v[a - 1] || '';
  const abre = !antes || /[\s(\[{—–“‘-]/.test(antes);
  let troca = null, de = a;
  if (e.data === '"') troca = abre ? '“' : '”';
  else if (e.data === "'") troca = abre ? '‘' : '’';
  else if (e.data === '.' && a === b && v.slice(a - 2, a) === '..'){ troca = '…'; de = a - 2; }
  else if (e.data === '-' && a === b && antes === '-'){
    const inicio = v.lastIndexOf('\n', a - 1) + 1;
    if (!/^\s*-$/.test(v.slice(inicio, a))){ troca = '—'; de = a - 1; }  // “---” de linha horizontal fica como está
  }
  if (troca == null) return;
  e.preventDefault();
  inserirComoEdicao(de, b, troca);
});

/* ── teclado ─────────────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  const cmd = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (cmd && !e.altKey && k === 'f'){ e.preventDefault(); abrirBusca(false); return; }
  if (cmd && !e.altKey && k === 'h'){ e.preventDefault(); abrirBusca(true); return; }
  if (cmd && e.shiftKey && k === 'o'){ e.preventDefault(); e.stopImmediatePropagation(); abrirGaveta('sum'); return; }
  if (cmd && !e.shiftKey && !e.altKey && e.key === ','){ e.preventDefault(); abrirGaveta('pers'); return; }
  if (e.key === 'Escape'){
    if (busca.aberta && e.target === editor){ e.preventDefault(); e.stopImmediatePropagation(); fecharBusca(); return; }
    if (!gaveta.hidden){ e.preventDefault(); e.stopImmediatePropagation(); fecharGaveta(); }
  }
}, true);

aplicarPrefs();
desenhar();
