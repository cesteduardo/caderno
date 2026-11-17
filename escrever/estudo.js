/* ═══════════════════════════════════════════════════════════
   Escritor 2.0 · o caderno de estudos
   ───────────────────────────────────────────────────────────
   Três coisas que transformam a folha num caderno:
   1. Notas: várias folhas, sem barra lateral. Um pop-up central
      (Ctrl+O) mostra todas em cartões; criar, abrir e apagar
      acontecem ali. Com uma pasta do Obsidian ligada, cada nota
      vira o seu próprio .md.
   2. O botão direito: recortar, copiar e colar, e a formatação
      de quem estuda: grifo, nota de rodapé, comentário oculto,
      títulos, listas, tarefas.
   3. Imagens: colar (ou arrastar) uma imagem guarda o arquivo no
      navegador e escreve ![](anexos/…) no texto. Na pasta do
      Obsidian ela vai para "anexos", ao lado das notas.

   Dentro do Caderno as notas são do Caderno (PONTE): ali o
   pop-up de notas dá lugar ao "Ir para" de lá.
   ═══════════════════════════════════════════════════════════ */
'use strict';

pintarIcones();

/* ══════════ 1. Notas ══════════ */

const CHAVE_NOTAS = 'escritor:notas';
const CHAVE_ATUAL = 'escritor:atual';
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function lerNotas(){
  try { const v = JSON.parse(localStorage.getItem(CHAVE_NOTAS)); return Array.isArray(v) ? v : null; }
  catch { return null; }
}
let notas = lerNotas();
let notaAtual = localStorage.getItem(CHAVE_ATUAL) || '';
function gravarNotas(){
  try {
    localStorage.setItem(CHAVE_NOTAS, JSON.stringify(notas));
    localStorage.setItem(CHAVE_ATUAL, notaAtual);
  } catch { avisar('Sem espaço para guardar as notas'); }
}

/* Primeira abertura do 2.0: o documento único de antes vira a primeira nota. */
if (!PONTE && !notas){
  notas = [];
  const antigo = localStorage.getItem(CHAVE_TEXTO);
  if (localStorage.getItem(CHAVE_SEU) === '1' && antigo && antigo.trim()){
    const agora = Date.now();
    notas.push({ id: novoId(), texto: antigo, criada: agora, editada: agora });
    notaAtual = notas[0].id;
  }
  gravarNotas();
}
if (!PONTE && notaAtual && !notas.some(n => n.id === notaAtual)) notaAtual = '';

/* Chamado pelo guardarTexto() do app.js depois de cada pausa. */
function notaGuardar(texto, seu){
  if (PONTE) return;
  let n = notas.find(x => x.id === notaAtual);
  if (!n){
    if (!seu) return;                       // o guia e a folha vazia não viram nota
    n = { id: novoId(), texto: '', criada: Date.now(), editada: Date.now() };
    notas.unshift(n);
    notaAtual = n.id;
  }
  if (n.texto === texto) return;
  n.texto = texto;
  n.editada = Date.now();
  gravarNotas();
}

/* Salva já, sem esperar a pausa: antes de trocar de nota. */
function salvarJa(){
  if (PONTE) return;
  clearTimeout(relogioSalvar);
  try { localStorage.setItem(CHAVE_TEXTO, editor.value); } catch {}
  const seu = !!editor.value.trim() && editor.value.trim() !== GUIA.trim();
  try { localStorage.setItem(CHAVE_SEU, seu ? '1' : '0'); } catch {}
  notaGuardar(editor.value, seu);
  const n = notas.find(x => x.id === notaAtual);
  if (n){ n.cursor = editor.selectionStart; gravarNotas(); }
  $('#stSalvo').textContent = 'salvo';
}

/* Nota vazia não fica para trás quando se vai para outra. */
function largarSeVazia(exceto){
  const n = notas.find(x => x.id === notaAtual);
  if (n && n.id !== exceto && !n.texto.trim()){ notas = notas.filter(x => x !== n); gravarNotas(); }
}

function carregar(texto, cursor = 0, aviso){
  obsArquivo = '';
  trocarTexto(texto, aviso);
  const c = Math.min(cursor || 0, editor.value.length);
  editor.setSelectionRange(c, c);
  desenhar();
}

function abrirNota(id){
  if (id === notaAtual){ editor.focus(); return; }
  salvarJa();
  largarSeVazia(id);
  const n = notas.find(x => x.id === id);
  if (!n) return;
  notaAtual = id;
  gravarNotas();
  carregar(n.texto, n.cursor);
}

function novaNota(texto = '', aviso){
  salvarJa();
  largarSeVazia();
  const agora = Date.now();
  const n = { id: novoId(), texto, criada: agora, editada: agora };
  notas.unshift(n);
  notaAtual = n.id;
  gravarNotas();
  carregar(texto, texto.length, aviso);
}

