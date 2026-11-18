/* ═══════════════════════════════════════════════════════════
   Escritor — corretor ortográfico (Web Worker)
   ───────────────────────────────────────────────────────────
   O Hunspell de verdade (o mesmo do LibreOffice e do Firefox),
   compilado para WebAssembly, com o dicionário VERO de português
   do Brasil. Roda fora da página, para a digitação nunca esperar.

   Não depende do corretor do navegador: o do sistema só funciona
   quando há um dicionário de português instalado, e muitas vezes
   não há. Por isso "onibus" passava sem marca.

   Mensagens:
     { tipo:'checar',  id, palavras:[…] } → { id, erradas:[…] }
     { tipo:'sugerir', id, palavra }      → { id, sugestoes:[…] }
     { tipo:'meu',     palavras:[…] }     → acrescenta ao dicionário
   ═══════════════════════════════════════════════════════════ */
'use strict';
importScripts('hunspell.js');

let h = null;          // { spell, suggest, add }
const fila = [];       // mensagens que chegaram antes de o dicionário abrir

function texto(M, ptr){ return M.UTF8ToString(ptr); }

function montar(M, aff, dic){
  M.FS.writeFile('/pt-BR.aff', new Uint8Array(aff));
  M.FS.writeFile('/pt-BR.dic', new Uint8Array(dic));
  const criar = M.cwrap('Hunspell_create', 'number', ['number', 'number']);
  const spell = M.cwrap('Hunspell_spell', 'number', ['number', 'number']);
  const suggest = M.cwrap('Hunspell_suggest', 'number', ['number', 'number', 'number']);
  const livrar = M.cwrap('Hunspell_free_list', null, ['number', 'number', 'number']);
  const add = M.cwrap('Hunspell_add', 'number', ['number', 'number']);
  const pAff = M.allocateUTF8('/pt-BR.aff'), pDic = M.allocateUTF8('/pt-BR.dic');
  const eu = criar(pAff, pDic);
  const comTexto = (s, fn) => { const p = M.allocateUTF8(s.normalize('NFC')); try { return fn(p); } finally { M._free(p); } };
  return {
    spell: (w) => !!comTexto(w, (p) => spell(eu, p)),
    add: (w) => comTexto(w, (p) => add(eu, p)),
    suggest: (w) => {
      const lista = M._malloc(4);
      const n = comTexto(w, (p) => suggest(eu, lista, p));
      const base = M.getValue(lista, '*');
      const saida = [];
      for (let i = 0; i < n; i++) saida.push(texto(M, M.getValue(base + i * 4, '*')));
      livrar(eu, lista, n);
      M._free(lista);
      return saida;
    },
  };
}

function atender(msg){
  if (msg.tipo === 'meu'){ for (const w of msg.palavras || []) h.add(w); return; }
  if (msg.tipo === 'checar'){
    const erradas = [];
    for (const w of msg.palavras) if (!h.spell(w)) erradas.push(w);
    postMessage({ id: msg.id, erradas });
    return;
  }
  if (msg.tipo === 'sugerir'){
    let s = [];
    try { s = h.suggest(msg.palavra); } catch (e) {}
    postMessage({ id: msg.id, sugestoes: s.slice(0, 6) });
  }
}

onmessage = (e) => { if (h) atender(e.data); else fila.push(e.data); };

const arquivos = Promise.all(['pt-BR.aff', 'pt-BR.dic'].map(f =>
  fetch(f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.arrayBuffer(); })));

/* O módulo do Emscripten avisa quando o WebAssembly está pronto. O
   objeto que ele devolve tem um .then próprio e antigo, que chama a si
   mesmo: entregue direto a uma Promise, ela tenta "desembrulhá-lo" para
   sempre e o worker trava. Por isso ele viaja dentro de um envelope. */
const motor = new Promise((ok) => {
  const M = Module({ onRuntimeInitialized(){ setTimeout(() => ok({ M })); } });
});

Promise.all([motor, arquivos]).then(([{ M }, [aff, dic]]) => {
  h = montar(M, aff, dic);
  postMessage({ pronto: true });
  while (fila.length) atender(fila.shift());
}).catch((err) => postMessage({ falhou: String(err && err.message || err) }));
