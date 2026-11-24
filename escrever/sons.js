/* ═══════════════════════════════════════════════════════════
   Sons do teclado: gravações de switches mecânicos
   ───────────────────────────────────────────────────────────
   As gravações são do kbsim, de Thomas Lai (licença MIT, em
   sons/LICENCA-kbsim.md): https://github.com/tplai/kbsim

   Cada switch tem uma gravação por fileira do teclado (do número à
   fileira de baixo), Espaço, Enter e Backspace próprios, e a volta da
   tecla ao soltar. Os arquivos de um switch só são baixados quando ele
   é escolhido e o som está ligado. Segurar a tecla não repete o som.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const SONS = (() => {
  const SWITCHES = [
    { id: 'vermelho', nome: 'Vermelho', tipo: 'Linear', modelo: 'Gateron Red Ink', haste: '#e5484d', topo: 'rgba(255,255,255,.16)', base: '#26262a', dica: 'Leve e rápido, desce liso até o fim.' },
    { id: 'amarelo',  nome: 'Amarelo',  tipo: 'Linear', modelo: 'Alpaca', haste: '#f5c400', topo: 'rgba(255,255,255,.16)', base: '#26262a', dica: 'Liso e macio, um linear de batida média.' },
    { id: 'preto',    nome: 'Preto',    tipo: 'Linear', modelo: 'Cherry MX Black', haste: '#141416', topo: '#2c2c30', base: '#141416', dica: 'Pesado e grave; cada tecla pede força.' },
    { id: 'creamy',   nome: 'Creamy',   tipo: 'Linear', modelo: 'NovelKeys Cream', haste: '#ead9b8', topo: '#f3e8d2', base: '#e3d2b0', dica: 'O thock fundo e macio.' },
    { id: 'marrom',   nome: 'Marrom',   tipo: 'Tátil',  modelo: 'Cherry MX Brown', haste: '#8b5a3c', topo: 'rgba(255,255,255,.16)', base: '#26262a', dica: 'Um degrau suave no meio, sem clique.' },
    { id: 'roxo',     nome: 'Roxo',     tipo: 'Tátil',  modelo: 'Holy Panda', haste: '#8e4ec6', topo: 'rgba(255,255,255,.2)', base: '#2a2530', dica: 'Degrau forte e batida cheia.' },
    { id: 'azul',     nome: 'Azul',     tipo: 'Clicky', modelo: 'Cherry MX Blue', haste: '#2b7fff', topo: 'rgba(255,255,255,.16)', base: '#26262a', dica: 'O clique alto, na descida e na volta.', sem: ['SPACE', 'ENTER', 'BACKSPACE'] },
  ];
  const DESCE = ['GENERIC_R0', 'GENERIC_R1', 'GENERIC_R2', 'GENERIC_R3', 'GENERIC_R4', 'SPACE', 'ENTER', 'BACKSPACE'];
  const SOBE = ['GENERIC', 'SPACE', 'ENTER', 'BACKSPACE'];

  /* fileira de cada tecla: 0 números, 1 QWERTY, 2 ASDF, 3 ZXCV, 4 o resto */
  const FILEIRAS = [
    ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'],
    ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
    ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
    ['ShiftLeft', 'IntlBackslash', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'IntlRo', 'ShiftRight'],
  ];
  const FILEIRA = new Map();
  FILEIRAS.forEach((f, i) => f.forEach(c => FILEIRA.set(c, i)));
  const ESPECIAL = { Space: 'SPACE', Enter: 'ENTER', NumpadEnter: 'ENTER', Backspace: 'BACKSPACE', Delete: 'BACKSPACE' };

  /* posição da esquerda (-1) à direita (1), para o som vir do lado certo */
  function lado(code){
    const f = FILEIRA.get(code);
    if (f != null){ const l = FILEIRAS[f]; const i = l.indexOf(code); return (i / (l.length - 1)) * 2 - 1; }
    if (code === 'Space') return 0;
    if (/^(Enter|Backspace|Arrow|Page|Home|End|Insert|Delete|Numpad)/.test(code)) return .9;
    return 0;
  }

  let ctx = null, mestre = null;
  const carregados = new Map();          // id → Promise<{ id, desce, sobe, ganho }>
  let pronto = null;                     // o último switch já decodificado
  const ataque = new WeakMap();          // gravação → segundo em que a batida começa
  const nivel = new WeakMap();           // gravação → ganho que a leva ao pico certo

  /* As gravações do kbsim vêm em volumes muito diferentes entre si (no
     Creamy, o Backspace é 13 dB mais alto que as letras). Cada uma é
     nivelada pelo PRÓPRIO pico: as letras batem todas no mesmo ponto, as
     teclas grandes um pouco mais cheias e a volta da tecla bem abaixo. */
  const ALVO = { tecla: .5, grande: .56, solta: .2, soltaGrande: .24 };
  function pico(buf, desde){
    let m = 0;
    const s = Math.floor((desde || 0) * buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++){
      const d = buf.getChannelData(c);
      for (let i = s; i < d.length; i++){ const v = Math.abs(d[i]); if (v > m) m = v; }
    }
    return m;
  }

  function inicio(buf){
    const canais = [];
    for (let c = 0; c < buf.numberOfChannels; c++) canais.push(buf.getChannelData(c));
    let pico = 0;
    for (const d of canais) for (let i = 0; i < d.length; i++){ const v = Math.abs(d[i]); if (v > pico) pico = v; }
    const lim = pico * .05;
    for (let i = 0; i < buf.length; i++)
      for (const d of canais) if (Math.abs(d[i]) > lim) return Math.max(0, i / buf.sampleRate - .0015);
    return 0;
  }

  function audio(){
    if (!ctx){
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C({ latencyHint: 'interactive' });
      mestre = ctx.createGain();
      // limitador no fim: com teclas rápidas os sons se somam, e a soma
      // nunca pode estourar
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20;
      lim.attack.value = .001; lim.release.value = .08;
      mestre.connect(lim);
      lim.connect(ctx.destination);
      volume();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function volume(){
    if (!mestre) return;
    const v = Math.max(0, Math.min(100, +prefs.somVolume || 0)) / 100;
    mestre.gain.value = Math.pow(v, 1.7) * 1.6;
  }

  const base = (() => { try { return new URL('sons/', document.currentScript.src).href; } catch { return 'sons/'; } })();
  function carregar(id){
    if (carregados.has(id)) return carregados.get(id);
    // o Azul não tem gravação própria das teclas grandes: elas ficam null
    // e usam a da fileira (ver tocar)
    const busca = async (nome) => {
      const r = await fetch(base + id + '/' + nome + '.mp3');
      if (!r.ok) return null;
      return await ctx.decodeAudioData(await r.arrayBuffer());
    };
    const sem = new Set((SWITCHES.find(x => x.id === id) || {}).sem || []);
    const p = (async () => {
      const desce = {}, sobe = {};
      await Promise.all([
        ...DESCE.filter(n => !sem.has(n)).map(async n => { desce[n] = await busca(n); }),
        ...SOBE.filter(n => !sem.has(n)).map(async n => { sobe[n] = await busca('SOLTA_' + n); }),
      ]);
      if (!desce.GENERIC_R0) throw new Error('sem gravações');
      for (let i = 0; i < 5; i++) if (!desce['GENERIC_R' + i]) desce['GENERIC_R' + i] = desce.GENERIC_R0;
      // o MP3 traz um pedaço mudo antes da batida (até 60 ms no Azul):
      // cada gravação começa a tocar direto no ataque, já no seu nível
      const nivelar = (b, alvo) => {
        if (!b || nivel.has(b)) return;
        ataque.set(b, inicio(b));
        const p = pico(b, ataque.get(b));
        nivel.set(b, p ? alvo / p : 1);
      };
      for (const [n, b] of Object.entries(desce)) nivelar(b, /^GENERIC/.test(n) ? ALVO.tecla : ALVO.grande);
      for (const [n, b] of Object.entries(sobe)) nivelar(b, n === 'GENERIC' ? ALVO.solta : ALVO.soltaGrande);
      return { id, desce, sobe };
    })();
    p.then(s => { pronto = s; }, () => {});
    p.catch(() => carregados.delete(id));
    carregados.set(id, p);
    return p;
  }

  function soar(sw, code, solta){
    const { desce, sobe } = sw;
    const esp = ESPECIAL[code];
    const fileira = 'GENERIC_R' + (FILEIRA.has(code) ? FILEIRA.get(code) : code === 'Space' ? 4 : 2);
    const buf = solta ? (esp && sobe[esp]) || sobe.GENERIC : (esp && desce[esp]) || desce[fileira];
    if (!buf) return;
    const fonte = ctx.createBufferSource();
    fonte.buffer = buf;
    fonte.playbackRate.value = 1 + (Math.random() - .5) * .02;
    const g = ctx.createGain();
    g.gain.value = (nivel.get(buf) || 1) * (.92 + Math.random() * .16);
    fonte.connect(g);
    if (ctx.createStereoPanner){
      const p = ctx.createStereoPanner();
      p.pan.value = lado(code) * .3;
      g.connect(p); p.connect(mestre);
    } else g.connect(mestre);
    fonte.start(0, ataque.get(buf) || 0);
  }

  function tocar(code, solta){
    if (!audio()) return;
    const id = prefs.switch;
    // já decodificado: toca na hora, sem esperar a volta de uma Promise
    if (pronto && pronto.id === id) return soar(pronto, code, solta);
    carregar(id).then(sw => {
      if (prefs.sons && prefs.switch === id) soar(sw, code, solta);
    }).catch(() => {});
  }

  /* com o som ligado, os arquivos do switch já ficam prontos antes da
     primeira tecla (o áudio em si só acorda com a primeira tecla) */
  function preparar(){
    if (!prefs.sons || !audio()) return;
    carregar(prefs.switch).catch(() => {});
  }

  /* na fase de captura, antes de qualquer painel parar o evento */
  const presas = new Set();
  const codigo = (e) => e.code || e.key || '?';
  addEventListener('keydown', (e) => {
    if (!prefs.sons || e.repeat) return;
    const c = codigo(e);
    if (presas.has(c)) return;
    presas.add(c);
    tocar(c, false);
  }, true);
  addEventListener('keyup', (e) => {
    const c = codigo(e);
    if (!presas.delete(c) || !prefs.sons || !prefs.somSoltar) return;
    tocar(c, true);
  }, true);
  addEventListener('blur', () => presas.clear());
  // o navegador só libera o áudio depois de um toque ou clique: acordá-lo
  // já no primeiro clique evita que a primeira tecla saia atrasada
  addEventListener('pointerdown', () => { if (prefs.sons) audio(); }, true);

  if (prefs.sons) preparar();
  return { SWITCHES, volume, preparar };
})();