const tituloDaNota = (t) => {
  const l = (t || '').split('\n').find(x => x.trim());
  return l ? l.replace(/^#+\s*/, '').replace(/[*_`=>[\]]/g, '').trim().slice(0, 80) : '';
};
const trechoDaNota = (t) => {
  const ls = (t || '').replace(/%%[^%\n]*%%/g, '').replace(/\[\^[^\]\s]+\]:?/g, '')
    .split('\n').filter(x => x.trim());
  return ls.slice(1).join(' ').replace(/[#*_`>=[\]()!]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
};
function quando(ms){
  const d = Date.now() - ms, min = 6e4, h = 36e5;
  if (d < min) return 'agora';
  if (d < h) return `há ${Math.round(d / min)} min`;
  const dia = new Date(ms), hoje = new Date();
  if (dia.toDateString() === hoje.toDateString()) return 'hoje, ' + dia.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const ontem = new Date(Date.now() - 864e5);
  if (dia.toDateString() === ontem.toDateString()) return 'ontem';
  return dia.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: dia.getFullYear() === hoje.getFullYear() ? undefined : 'numeric' });
}
const contarPalavras = (t) => (t.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length;

/* ── o pop-up ── */
const dNotas = $('#notas');
const lixeira = new Map();                  // id → { nota, indice, relogio }
let selNota = 0;

function itensVisiveis(){
  const q = normal($('#notasBusca').value.trim());
  const todas = [...notas].sort((a, b) => b.editada - a.editada);
  return q ? todas.filter(n => normal(n.texto).includes(q)) : todas;
}
function pintarNotas(){
  const lista = $('#notasLista');
  const vis = itensVisiveis();
  selNota = Math.max(0, Math.min(selNota, vis.length - 1));
  const cartoes = vis.map((n, i) => {
    const li = document.createElement('li');
    li.className = 'nota-cartao' + (n.id === notaAtual ? ' atual' : '');
    const abrir = document.createElement('button');
    abrir.type = 'button';
    abrir.className = 'nota-abrir';
    abrir.dataset.id = n.id;
    abrir.setAttribute('aria-current', String(n.id === notaAtual));
    if (i === selNota) abrir.classList.add('sel');
    const titulo = tituloDaNota(n.texto) || 'Nota sem título';
    const trecho = trechoDaNota(n.texto);
    abrir.innerHTML =
      `<b class="nota-titulo">${escapar(titulo)}</b>` +
      `<span class="nota-trecho">${trecho ? escapar(trecho) : '<i>Ainda vazia</i>'}</span>` +
      `<span class="nota-meta"><span>${quando(n.editada)}</span><span>${contarPalavras(n.texto).toLocaleString('pt-BR')} palavras</span>` +
      (() => { const c = citacoesDe(n); return c ? `<span class="nota-cit" title="Notas que citam esta com [[…]]">${ico('ligacoes')}${c}</span>` : ''; })() +
      `${n.id === notaAtual ? '<span class="nota-aberta">aberta</span>' : ''}</span>`;
    abrir.onclick = () => { fecharDialogo(dNotas); abrirNota(n.id); };
    const apagar = document.createElement('button');
    apagar.type = 'button';
    apagar.className = 'nota-apagar';
    apagar.title = 'Apagar esta nota';
    apagar.setAttribute('aria-label', `Apagar “${titulo}”`);
    apagar.innerHTML = ICO.apagar;
    apagar.onclick = (e) => { e.stopPropagation(); apagarNota(n.id); };
    li.append(abrir, apagar);
    return li;
  });
  // as apagadas há pouco ficam no lugar, com o Desfazer
  for (const [id, x] of lixeira){
    const li = document.createElement('li');
    li.className = 'nota-cartao nota-apagada';
    li.innerHTML = `<span>“${escapar(tituloDaNota(x.nota.texto) || 'Nota sem título')}” foi apagada.</span>`;
    const volta = document.createElement('button');
    volta.type = 'button';
    volta.className = 'aj-bt';
    volta.textContent = 'Desfazer';
    volta.onclick = () => desfazerApagar(id);
    li.append(volta);
    cartoes.splice(Math.min(x.indice, cartoes.length), 0, li);
  }
  lista.replaceChildren(...cartoes);
  const vazio = $('#notasVazio');
  vazio.hidden = vis.length > 0 || lixeira.size > 0;
  vazio.textContent = $('#notasBusca').value.trim()
    ? `Nenhuma nota com “${$('#notasBusca').value.trim()}”.`
    : 'Nenhuma nota ainda. A primeira coisa que você escrever vira uma.';
  $('#notasConta').textContent = notas.length ? notas.length.toLocaleString('pt-BR') : '';
}

function apagarNota(id){
  const indice = [...notas].sort((a, b) => b.editada - a.editada).findIndex(n => n.id === id);
  const nota = notas.find(n => n.id === id);
  if (!nota) return;
  notas = notas.filter(n => n !== nota);
  if (id === notaAtual){
    // a folha aberta foi para a lixeira: abre a mais recente, ou uma em branco
    const proxima = [...notas].sort((a, b) => b.editada - a.editada)[0];
    notaAtual = '';
    if (proxima){ notaAtual = proxima.id; carregar(proxima.texto, proxima.cursor); }
    else { const n = { id: novoId(), texto: '', criada: Date.now(), editada: Date.now() }; notas.push(n); notaAtual = n.id; carregar(''); }
  }
  gravarNotas();
  const relogio = setTimeout(() => { lixeira.delete(id); if (dNotas.open) pintarNotas(); }, 8000);
  lixeira.set(id, { nota, indice, relogio });
  pintarNotas();
}
function desfazerApagar(id){
  const x = lixeira.get(id);
  if (!x) return;
  clearTimeout(x.relogio);
  lixeira.delete(id);
  notas.push(x.nota);
  gravarNotas();
  pintarNotas();
}

function abrirNotas(){
  if (PONTE){ PONTE.trocar(); return; }
  if (dNotas.open){ fecharDialogo(dNotas); return; }
  salvarJa();
  $('#notasBusca').value = '';
  selNota = 0;
  pintarNotas();
  abrirDialogo(dNotas);
  if (matchMedia('(pointer: fine)').matches) $('#notasBusca').focus({ preventScroll: true });
}

$('#notasBusca').addEventListener('input', () => { selNota = 0; pintarNotas(); });
$('#notasBusca').addEventListener('keydown', (e) => {
  const vis = itensVisiveis();
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight'){ e.preventDefault(); selNota = Math.min(vis.length - 1, selNota + 1); pintarNotas(); }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft'){ e.preventDefault(); selNota = Math.max(0, selNota - 1); pintarNotas(); }
  else if (e.key === 'Enter'){
    e.preventDefault();
    const n = vis[selNota];
    fecharDialogo(dNotas);
    if (n) abrirNota(n.id);
    else if ($('#notasBusca').value.trim()) novaNota(`# ${$('#notasBusca').value.trim()}\n\n`);
  }
});
$('#notasNova').onclick = () => { fecharDialogo(dNotas); novaNota(''); };
$('#notasFechar').onclick = () => fecharDialogo(dNotas);
dNotas.addEventListener('close', () => {
  document.body.append($('#toast'));
  if (!document.querySelector('dialog.aj[open]')) document.documentElement.classList.remove('folha-aberta');
  if (!prefs.visualizando) editor.focus({ preventScroll: true });
});
dNotas.addEventListener('cancel', (e) => { e.preventDefault(); fecharDialogo(dNotas); });
dNotas.addEventListener('keydown', (e) => e.stopPropagation());
dNotas.addEventListener('mousedown', (e) => { dNotas._fora = e.target === dNotas; });
dNotas.addEventListener('click', (e) => { if (e.target === dNotas && dNotas._fora) fecharDialogo(dNotas); });

