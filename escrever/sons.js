/* ═══════════════════════════════════════════════════════════
   Sons do teclado: switches mecânicos, sintetizados
   ───────────────────────────────────────────────────────────
   Nenhum arquivo de áudio: cada som nasce aqui, na hora, a partir do
   que acontece dentro de um switch de verdade.

   - Descida: o degrau dos táteis, o estalo da jaqueta do clicky e a
     batida no fundo (o pino bate na carcaça, a tecla e a placa vibram
     em alguns modos, o case dá o grave).
   - Subida: ao soltar, a haste volta e bate em cima, mais agudo e
     mais baixo; no clicky a jaqueta estala de novo, fraca.
   - Teclas grandes (Enter, Shift, Backspace) e o Espaço têm
     estabilizador: mais grave, mais longo, com a barra batendo junto.

   Cada tecla tem a sua voz: o código da tecla escolhe a variação e um
   leve desvio de afinação, como num teclado real, em que o A não soa
   igual ao L. A posição no teclado puxa o som um pouco para a esquerda
   ou para a direita.

   A síntese (SOM.banco) é pura e roda também no Node, para os testes.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const SOM = (() => {

/* ── os switches ─────────────────────────────────────────────
   altura: afinação geral · seco: duração dos modos (maior = mais longo)
   grave: o baque do case · tom: >0 puxa para o grave (thock), <0 para o
   agudo (clack) · batida/estalo: o impacto do pino, médio e agudo ·
   degrau: o calombo tátil · raspa: o atrito na descida · clique: a
   jaqueta do clicky · mola: o "ping" da mola · volta: força da subida ·
   brilho: corte dos agudos · atraso: ms entre a tecla registrar e o fundo */
const SWITCHES = [
  { id: 'vermelho', nome: 'Vermelho', tipo: 'Linear', peso: 45, dica: 'Leve e rápido, desce liso até o fim.',
    haste: '#e5484d', topo: 'rgba(255,255,255,.16)', base: '#26262a',
    v: { altura: 1.08, seco: .85, grave: .62, tom: -.25, batida: .85, estalo: .9, mola: .55, volta: .5, brilho: 7200, ganho: .78, atraso: 1 } },
  { id: 'amarelo', nome: 'Amarelo', tipo: 'Linear', peso: 50, dica: 'Liso e cheio, com a volta da tecla bem marcada.',
    haste: '#f5c400', topo: 'rgba(255,255,255,.16)', base: '#26262a',
    v: { altura: .97, seco: 1, grave: .95, tom: .15, batida: .75, estalo: .6, mola: .2, volta: .85, brilho: 6000, ganho: .88, atraso: 1 } },
  { id: 'preto', nome: 'Preto', tipo: 'Linear', peso: 60, dica: 'Pesado e grave; cada tecla pede força.',
    haste: '#141416', topo: '#2c2c30', base: '#141416',
    v: { altura: .86, seco: 1.12, grave: 1.35, tom: .45, batida: .8, estalo: .5, mola: .35, volta: .75, brilho: 5000, ganho: 1, atraso: 1.5 } },
  { id: 'creamy', nome: 'Creamy', tipo: 'Linear', peso: 55, dica: 'O thock fundo e macio, de plástico autolubrificado.',
    haste: '#ead9b8', topo: '#f3e8d2', base: '#e3d2b0',
    v: { altura: .76, seco: 1.3, grave: 1.4, tom: .8, batida: .5, estalo: .15, raspa: .5, mola: 0, volta: .4, brilho: 3400, ganho: .95, atraso: 1.5 } },
  { id: 'marrom', nome: 'Marrom', tipo: 'Tátil', peso: 55, dica: 'Um degrau suave no meio, sem clique.',
    haste: '#8b5a3c', topo: 'rgba(255,255,255,.16)', base: '#26262a',
    v: { altura: 1, seco: .95, grave: .9, tom: .1, batida: .65, estalo: .55, degrau: .35, raspa: .25, mola: .3, volta: .45, brilho: 5200, ganho: .85, atraso: 5 } },
  { id: 'roxo', nome: 'Roxo', tipo: 'Tátil', peso: 67, dica: 'Degrau forte e batida cheia, que nem um panda.',
    haste: '#8e4ec6', topo: 'rgba(255,255,255,.2)', base: '#2a2530',
    v: { altura: .84, seco: 1.15, grave: 1.25, tom: .5, batida: .9, estalo: .55, degrau: .8, mola: 0, volta: .9, brilho: 5600, ganho: 1, atraso: 6 } },
  { id: 'azul', nome: 'Azul', tipo: 'Clicky', peso: 60, dica: 'O estalo alto das máquinas antigas, na descida e na volta.',
    haste: '#2b7fff', topo: 'rgba(255,255,255,.16)', base: '#26262a',
    v: { altura: 1.04, seco: .9, grave: .8, tom: -.1, batida: .6, estalo: .7, clique: 1, cliqueVolta: .4, mola: .3, volta: .4, brilho: 9500, ganho: 1, atraso: 7 } },
];

