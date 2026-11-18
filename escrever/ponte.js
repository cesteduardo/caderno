/* ═══════════════════════════════════════════════════════════
   Ponte com o Caderno
   ───────────────────────────────────────────────────────────
   Só age quando o Escritor está dentro do Caderno (PONTE, em app.js).
   Ali ele vira o editor das notas:
   - a barra ganha “← Notas”, “Nova nota” e “Ligações”;
   - [[ abre a lista de notas, livros e aulas para ligar;
   - Ctrl+clique numa [[ligação]] (ou clique, no Visualizar) abre o alvo;
   - Ctrl+O é o “Ir para”, como no Obsidian.
   O Caderno chama ponteCarregar() para trocar de nota sem recarregar.
   ═══════════════════════════════════════════════════════════ */
'use strict';

if (PONTE) (() => {
  const SVG_VOLTAR = ICO.voltar;
  const SVG_LIGA = ICO.ligacoes;

  /* ── barra ─────────────────────────────────────────────── */
  const grupoArq = $('.grupo--arquivo');
  const voltar = document.createElement('button');
  voltar.className = 'ico com-rotulo';
  voltar.id = 'btnVoltar';
  voltar.title = 'Voltar para as notas';
  voltar.setAttribute('aria-label', 'Voltar para as notas');
  voltar.innerHTML = SVG_VOLTAR + '<span>Voltar</span>';
  voltar.onclick = () => { ponteFlush(); PONTE.fechar(); };
  grupoArq.prepend(voltar);

  const novo = $('#btnNovo');
  novo.title = paraSO('Nova nota (Ctrl+Alt+N)');
  novo.setAttribute('aria-label', 'Nova nota');
  novo.querySelector('.mp-txt small').textContent = 'Uma nota nova no Caderno';
  novo.onclick = () => { ponteFlush(); PONTE.nova(); };

  const abrir = $('#btnAbrir');
  abrir.title = 'Trazer um arquivo .md ou .txt como nota nova';
  abrir.querySelector('.mp-txt span').textContent = 'Importar arquivo…';
  abrirArquivo = (file) => {
    const leitor = new FileReader();
    leitor.onload = () => { ponteFlush(); PONTE.importar(String(leitor.result).replace(/\r\n?/g, '\n'), file.name); };
    leitor.onerror = () => avisar('Não foi possível ler o arquivo');
    leitor.readAsText(file, 'utf-8');
  };

  const liga = document.createElement('button');
  liga.className = 'tog com-ico';
  liga.id = 'btnLigacoes';
  liga.setAttribute('aria-pressed', 'false');
  liga.title = 'Ligações: quem cita esta nota, o que ela cita, marcações da fonte';
  liga.innerHTML = SVG_LIGA + '<span class="rot">Ligações</span>';
  liga.onclick = () => PONTE.painel();
  $('.grupo--app').prepend(liga);
  window.ponteLigacoes = (on) => liga.setAttribute('aria-pressed', String(!!on));
  // com as Ligações abertas, o Esc digitado aqui dentro fecha o pop-up lá fora
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && liga.getAttribute('aria-pressed') === 'true'){
      e.preventDefault(); e.stopImmediatePropagation(); PONTE.painel();
    }
  }, true);

  $('#btnGuia').onclick = () => { ponteFlush(); PONTE.guia(GUIA); };

  /* ── o Caderno troca a nota, insere trechos e pede o texto ── */
  window.ponteCarregar = (texto, opc = {}) => {
    clearTimeout(relogioSalvar);
    $$('.menu').forEach(m => m.classList.remove('aberto'));
    sugFechar();
    editor.value = texto;
    obsArquivo = '';
    if (prefs.visualizando && !opc.ver) definirVisualizacao(false);
    else if (opc.ver) definirVisualizacao(true);
    const c = opc.fim ? editor.value.length : 0;
    editor.setSelectionRange(c, c);
    desenhar();
    scroller.scrollTop = opc.fim ? scroller.scrollHeight : 0;
    $('#stSalvo').textContent = 'salvo';
    if (!prefs.visualizando) editor.focus();
    if (prefs.maquina) centralizarCursor();
  };
  window.ponteInserir = (trecho) => {
    if (prefs.visualizando) definirVisualizacao(false);
    const { selectionStart: a, selectionEnd: b, value: v } = editor;
    const antes = a > 0 && v[a - 1] !== '\n' ? '\n\n' : (a > 1 && v[a - 2] !== '\n' ? '\n' : '');
    editor.focus();
    editor.setRangeText(antes + trecho + '\n', a, b, 'end');
    aoDigitar();
  };
  window.ponteFlush = ponteFlush;
  function ponteFlush(){ clearTimeout(relogioSalvar); PONTE.salvar(editor.value); }

  /* ── autocompletar [[ ───────────────────────────────────── */
  const sug = document.createElement('div');
  sug.className = 'sugestoes';
  sug.hidden = true;
  sug.setAttribute('role', 'listbox');
  document.body.append(sug);
  let itens = [], sel = 0, ini = -1;

  function sugFechar(){ sug.hidden = true; itens = []; ini = -1; }
  function sugPintar(){
    sug.replaceChildren(...itens.map((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.className = i === sel ? 'on' : '';
      b.innerHTML = `<span>${escapaHTML(it.t)}</span><i>${escapaHTML(it.rot || '')}</i>`;
      b.onmousedown = (e) => { e.preventDefault(); escolher(i); };
      return b;
    }));
  }
  function sugAbrir(){
    const c = editor.selectionStart;
    if (c !== editor.selectionEnd || prefs.visualizando) return sugFechar();
    const antes = editor.value.slice(Math.max(0, c - 90), c);
    const m = antes.match(/\[\[([^\[\]\n|]*)$/);
    if (!m) return sugFechar();
    ini = c - m[1].length;
    itens = PONTE.titulos(m[1]) || [];
    if (!itens.length) return sugFechar();
    sel = 0;
    sugPintar();
    sug.hidden = false;
    const r = caretRect();
    const z = escalaZoom();
    const W = sug.offsetWidth * z, H = sug.offsetHeight * z;
    const vh = window.visualViewport ? window.visualViewport.height : innerHeight;
    let x = Math.max(8, Math.min(innerWidth - W - 8, r.left - 12));
    let y = r.bottom + 6;
    if (y + H > vh - 8) y = Math.max(8, r.top - H - 6);
    sug.style.transform = `translate(${Math.round(x / z)}px,${Math.round(y / z)}px)`;
  }
  /* Onde está o cursor: o espelho (overlay) tem os mesmos caracteres da
     caixa de texto, linha por linha, então basta medir lá. */
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
          const rs = rg.getClientRects();
          const q = rs[rs.length - 1];
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
  function escolher(i){
    const it = itens[i];
    if (!it) return;
    const c = editor.selectionStart;
    const fecha = editor.value.slice(c, c + 2) === ']]' ? '' : ']]';
    editor.setRangeText(it.t + fecha, ini, c, 'end');
    const fim = ini + it.t.length + 2;
    editor.setSelectionRange(fim, fim);
    sugFechar();
    aoDigitar();
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

  /* ── seguir uma ligação ────────────────────────────────── */
  function ligacaoNoCursor(){
    const v = editor.value, c = editor.selectionStart;
    const a = v.lastIndexOf('[[', c), b = v.indexOf(']]', a);
    if (a < 0 || b < 0 || c > b + 2) return null;
    const dentro = v.slice(a + 2, b);
    if (/[\n\[\]]/.test(dentro)) return null;
    return dentro.split('|')[0].trim();
  }
  editor.addEventListener('click', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const alvo = ligacaoNoCursor();
    if (alvo){ e.preventDefault(); ponteFlush(); PONTE.ir(alvo); }
  });
  preview.addEventListener('click', (e) => {
    const a = e.target.closest('a.wikilink');
    if (a){ e.preventDefault(); ponteFlush(); PONTE.ir(a.dataset.nota); return; }
    const t = e.target.closest('.tag-md');
    if (t){ ponteFlush(); PONTE.etiqueta(t.textContent); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
      const alvo = ligacaoNoCursor();
      if (alvo){ e.preventDefault(); ponteFlush(); PONTE.ir(alvo); }
    }
  });
})();