/* Fora do Caderno: a barra ganha "Notas", e os comandos de arquivo
   passam a trabalhar com notas em vez de jogar o texto fora. */
if (PONTE){
  $('#btnNotas').hidden = true;
  $('#btnNotasMenu').onclick = () => PONTE.trocar();
} else {
  $('#btnNotas').onclick = abrirNotas;
  $('#btnNotasMenu').onclick = abrirNotas;
  $('#btnNovo').onclick = () => novaNota('');
  $('#btnGuia').onclick = () => {
    if (editor.value.trim() === GUIA.trim()){ scroller.scrollTop = 0; return avisar('O guia já está aberto'); }
    salvarJa();
    largarSeVazia();
    notaAtual = '';
    gravarNotas();
    carregar(GUIA, 0, 'Guia do Escritor · suas notas continuam em Notas');
  };
  abrirArquivo = (file) => {
    const leitor = new FileReader();
    leitor.onload = () => novaNota(String(leitor.result).replace(/\r\n?/g, '\n'), `${file.name} virou uma nota`);
    leitor.onerror = () => avisar('Não foi possível ler o arquivo');
    leitor.readAsText(file, 'utf-8');
  };
}
window.addEventListener('pagehide', salvarJa);

/* ══════════ 2. Imagens coladas ══════════ */

const ANX_DB = 'escritor-anexos', ANX_ST = 'arquivos';
let anxConexao = null;
function anxBanco(){
  if (anxConexao) return anxConexao;
  anxConexao = new Promise((ok, erro) => {
    const r = indexedDB.open(ANX_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ANX_ST);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
  return anxConexao;
}
async function anxGuardar(nome, blob){
  const db = await anxBanco();
  return new Promise((ok, erro) => {
    const tx = db.transaction(ANX_ST, 'readwrite');
    tx.objectStore(ANX_ST).put(blob, nome);
    tx.oncomplete = () => ok();
    tx.onerror = () => erro(tx.error);
  });
}
async function anxLer(nome){
  try {
    const db = await anxBanco();
    return await new Promise((ok) => {
      const r = db.transaction(ANX_ST).objectStore(ANX_ST).get(nome);
      r.onsuccess = () => ok(r.result || null);
      r.onerror = () => ok(null);
    });
  } catch { return null; }
}
const ehLocal = (src) => !!src && !/^(?:[a-z]+:|\/\/|#)/i.test(src);
const urlsAnexo = new Map();
async function urlDoAnexo(nome){
  if (urlsAnexo.has(nome)) return urlsAnexo.get(nome);
  const b = await anxLer(nome);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urlsAnexo.set(nome, u);
  return u;
}
/* Na leitura (Visualizar) e na impressão, a imagem aparece de verdade. */
async function mostrarAnexos(raiz){
  const imgs = [...raiz.querySelectorAll('img')].filter(i => ehLocal(i.getAttribute('src')));
  await Promise.all(imgs.map(async (img) => {
    const u = await urlDoAnexo(decodeURI(img.getAttribute('src')));
    if (u) img.src = u;
  }));
}
const comoDataURL = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(blob); });
/* Nos arquivos exportados a imagem vai dentro, como data: */
async function embutirAnexos(html){
  const nomes = [...new Set([...html.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]).filter(ehLocal))];
  for (const nome of nomes){
    const b = await anxLer(decodeURI(nome));
    if (!b) continue;
    const d = await comoDataURL(b);
    if (d) html = html.split(`src="${nome}"`).join(`src="${d}"`);
  }
  return html;
}
/* Na pasta do Obsidian: cada imagem citada no texto vai para "anexos". */
async function obsAnexos(pasta, texto){
  const nomes = [...new Set([...texto.matchAll(/!\[[^\]\n]*\]\((anexos\/[^)\s]+)\)/g)].map(m => decodeURI(m[1])))];
  if (!nomes.length) return;
  try {
    const dir = await pasta.getDirectoryHandle('anexos', { create: true });
    for (const nome of nomes){
      const arquivo = nome.slice('anexos/'.length);
      try { await dir.getFileHandle(arquivo); continue; } catch {}
      const b = await anxLer(nome);
      if (!b) continue;
      const h = await dir.getFileHandle(arquivo, { create: true });
      const w = await h.createWritable();
      await w.write(b);
      await w.close();
    }
  } catch {}
}