/* letra comum, tecla grande com estabilizador e espaço */
const TECLAS = {
  letra:  { altura: 1,   seco: 1,    grave: 1,    estab: 0,  ganho: 1,    dur: .17 },
  grande: { altura: .84, seco: 1.25, grave: 1.25, estab: .5, ganho: 1.08, dur: .22 },
  espaco: { altura: .66, seco: 1.55, grave: 1.6,  estab: 1,  ganho: 1.2,  dur: .30 },
};
const VARIACOES = 6, VARIACOES_VOLTA = 4;

/* a tecla, a placa e o case: [frequência, amplitude, decaimento em s] */
const MODOS = [[210, .18, .009], [640, .36, .007], [1180, .55, .0055], [2350, .5, .0035], [3900, .34, .0022], [6100, .16, .0013]];

/* ── utilidades ──────────────────────────────────────────── */
function sorteio(semente){
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(txt){
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++){ h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* filtros biquad (receitas do RBJ), aplicados no lugar */
function biquad(x, fs, tipo, f, q){
  const w = 2 * Math.PI * Math.min(f, fs * .45) / fs, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (tipo === 'bp'){ b0 = al; b1 = 0; b2 = -al; }
  else if (tipo === 'lp'){ b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }           // hp
  const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
  const B0 = b0 / a0, B1 = b1 / a0, B2 = b2 / a0, A1 = a1 / a0, A2 = a2 / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++){
    const y = B0 * x[i] + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}

/* um modo de vibração: senoide que acende em 0,12 ms e morre em tau */
function modo(out, fs, t0, f, amp, tau){
  if (amp <= 0 || f >= fs * .45) return;
  const i0 = Math.round(t0 * fs), n = Math.min(out.length - i0, Math.ceil(tau * 7 * fs));
  const w = 2 * Math.PI * f / fs, ka = 1 / (.00012 * fs), kd = 1 / (tau * fs);
  for (let i = 0; i < n; i++) out[i0 + i] += amp * (1 - Math.exp(-i * ka)) * Math.exp(-i * kd) * Math.sin(w * i);
}
/* o baque do case: grave que cai de afinação */
function baque(out, fs, t0, f0, f1, amp, tau){
  if (amp <= 0) return;
  const i0 = Math.round(t0 * fs), n = Math.min(out.length - i0, Math.ceil(tau * 6 * fs));
  let fase = 0;
  for (let i = 0; i < n; i++){
    const t = i / fs, f = f1 + (f0 - f1) * Math.exp(-t / .008);
    fase += 2 * Math.PI * f / fs;
    out[i0 + i] += amp * (1 - Math.exp(-t / .0003)) * Math.exp(-t / tau) * Math.sin(fase);
  }
}
/* um impacto: ruído curto que passa por um passa-faixa e ganha cor */
function ruido(out, fs, t0, rnd, f, q, amp, tau){
  if (amp <= 0) return;
  const i0 = Math.round(t0 * fs), n = Math.min(out.length - i0, Math.ceil((tau * 8 + .004) * fs));
  if (n <= 0) return;
  const tmp = new Float32Array(n), kd = 1 / (tau * fs);
  for (let i = 0; i < n; i++) tmp[i] = (rnd() * 2 - 1) * Math.exp(-i * kd);
  biquad(tmp, fs, 'bp', f, q);
  const comp = Math.sqrt(q) * 1.6;                     // o passa-faixa estreito tira energia
  for (let i = 0; i < n; i++) out[i0 + i] += amp * comp * tmp[i];
}
/* a jaqueta do clicky: dois estalos em 1 ms, agudos e secos */
function clique(out, fs, t0, rnd, amp){
  for (const [dt, a] of [[0, 1], [.0011, .45]]){
    const j = 1 + (rnd() - .5) * .04;
    ruido(out, fs, t0 + dt, rnd, 4300 * j, 1.4, amp * a, .0005);
    modo(out, fs, t0 + dt, 3350 * j, amp * a * .75, .0022);
    modo(out, fs, t0 + dt, 5150 * j, amp * a * .5, .0014);
    modo(out, fs, t0 + dt, 7400 * j, amp * a * .3, .0009);
    modo(out, fs, t0 + dt, 2150 * j, amp * a * .35, .003);
  }
}

/* ── um toque ────────────────────────────────────────────── */
function descida(fs, v, k, rnd){
  const out = new Float32Array(Math.ceil(k.dur * fs));
  const A = v.altura * k.altura * (1 + (rnd() - .5) * .06);
  const D = v.seco * k.seco;
  if (v.raspa) ruido(out, fs, 0, rnd, 1400 * A, .7, v.raspa * .12, .004);
  if (v.degrau){
    ruido(out, fs, 0, rnd, 1700 * A, 1.1, v.degrau * .5, .0012);
    modo(out, fs, 0, 950 * A, v.degrau * .35, .003 * D);
    modo(out, fs, 0, 1500 * A, v.degrau * .2, .002 * D);
  }
  if (v.clique) clique(out, fs, 0, rnd, v.clique);

  const tb = (v.atraso + rnd() * .8) / 1000;
  ruido(out, fs, tb, rnd, 2600 * A, .9, v.batida * 1.8, .0014);
  ruido(out, fs, tb, rnd, 6000 * A, .7, v.batida * v.estalo * 1, .0007);
  for (const [f, a, tau] of MODOS){
    const cor = Math.min(1.8, Math.pow(f / 1200, -.6 * v.tom));
    modo(out, fs, tb, f * A * (1 + (rnd() - .5) * .05), a * (.8 + rnd() * .4) * cor, tau * D);
  }
  baque(out, fs, tb, 190 * A, 120 * A, v.grave * .2 * k.grave, .011 * D);
  if (k.estab){
    // a barra do estabilizador bate logo depois, nas pontas
    const te = tb + .003 + rnd() * .002;
    ruido(out, fs, te, rnd, 1200 * A, .9, .35 * k.estab, .0012);
    modo(out, fs, te, 300 * A, .25 * k.estab, .012 * D);
    modo(out, fs, te, 820 * A, .2 * k.estab, .007 * D);
    ruido(out, fs, te, rnd, 2200, 2, .05 * k.estab, .008);
  }
  if (v.mola){
    // a mola canta em parciais que não batem entre si: metal, não apito
    const fm = 4700 + rnd() * 900;
    modo(out, fs, tb, fm, v.mola * .03, .016);
    modo(out, fs, tb, fm * 1.47, v.mola * .018, .011);
  }
  return out;
}
function subida(fs, v, k, rnd){
  const out = new Float32Array(Math.ceil(Math.min(k.dur, .14) * fs));
  const A = v.altura * k.altura * 1.25 * (1 + (rnd() - .5) * .06);
  const D = v.seco * k.seco;
  ruido(out, fs, 0, rnd, 3200 * A, .8, .55, .0006);
  modo(out, fs, 0, 1050 * A, .45, .004 * D);
  modo(out, fs, 0, 2100 * A, .3, .0025 * D);
  modo(out, fs, 0, 3600 * A, .18, .0015 * D);
  if (k.estab){
    modo(out, fs, .001, 420 * A, .2 * k.estab, .01 * D);
    ruido(out, fs, .001, rnd, 1500, 1, .12 * k.estab, .001);
  }
  if (v.clique) clique(out, fs, .0005, rnd, v.cliqueVolta || .4);
  if (v.mola) modo(out, fs, 0, 5200 + rnd() * 600, v.mola * .02, .012);
  for (let i = 0; i < out.length; i++) out[i] *= v.volta;
  return out;
}

/* passa-alta (tira o tremor), brilho do switch e um fim sem estalo */
function acabar(x, fs, v){
  biquad(x, fs, 'hp', 55, .7);
  biquad(x, fs, 'lp', v.brilho, .7);
  const n = Math.min(x.length, Math.round(.006 * fs));
  for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n;
  return x;
}
const pico = (x) => { let p = 0; for (let i = 0; i < x.length; i++){ const a = Math.abs(x[i]); if (a > p) p = a; } return p; };

/* Todos os sons de um switch: { letra:[…], grande:[…], espaco:[…],
   volta:{ letra:[…], … } }, cada um um Float32Array na taxa fs. */
function banco(id, fs){
  const sw = SWITCHES.find(s => s.id === id) || SWITCHES[0];
  const v = sw.v, rnd = sorteio(hash(sw.id));
  const b = { id: sw.id, volta: {} };
  for (const [nome, k] of Object.entries(TECLAS)){
    b[nome] = Array.from({ length: VARIACOES }, () => acabar(descida(fs, v, k, rnd), fs, v));
    b.volta[nome] = Array.from({ length: VARIACOES_VOLTA }, () => acabar(subida(fs, v, k, rnd), fs, v));
  }
  // todos no mesmo volume: o pico das letras vai a .5, depois o ganho do switch
  const ref = Math.max(...b.letra.map(pico)) || 1;
  const g = .5 / ref * v.ganho;
  const ajusta = (x, kg) => { for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * g * kg * 1.3) / 1.3; };
  for (const [nome, k] of Object.entries(TECLAS)){
    b[nome].forEach(x => ajusta(x, k.ganho));
    b.volta[nome].forEach(x => ajusta(x, k.ganho));
  }
  return b;
}

/* ── teclas: tipo e posição ──────────────────────────────── */
const GRANDES = new Set(['Enter', 'NumpadEnter', 'Backspace', 'ShiftLeft', 'ShiftRight', 'Tab', 'CapsLock', 'Backslash', 'IntlBackslash']);
function tipoDaTecla(code){
  if (code === 'Space' || code === ' ') return 'espaco';
  return GRANDES.has(code) ? 'grande' : 'letra';
}
/* As fileiras de um teclado ABNT/ANSI; x de -1 (esquerda) a 1 (direita). */
const FILEIRAS = [
  ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
  ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'],
  ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
  ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'],
  ['ShiftLeft', 'IntlBackslash', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'IntlRo', 'ShiftRight'],
  ['ControlLeft', 'MetaLeft', 'AltLeft', 'Space', 'AltRight', 'MetaRight', 'ContextMenu', 'ControlRight'],
];
const POS = new Map();
FILEIRAS.forEach(f => f.forEach((c, i) => POS.set(c, (i / (f.length - 1)) * 2 - 1.15)));
POS.set('Space', -.1);
function posicao(code){
  if (POS.has(code)) return Math.max(-1, Math.min(1, POS.get(code)));
  if (/^(Arrow|Page|Home|End|Insert|Delete)/.test(code)) return .9;
  if (/^Numpad/.test(code)) return 1;
  return 0;
}

return { SWITCHES, TECLAS, VARIACOES, banco, tipoDaTecla, posicao, hash, sorteio };
})();

