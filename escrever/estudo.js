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
      `<span class="nota-meta"><span>${quando(n.editada)}</span><span>${contarPalavras(n.texto).toLocaleString('pt-BR')} palavras</span>${n.id === notaAtual ? '<span class="nota-aberta">aberta</span>' : ''}</span>`;
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

/* ══════════ 3. O botão direito ══════════ */

const ctx = $('#ctx');
let ultimoPonteiro = 'mouse';
editor.addEventListener('pointerdown', (e) => { ultimoPonteiro = e.pointerType || 'mouse'; }, true);

function fecharCtx(){
  if (ctx.hidden) return;
  ctx.hidden = true;
  ctx.classList.remove('vivo');
}
function abrirCtx(x, y){
  ctx.hidden = false;
  const r = ctx.getBoundingClientRect();
  const m = 8;
  const px = Math.min(Math.max(m, x), innerWidth - r.width - m);
  const py = y + r.height + m > innerHeight ? Math.max(m, y - r.height) : y;
  ctx.style.left = px + 'px';
  ctx.style.top = py + 'px';
  ctx.style.setProperty('--ox', (x - px) + 'px');
  ctx.style.setProperty('--oy', (y - py) + 'px');
  // o que faz sentido agora: copiar e recortar pedem uma seleção
  const temSel = editor.selectionStart !== editor.selectionEnd;
  ctx.querySelector('[data-ctx="recortar"]').disabled = !temSel;
  ctx.querySelector('[data-ctx="copiar"]').disabled = !temSel;
  requestAnimationFrame(() => ctx.classList.add('vivo'));
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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ctx.hidden){ e.preventDefault(); e.stopPropagation(); fecharCtx(); } }, true);
window.addEventListener('blur', fecharCtx);
window.addEventListener('resize', fecharCtx);
scroller.addEventListener('scroll', fecharCtx, { passive: true });

/* Põe (ou tira) um prefixo no começo de cada linha da seleção. */
function prefixar(prefixo, outros = /^(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/){
  const { selectionStart: a, selectionEnd: b, value: v } = editor;
  const ini = v.lastIndexOf('\n', a - 1) + 1;
  const fimSel = b > a && v[b - 1] === '\n' ? b - 1 : b;
  let fim = v.indexOf('\n', fimSel);
  if (fim < 0) fim = v.length;
  const linhas = v.slice(ini, fim).split('\n');
  const todas = linhas.every(l => !l.trim() || l.startsWith(prefixo));
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

/* Nota de rodapé: a chamada [^n] fica no cursor e o texto da nota no fim. */
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

async function colar(){
  try {
    if (navigator.clipboard?.read){
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
    avisar(`O navegador não deixou colar daqui · use ${paraSO('Ctrl+V')}`, 3000);
  }
}

const ACOES_CTX = {
  recortar: () => document.execCommand('cut'),
  copiar: () => document.execCommand('copy'),
  colar,
  tudo: () => editor.select(),
  negrito: () => envolver('**'),
  italico: () => envolver('_'),
  riscado: () => envolver('~~'),
  codigo: () => envolver('`'),
  grifo: () => envolver('=='),
  comentario: () => envolver('%%'),
  link: () => {
    const { selectionStart: a, selectionEnd: b, value: v } = editor;
    const sel = v.slice(a, b) || 'texto';
    inserirComoEdicao(a, b, `[${sel}](url)`);
    editor.setSelectionRange(a + sel.length + 3, a + sel.length + 6);
  },
  nota: notaDeRodape,
  tarefa: () => prefixar('- [ ] '),
  h1: () => prefixar('# '),
  h2: () => prefixar('## '),
  citacao: () => prefixar('> '),
  lista: () => prefixar('- '),
  'lista-num': () => prefixar('1. '),
  imagem: () => $('#imgInput').click(),
};
ctx.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ctx]');
  if (!b || b.disabled) return;
  fecharCtx();
  editor.focus({ preventScroll: true });
  ACOES_CTX[b.dataset.ctx]?.();
  desenhar();
});