const extensao = (tipo) => ({ 'image/jpeg': 'jpg', 'image/svg+xml': 'svg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif' }[tipo] || 'png');
async function inserirImagens(arquivos){
  const imagens = [...arquivos].filter(f => f && /^image\//.test(f.type));
  if (!imagens.length) return false;
  const d = new Date();
  const carimbo = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' +
    String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + String(d.getSeconds()).padStart(2, '0');
  const linhas = [];
  for (const [i, f] of imagens.entries()){
    const nome = `anexos/imagem-${carimbo}${imagens.length > 1 ? '-' + (i + 1) : ''}.${extensao(f.type)}`;
    try { await anxGuardar(nome, f); }
    catch { avisar('Não deu para guardar a imagem neste navegador'); return true; }
    linhas.push(`![](${nome})`);
  }
  const { selectionStart: a, selectionEnd: b, value: v } = editor;
  const antes = a > 0 && v[a - 1] !== '\n' ? '\n' : '';
  const depois = v[b] !== undefined && v[b] !== '\n' ? '\n' : '';
  inserirComoEdicao(a, b, antes + linhas.join('\n') + depois);
  if (obsPasta) obsAnexos(obsPasta, linhas.join('\n'));
  avisar(imagens.length > 1 ? `${imagens.length} imagens coladas` : 'Imagem colada · aparece no Visualizar');
  return true;
}
editor.addEventListener('paste', (e) => {
  const arquivos = [...(e.clipboardData?.files || [])];
  if (arquivos.some(f => /^image\//.test(f.type))){ e.preventDefault(); inserirImagens(arquivos); }
});
// arrastar uma imagem para a folha também cola (o .md continua abrindo como nota)
window.addEventListener('drop', (e) => {
  const fs = [...(e.dataTransfer?.files || [])];
  if (!fs.length || !fs.every(f => /^image\//.test(f.type))) return;
  e.preventDefault();
  e.stopPropagation();
  corpo.classList.remove('soltando');
  inserirImagens(fs);
}, true);
$('#btnImagem').onclick = () => $('#imgInput').click();
$('#imgInput').onchange = (e) => { inserirImagens(e.target.files); e.target.value = ''; };

/* ══════════ 3. O botão direito ══════════
   No modelo do Obsidian: no alto o que vale para onde o cursor está
   (um link, uma nota de rodapé, uma palavra com erro), depois os
   links, três submenus (Formatar, Parágrafo, Inserir) e a área de
   transferência. Os submenus abrem ao passar o mouse ou com a seta
   para a direita; Esc fecha um nível. */

const ctx = $('#ctx');
let ultimoPonteiro = 'mouse';
editor.addEventListener('pointerdown', (e) => { ultimoPonteiro = e.pointerType || 'mouse'; }, true);

const CORES_REALCE = [['', 'Padrão', '#ffd60a'], ['🟥', 'Vermelho', '#ff6b61'], ['🟧', 'Laranja', '#ff9f43'], ['🟨', 'Amarelo', '#ffd60a'],
                      ['🟩', 'Verde', '#4cd964'], ['🟦', 'Azul', '#5ac8fa'], ['🟪', 'Roxo', '#bf8aff']];

/* ── o que está debaixo do cursor ── */
function trechoNoCursor(re){
  const v = editor.value, c = editor.selectionStart;
  const ini = v.lastIndexOf('\n', c - 1) + 1;
  let fim = v.indexOf('\n', c); if (fim < 0) fim = v.length;
  const linha = v.slice(ini, fim);
  for (const m of linha.matchAll(re)){
    const a = ini + m.index, b = a + m[0].length;
    if (c >= a && c <= b) return { m, a, b };
  }
  return null;
}
function contextuais(){
  const itens = [];
  const wiki = trechoNoCursor(/\[\[([^\[\]\n|]+)(?:\|[^\]\n]*)?\]\]/g);
  const ext = trechoNoCursor(/\[([^\]\n]*)\]\(([^)\s]+)\)/g);
  const nota = trechoNoCursor(/\[\^([^\]\s]+)\](?!:)/g);
  if (wiki){
    itens.push({ id: 'ir-wiki', ico: 'abrir-link', label: `Abrir “${wiki.m[1].trim()}”`, kbd: 'Ctrl+clique', acao: () => seguirLigacao(wiki.m[1].trim()) });
  } else if (ext){
    itens.push({ id: 'abrir-url', ico: 'abrir-link', label: 'Abrir link', acao: () => window.open(ext.m[2], '_blank', 'noopener') });
    itens.push({ id: 'editar-url', ico: 'editar', label: 'Editar link', acao: () => { const a = ext.a + ext.m[1].length + 3; editor.setSelectionRange(a, a + ext.m[2].length); } });
    itens.push({ id: 'copiar-url', ico: 'copiar', label: 'Copiar URL', acao: () => { navigator.clipboard?.writeText(ext.m[2]); avisar('URL copiada'); } });
  }
  if (nota){
    const id = nota.m[1];
    itens.push({ id: 'ir-nota', ico: 'ir', label: `Ir para a nota ${id}`, acao: () => {
      const i = editor.value.search(new RegExp('^\\[\\^' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\]:', 'm'));
      if (i >= 0){ editor.setSelectionRange(i, i); rolarAte(i); }
    } });
    itens.push({ id: 'del-nota', ico: 'apagar', label: 'Excluir nota e referência', perigo: true, acao: () => excluirNotaDeRodape(id) });
  }
  // palavra da lista de erros: a troca vem primeiro, como no corretor do sistema
  atualizarDica(editor.value, editor.selectionStart);
  if (typeof correcaoAtual !== 'undefined' && correcaoAtual){
    const certa = comOMesmoMolde(correcaoAtual.errada, correcaoAtual.certa);
    itens.unshift({ id: 'corrigir', ico: 'ok', label: `Trocar por “${certa}”`, kbd: 'Ctrl+;', acao: () => corrigirNoCursor() });
  }
  if (itens.length) itens.push('sep');
  return itens;
}
function excluirNotaDeRodape(id){
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let v = editor.value
    .replace(new RegExp('\\n?^\\[\\^' + esc + '\\]:[^\\n]*$', 'm'), '')
    .replace(new RegExp('\\[\\^' + esc + '\\](?!:)', 'g'), '');
  inserirComoEdicao(0, editor.value.length, v);
  avisar(`Nota ${id} excluída · Ctrl+Z desfaz`);
}

/* ── o cardápio ── */
function cardapio(){
  const temSel = editor.selectionStart !== editor.selectionEnd;
  return [
    ...contextuais(),
    { id: 'link', ico: 'link', label: 'Adicionar link', kbd: 'Ctrl+K' },
    { id: 'link-ext', ico: 'link-externo', label: 'Adicionar link externo' },
    'sep',
    { ico: 'formatar', label: 'Formatar', sub: [
      { titulo: 'Básico' },
      { id: 'negrito', ico: 'negrito', label: 'Negrito', kbd: 'Ctrl+B' },
      { id: 'italico', ico: 'italico', label: 'Itálico', kbd: 'Ctrl+I' },
      { id: 'riscado', ico: 'riscado', label: 'Riscado' },
      { ico: 'grifo', label: 'Realce', sub: CORES_REALCE.map(([e, nome, cor]) => ({ id: 'realce:' + e, cor, label: nome, kbd: e ? '' : 'Ctrl+Shift+H' })) },
      'sep',
      { titulo: 'Avançado' },
      { id: 'codigo', ico: 'codigo', label: 'Código' },
      { id: 'equacao', ico: 'equacao', label: 'Equação' },
      { id: 'comentario', ico: 'comentario', label: 'Comentário', kbd: 'Ctrl+/' },
      { id: 'limpar', ico: 'limpar', label: 'Limpar formatação' },
    ] },
    { ico: 'paragrafo', label: 'Parágrafo', sub: [
      { titulo: 'Listas' },
      { id: 'lista', ico: 'lista', label: 'Lista de marcadores' },
      { id: 'lista-num', ico: 'lista-num', label: 'Lista numerada' },
      { id: 'tarefa', ico: 'tarefa', label: 'Lista de tarefas' },
      'sep',
      { titulo: 'Títulos' },
      ...[1, 2, 3, 4, 5, 6].map(n => ({ id: 'h' + n, txt: 'H' + n, label: 'Título ' + n })),
      { id: 'texto', ico: 'paragrafo', label: 'Texto' },
      'sep',
      { titulo: 'Bloco' },
      { id: 'citacao', ico: 'citacao', label: 'Citação' },
    ] },
    { ico: 'inserir', label: 'Inserir', sub: [
      { titulo: 'Básico' },
      { id: 'nota', ico: 'nota-rodape', label: 'Nota de rodapé' },
      { id: 'tabela', ico: 'tabela', label: 'Tabela' },
      { id: 'destaque', ico: 'destaque', label: 'Destaque' },
      { id: 'regua', ico: 'regua', label: 'Régua horizontal' },
      { id: 'imagem', ico: 'imagem', label: 'Imagem…' },
      'sep',
      { titulo: 'Avançado' },
      { id: 'bloco-codigo', ico: 'bloco-codigo', label: 'Bloco de código' },
      { id: 'equacao-bloco', ico: 'equacao-bloco', label: 'Equação em bloco' },
    ] },
    'sep',
    { id: 'recortar', ico: 'recortar', label: 'Cortar', kbd: 'Ctrl+X', off: !temSel },
    { id: 'copiar', ico: 'copiar', label: 'Copiar', kbd: 'Ctrl+C', off: !temSel },
    { id: 'colar', ico: 'colar', label: 'Colar', kbd: 'Ctrl+V' },
    { id: 'colar-texto', ico: 'colar-texto', label: 'Colar como texto simples', kbd: 'Ctrl+Shift+V' },
    { id: 'tudo', ico: 'tudo', label: 'Selecionar tudo', kbd: 'Ctrl+A' },
  ];
}

/* ── desenhar e abrir os painéis ── */
let paineis = [];
let abrirSubRelogio = 0;
function painelCtx(itens, nivel){
  const p = document.createElement('div');
  p.className = 'ctx-painel';
  p.setAttribute('role', 'menu');
  p.dataset.nivel = nivel;
  for (const it of itens){
    if (it === 'sep'){ p.append(Object.assign(document.createElement('div'), { className: 'ctx-sep' })); continue; }
    if (it.titulo){ p.append(Object.assign(document.createElement('p'), { className: 'ctx-titulo', textContent: it.titulo })); continue; }
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.className = 'ctx-item' + (it.perigo ? ' perigo' : '') + (it.sub ? ' tem-sub' : '');
    if (it.off) b.disabled = true;
    const icone = it.cor ? `<i class="ctx-cor" style="--cor:${it.cor}"></i>`
      : it.txt ? `<i class="ctx-txt">${it.txt}</i>`
      : `<i>${ico(it.ico)}</i>`;
    b.innerHTML = icone + `<span>${escapar(it.label)}</span>` +
      (it.sub ? `<i class="ctx-seta">${ico('seta')}</i>` : it.kbd ? `<kbd>${escapar(paraSO(it.kbd))}</kbd>` : '');
    if (it.sub){
      b.setAttribute('aria-haspopup', 'menu');
      b._sub = it.sub;
      b.addEventListener('pointerenter', () => { clearTimeout(abrirSubRelogio); abrirSubRelogio = setTimeout(() => abrirSub(b, nivel), 110); });
      b.addEventListener('click', () => abrirSub(b, nivel, true));
    } else {
      b.addEventListener('pointerenter', () => { clearTimeout(abrirSubRelogio); abrirSubRelogio = setTimeout(() => fecharDesde(nivel + 1), 160); });
      b.addEventListener('click', () => executar(it));
    }
    p.append(b);
  }
  return p;
}
function posicionar(p, x, y, ancora){
  p.style.left = '0px'; p.style.top = '0px';
  const r = p.getBoundingClientRect(), m = 8;
  let px = x, py = y;
  if (ancora){
    px = ancora.right + 2;
    if (px + r.width > innerWidth - m) px = ancora.left - r.width - 2;   // sem espaço à direita: abre à esquerda
    py = ancora.top - 6;
  }
  px = Math.max(m, Math.min(px, innerWidth - r.width - m));
  py = Math.max(m, Math.min(py, innerHeight - r.height - m));
  p.style.left = px + 'px';
  p.style.top = py + 'px';
  p.style.setProperty('--ox', ancora ? (px < ancora.left ? '100%' : '0') : (x - px) + 'px');
  p.style.setProperty('--oy', ancora ? '12px' : (y - py) + 'px');
}
function abrirSub(botao, nivel, focar){
  fecharDesde(nivel + 1);
  botao.classList.add('aberto');
  const p = painelCtx(botao._sub, nivel + 1);
  ctx.append(p);
  paineis[nivel + 1] = p;
  posicionar(p, 0, 0, botao.getBoundingClientRect());
  requestAnimationFrame(() => p.classList.add('vivo'));
  if (focar) p.querySelector('.ctx-item:not(:disabled)')?.focus({ preventScroll: true });
}
function fecharDesde(nivel){
  for (let n = paineis.length - 1; n >= nivel; n--){ paineis[n]?.remove(); paineis.length = n; }
  paineis[nivel - 1]?.querySelectorAll('.ctx-item.aberto').forEach(b => b.classList.remove('aberto'));
}
function fecharCtx(){
  if (ctx.hidden) return;
  clearTimeout(abrirSubRelogio);
  ctx.hidden = true;
  ctx.replaceChildren();
  paineis = [];
}
function abrirCtx(x, y){
  fecharCtx();
  ctx.hidden = false;
  const p = painelCtx(cardapio(), 0);
  ctx.append(p);
  paineis = [p];
  posicionar(p, x, y);
  requestAnimationFrame(() => p.classList.add('vivo'));
}
editor.addEventListener('contextmenu', (e) => {
  // no dedo (toque longo) fica o menu do sistema, que já sabe selecionar
  if (ultimoPonteiro === 'touch' || prefs.visualizando) return;
  e.preventDefault();
  abrirCtx(e.clientX, e.clientY);
});
// clicar no menu não tira o foco nem a seleção do texto
ctx.addEventListener('pointerdown', (e) => e.preventDefault());
document.addEventListener('pointerdown', (e) => { if (!ctx.hidden && !ctx.contains(e.target)) fecharCtx(); }, true);
window.addEventListener('blur', fecharCtx);
window.addEventListener('resize', fecharCtx);
scroller.addEventListener('scroll', fecharCtx, { passive: true });

/* teclado: setas andam, → abre o submenu, ← volta, Enter escolhe, Esc fecha um nível */
document.addEventListener('keydown', (e) => {
  if (ctx.hidden) return;
  const k = e.key;
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Escape', 'Enter', ' ', 'Home', 'End'].includes(k)) return;
  e.preventDefault(); e.stopPropagation();
  const ativo = document.activeElement && document.activeElement.closest('.ctx-painel');
  const nivel = ativo ? +ativo.dataset.nivel : paineis.length - 1;
  const p = paineis[nivel];
  const itens = [...p.querySelectorAll('.ctx-item:not(:disabled)')];
  const i = itens.indexOf(document.activeElement);
  if (k === 'Escape' || (k === 'ArrowLeft' && nivel > 0)){
    if (nivel === 0) return fecharCtx();
    fecharDesde(nivel);
    paineis[nivel - 1].querySelector('.ctx-item.aberto, .ctx-item.tem-sub:focus')?.focus();
    const dono = [...paineis[nivel - 1].querySelectorAll('.tem-sub')].find(b => b.classList.contains('aberto'));
    (dono || paineis[nivel - 1].querySelector('.ctx-item'))?.focus();
    return;
  }
  if (k === 'ArrowDown') return itens[(i + 1) % itens.length]?.focus();
  if (k === 'ArrowUp') return itens[(i - 1 + itens.length) % itens.length]?.focus();
  if (k === 'Home') return itens[0]?.focus();
  if (k === 'End') return itens[itens.length - 1]?.focus();
  const b = document.activeElement;
  if (k === 'ArrowRight' && b && b._sub) return abrirSub(b, nivel, true);
  if ((k === 'Enter' || k === ' ') && b && p.contains(b)) b.click();
}, true);

/* ── as ações ── */
function prefixar(prefixo, outros = /^(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/){
  const { selectionStart: a, selectionEnd: b, value: v } = editor;
  const ini = v.lastIndexOf('\n', a - 1) + 1;
  const fimSel = b > a && v[b - 1] === '\n' ? b - 1 : b;
  let fim = v.indexOf('\n', fimSel);
  if (fim < 0) fim = v.length;
  const linhas = v.slice(ini, fim).split('\n');
  const todas = prefixo && linhas.every(l => !l.trim() || l.startsWith(prefixo));
  let n = 0;
  const novo = linhas.map(l => {
    if (!l.trim()) return l;
    if (todas) return l.slice(prefixo.length);
    n++;
    const p = prefixo === '1. ' ? `${n}. ` : prefixo;
    return p + l.replace(outros, '');
  }).join('\n');
  inserirComoEdicao(ini, fim, novo);
  editor.setSelectionRange(ini, ini + novo.length);
}
/* Insere um bloco inteiro em linhas próprias, com o cursor onde se escreve. */
function inserirBloco(texto, cursorEm){
  const { selectionStart: a, selectionEnd: b, value: v } = editor;
  const antes = a > 0 && v[a - 1] !== '\n' ? '\n\n' : (a > 1 && v[a - 2] !== '\n' ? '\n' : '');
  const depois = v[b] !== undefined && v[b] !== '\n' ? '\n\n' : (v[b] === '\n' && v[b + 1] !== '\n' && v[b + 1] !== undefined ? '\n' : '');
  inserirComoEdicao(a, b, antes + texto + depois);
  const c = a + antes.length + (cursorEm ?? texto.length);
  editor.setSelectionRange(c, c);
}
function notaDeRodape(){
  const v = editor.value;
  const usados = [...v.matchAll(/\[\^(\d+)\]/g)].map(m => +m[1]);
  const n = (usados.length ? Math.max(...usados) : 0) + 1;
  const b = editor.selectionEnd;
  inserirComoEdicao(b, b, `[^${n}]`);
  const fim = editor.value.length;
  const quebra = /\n\s*\[\^\d+\]:[^\n]*$/.test(editor.value) ? '\n' : (editor.value.endsWith('\n') ? '\n' : '\n\n');
  inserirComoEdicao(fim, fim, `${quebra}[^${n}]: `);
  const c = editor.value.length;
  editor.setSelectionRange(c, c);
  rolarAte(c);
  avisar(`Nota ${n}: escreva o texto dela aqui no fim`);
}
/* Limpar formatação: tira os sinais de dentro da seleção (ou da linha). */
function limparFormatacao(){
  let { selectionStart: a, selectionEnd: b, value: v } = editor;
  if (a === b){ a = v.lastIndexOf('\n', a - 1) + 1; b = v.indexOf('\n', b); if (b < 0) b = v.length; }
  const t = v.slice(a, b)
    .replace(/\[\[([^\]|\n]+)(?:\|([^\]\n]*))?\]\]/g, (_, x, r) => r || x)
    .replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, '$1')
    .replace(/==[🟥🟧🟨🟩🟦🟪]?([^=\n]+)==/gu, '$1')
    .replace(/(\*\*|__|~~|%%)(.+?)\1/g, '$2')
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1$2').replace(/(^|[^_\w])_([^_\n]+)_/g, '$1$2')
    .replace(/`([^`\n]+)`/g, '$1').replace(/\$([^$\n]+)\$/g, '$1');
  inserirComoEdicao(a, b, t);
  editor.setSelectionRange(a, a + t.length);
}
async function colar(simples){
  try {
    if (!simples && navigator.clipboard?.read){
      const itens = await navigator.clipboard.read();
      for (const it of itens){
        const tipo = it.types.find(t => t.startsWith('image/'));
        if (tipo){
          const blob = await it.getType(tipo);
          await inserirImagens([new File([blob], 'colada', { type: tipo })]);
          return;
        }
      }
    }
    const t = await navigator.clipboard.readText();
    inserirComoEdicao(editor.selectionStart, editor.selectionEnd, t);
  } catch {
    avisar(`O navegador não deixou colar daqui · use ${paraSO(simples ? 'Ctrl+Shift+V' : 'Ctrl+V')}`, 3000);
  }
}
const ACOES_CTX = {
  recortar: () => document.execCommand('cut'),
  copiar: () => document.execCommand('copy'),
  colar: () => colar(false),
  'colar-texto': () => colar(true),
  tudo: () => editor.select(),
  negrito: () => envolver('**'),
  italico: () => envolver('_'),
  riscado: () => envolver('~~'),
  codigo: () => envolver('`'),
  equacao: () => envolver('$'),
  comentario: () => envolver('%%'),
  limpar: limparFormatacao,
  link: () => {
    const { selectionStart: a, selectionEnd: b, value: v } = editor;
    inserirComoEdicao(a, b, '[[' + v.slice(a, b));
    const fim = editor.selectionStart;
    inserirComoEdicao(fim, fim, ']]');
    editor.setSelectionRange(fim, fim);
    editor.dispatchEvent(new Event('input'));
  },
  'link-ext': () => {
    const { selectionStart: a, selectionEnd: b, value: v } = editor;
    const sel = v.slice(a, b) || 'texto';
    inserirComoEdicao(a, b, `[${sel}](url)`);
    editor.setSelectionRange(a + sel.length + 3, a + sel.length + 6);
  },
  nota: notaDeRodape,
  tabela: () => inserirBloco('| Coluna | Coluna |\n| --- | --- |\n|  |  |', 2),
  destaque: () => inserirBloco('> [!note] Destaque\n> ', 22),
  regua: () => inserirBloco('---'),
  'bloco-codigo': () => inserirBloco('```\n\n```', 4),
  'equacao-bloco': () => inserirBloco('$$\n\n$$', 3),
  imagem: () => $('#imgInput').click(),
  lista: () => prefixar('- '),
  'lista-num': () => prefixar('1. '),
  tarefa: () => prefixar('- [ ] '),
  citacao: () => prefixar('> '),
  texto: () => prefixar('', /^#{1,6}\s+/),
};
for (let n = 1; n <= 6; n++) ACOES_CTX['h' + n] = () => prefixar('#'.repeat(n) + ' ', /^#{1,6}\s+/);
function executar(it){
  fecharCtx();
  editor.focus({ preventScroll: true });
  if (it.acao) it.acao();
  else if (it.id && it.id.startsWith('realce:')) envolver('==' + it.id.slice(7), '==');
  else ACOES_CTX[it.id]?.();
  desenhar();
}

/* ══════════ 4. Ligações entre notas ══════════
   [[Título]] liga uma nota a outra. Fora do Caderno é aqui que a
   ligação funciona: escrever [[ abre a lista das suas notas, e
   Ctrl+clique (ou um clique no Visualizar) abre a nota citada, ou cria
   uma com aquele título se ainda não existir. Dentro do Caderno quem
   cuida disso é a ponte. */
function notaPorTitulo(t){
  const alvo = normal(String(t).trim());
  return notas.find(n => normal(tituloDaNota(n.texto)) === alvo);
}
function seguirLigacao(titulo){
  if (PONTE){ PONTE.ir(titulo); return; }
  const n = notaPorTitulo(titulo);
  if (n) abrirNota(n.id);
  else novaNota(`# ${titulo.trim()}\n\n`, `Nota nova: “${titulo.trim()}”`);
  if (prefs.visualizando) definirVisualizacao(false);
}
/* quantas notas citam esta (aparece no cartão) */
function citacoesDe(n){
  const t = normal(tituloDaNota(n.texto));
  if (!t) return 0;
  return notas.filter(o => o !== n && [...o.texto.matchAll(/\[\[([^\]|\n]+)/g)].some(m => normal(m[1].trim()) === t)).length;
}

if (!PONTE){
  const sug = document.createElement('div');
  sug.className = 'sugestoes';
  sug.hidden = true;
  sug.setAttribute('role', 'listbox');
  document.body.append(sug);
  let itens = [], sel = 0, ini = -1;
  const sugFechar = () => { sug.hidden = true; itens = []; ini = -1; };
  const sugPintar = () => sug.replaceChildren(...itens.map((it, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'option');
    b.className = i === sel ? 'on' : '';
    b.innerHTML = `<span>${escapar(it.t)}</span><i>${escapar(it.rot)}</i>`;
    b.onmousedown = (e) => { e.preventDefault(); escolher(i); };
    return b;
  }));
  function caretRect(){
    const v = editor.value, c = editor.selectionStart;
    const linha = (v.slice(0, c).match(/\n/g) || []).length;
    let col = c - (v.lastIndexOf('\n', c - 1) + 1);
    const span = overlay.querySelector(`.linha-fonte[data-linha="${linha}"]`);
    if (span){
      const w = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())){
        if (col <= n.data.length){
          const rg = document.createRange();
          rg.setStart(n, Math.max(0, col - 1)); rg.setEnd(n, Math.max(col, 1) <= n.data.length ? Math.max(col, 1) : col);
          const q = [...rg.getClientRects()].pop();
          if (q) return { left: col ? q.right : q.left, top: q.top, bottom: q.bottom };
          break;
        }
        col -= n.data.length;
      }
      const q = span.getBoundingClientRect();
      return { left: q.left, top: q.top, bottom: q.bottom };
    }
    return editor.getBoundingClientRect();
  }
  function sugAbrir(){
    const c = editor.selectionStart;
    if (c !== editor.selectionEnd || prefs.visualizando) return sugFechar();
    const m = editor.value.slice(Math.max(0, c - 90), c).match(/\[\[([^\[\]\n|]*)$/);
    if (!m) return sugFechar();
    ini = c - m[1].length;
    const q = normal(m[1].trim());
    const atual = notas.find(n => n.id === notaAtual);
    const vistos = new Set();
    itens = [...notas].filter(n => n !== atual).sort((a, b) => b.editada - a.editada)
      .map(n => ({ t: tituloDaNota(n.texto), rot: 'nota' }))
      .filter(x => x.t && !vistos.has(normal(x.t)) && vistos.add(normal(x.t)) && (!q || normal(x.t).includes(q)))
      .sort((a, b) => (normal(b.t).startsWith(q) ? 1 : 0) - (normal(a.t).startsWith(q) ? 1 : 0))
      .slice(0, 8);
    if (m[1].trim() && !vistos.has(q)) itens.push({ t: m[1].trim(), rot: 'nota nova' });
    if (!itens.length) return sugFechar();
    sel = 0;
    sugPintar();
    sug.hidden = false;
    const r = caretRect();
    const W = sug.offsetWidth, H = sug.offsetHeight;
    let x = Math.max(8, Math.min(innerWidth - W - 8, r.left - 12));
    let y = r.bottom + 6;
    if (y + H > innerHeight - 8) y = Math.max(8, r.top - H - 6);
    sug.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  }
  function escolher(i){
    const it = itens[i];
    if (!it) return;
    const c = editor.selectionStart;
    const fecha = editor.value.slice(c, c + 2) === ']]' ? '' : ']]';
    inserirComoEdicao(ini, c, it.t + fecha);
    const fim = ini + it.t.length + 2;
    editor.setSelectionRange(fim, fim);
    sugFechar();
  }
  editor.addEventListener('input', sugAbrir);
  editor.addEventListener('blur', () => setTimeout(sugFechar, 120));
  editor.addEventListener('keydown', (e) => {
    if (sug.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault(); e.stopImmediatePropagation();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : itens.length - 1)) % itens.length;
      sugPintar();
    } else if (e.key === 'Enter' || e.key === 'Tab'){
      e.preventDefault(); e.stopImmediatePropagation();
      escolher(sel);
    } else if (e.key === 'Escape'){
      e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
      sugFechar();
    }
  }, true);
  scroller.addEventListener('scroll', sugFechar, { passive: true });

  editor.addEventListener('click', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const w = trechoNoCursor(/\[\[([^\[\]\n|]+)(?:\|[^\]\n]*)?\]\]/g);
    if (w){ e.preventDefault(); seguirLigacao(w.m[1].trim()); }
  });
  preview.addEventListener('click', (e) => {
    const a = e.target.closest('a.wikilink');
    if (a){ e.preventDefault(); seguirLigacao(a.dataset.nota); }
  });
}