if (typeof module !== 'undefined') module.exports = SOM;

/* ═══════════════════════════════════════════════════════════
   No navegador: o áudio de verdade
   ═══════════════════════════════════════════════════════════ */
const SONS = (typeof window === 'undefined') ? null : (() => {
  const SALAS = {
    seca: { molhado: 0 },
    mesa: { molhado: .16, tau: .045, eco: .003 },
    sala: { molhado: .24, tau: .14, eco: .007 },
  };
  let ctx = null, mestre, envio, conv, molhado, banco = null, buffers = null, salaAtual = '';

  function audio(){
    if (!ctx){
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C({ latencyHint: 'interactive' });
      // o compressor segura a soma quando muitas teclas tocam juntas
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 4;
      comp.attack.value = .002; comp.release.value = .08;
      mestre = ctx.createGain();
      envio = ctx.createGain();
      conv = ctx.createConvolver();
      molhado = ctx.createGain();
      envio.connect(conv); conv.connect(molhado); molhado.connect(comp);
      mestre.connect(comp);
      comp.connect(ctx.destination);
      volume();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    sala();
    return ctx;
  }

  /* a acústica: uma resposta curta de ruído que se apaga, com um eco da mesa */
  function sala(){
    if (!ctx || salaAtual === prefs.somSala) return;
    salaAtual = prefs.somSala;
    const s = SALAS[salaAtual] || SALAS.mesa;
    molhado.gain.value = s.molhado;
    if (!s.molhado) return;
    const fs = ctx.sampleRate, n = Math.ceil(s.tau * 5 * fs);
    const ir = ctx.createBuffer(2, n, fs);
    const rnd = SOM.sorteio(7 + n);
    for (let c = 0; c < 2; c++){
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++){
        lp += .35 * ((rnd() * 2 - 1) - lp);              // ruído escurecido
        d[i] = lp * Math.exp(-i / (s.tau * fs));
      }
      const e = Math.round(s.eco * fs * (c ? 1.13 : 1));
      if (e < n) d[e] += .6;
    }
    conv.buffer = ir;
  }

  function volume(){
    if (!mestre) return;
    const v = Math.max(0, Math.min(100, +prefs.somVolume || 0)) / 100;
    mestre.gain.value = Math.pow(v, 1.7) * 1.25;
    envio.gain.value = Math.pow(v, 1.7) * 1.25;
  }

  /* os buffers do switch escolhido, gerados uma vez (uns 20 ms) */
  function preparar(id = prefs.switch){
    if (!audio()) return null;
    if (banco && banco.id === id) return buffers;
    banco = SOM.banco(id, ctx.sampleRate);
    const vira = (x) => { const b = ctx.createBuffer(1, x.length, ctx.sampleRate); b.getChannelData(0).set(x); return b; };
    buffers = { volta: {} };
    for (const k of Object.keys(SOM.TECLAS)){
      buffers[k] = banco[k].map(vira);
      buffers.volta[k] = banco.volta[k].map(vira);
    }
    return buffers;
  }

  function tocar(code, solta = false, quando = 0){
    const b = preparar();
    if (!b) return;
    const tipo = SOM.tipoDaTecla(code);
    const lista = solta ? b.volta[tipo] : b[tipo];
    const h = SOM.hash(code || '?');
    // a mesma tecla quase sempre com a mesma voz; às vezes outra, como no real
    const i = Math.random() < .3 ? Math.floor(Math.random() * lista.length) : h % lista.length;
    const fonte = ctx.createBufferSource();
    fonte.buffer = lista[i];
    fonte.playbackRate.value = (1 + (((h >>> 8) % 100) - 50) / 50 * .022) * (1 + (Math.random() - .5) * .012);
    const g = ctx.createGain();
    g.gain.value = .88 + Math.random() * .24;
    let ultimo = g;
    if (ctx.createStereoPanner){
      const p = ctx.createStereoPanner();
      p.pan.value = SOM.posicao(code) * .45;
      g.connect(p); ultimo = p;
    }
    fonte.connect(g);
    ultimo.connect(mestre);
    ultimo.connect(envio);
    fonte.start(quando || 0);
  }

  /* uma frase curta digitada, para ouvir o switch */
  const FRASE = ['KeyE', 'KeyS', 'KeyC', 'KeyR', 'KeyE', 'KeyV', 'KeyA', 'Space', 'KeyA', 'KeyQ', 'KeyU', 'KeyI', 'Enter'];
  function amostra(id){
    if (id) prefs.switch = id;
    if (!preparar()) return;
    let t = ctx.currentTime + .03;
    for (const c of FRASE){
      tocar(c, false, t);
      if (prefs.somSoltar) tocar(c, true, t + .07 + Math.random() * .04);
      t += .09 + Math.random() * .07 + (c === 'Space' ? .06 : 0);
    }
  }
  function umToque(code = 'KeyF'){
    if (!preparar()) return;
    const t = ctx.currentTime + .01;
    tocar(code, false, t);
    if (prefs.somSoltar) tocar(code, true, t + .085);
  }

  /* o teclado de verdade: na fase de captura, antes de qualquer painel
     parar o evento. Segurar a tecla não repete o som; soltar toca a volta. */
  const presas = new Set();
  const codigo = (e) => e.code || e.key || '?';
  addEventListener('keydown', (e) => {
    if (!prefs.sons || e.repeat) return;
    const c = codigo(e);
    if (presas.has(c)) return;
    presas.add(c);
    tocar(c);
  }, true);
  addEventListener('keyup', (e) => {
    const c = codigo(e);
    if (!presas.delete(c) || !prefs.sons || !prefs.somSoltar) return;
    tocar(c, true);
  }, true);
  addEventListener('blur', () => presas.clear());

  return { SWITCHES: SOM.SWITCHES, amostra, umToque, volume, sala, preparar };
})();
