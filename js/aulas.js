/* =====================================================================
   Aulas: gravar, transcrever e estudar
   ---------------------------------------------------------------------
   Gravação em blocos de 30 s (cada bloco é um arquivo que se decodifica
   sozinho). Cada bloco vai para o IndexedDB (aud:<aula>:<início ms>) e
   para a fila de transcrição; o texto aparece enquanto a aula segue.
   O Whisper roda no próprio aparelho (js/whisper.js). Se a transcrição
   falhar ou o app fechar, o áudio fica guardado e a fila continua depois.
   Aula: { id, name, course, professor, number, theme, created, durMs,
           status: 'rec' | 'done', segs:[{id, ms, end, text}], pend:[ms],
           marks:[{id, ms, text, note}], refs, summary, keyPoints,
           questions, oneLiner }
   Destaques da transcrição ficam em E.hl com { lesson, s1, a, s2, b }.
   ===================================================================== */
'use strict';

const MODELOS = [
  { id: 'onnx-community/whisper-base', nome: 'Rápido', mb: 80, nota: 'bom para celular; erra mais nomes' },
  { id: 'onnx-community/whisper-small', nome: 'Equilibrado', mb: 250, nota: 'o padrão; bom para aulas em português' },
  { id: 'onnx-community/whisper-large-v3-turbo', nome: 'Preciso', mb: 850, nota: 'só para PC com placa de vídeo' },
];
const modelo = () => E.prefs.modelo || (FRACO ? MODELOS[0].id : MODELOS[1].id);
const BLOCO_S = 30;
/* Erros fixos do Whisper com o nome da escola, mais as trocas que você
   ensinar com “Corrigir” (E.prefs.trocas). Valem para tudo o que entra. */
const TROCAS_FIXAS = [[/(^|[^\p{L}])(?:FSQ|FESC|F\.S\.Q\.?|Efesco|Efesq|EFESQ|Efesc|Éfesc|Efes[ck]o?)(?=[^\p{L}]|$)/gu, '$1EFESC']];
function trocar(t){
  for (const [re, by] of TROCAS_FIXAS) t = t.replace(re, by);
  for (const [w, r] of Object.entries(E.prefs.trocas || {})) t = t.replace(new RegExp('(^|[^\\p{L}])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[^\\p{L}]|$)', 'gu'), (m, a) => a + r);
  return t;
}
const lessonsSorted = () => live('lessons').sort((a, b) => (b.created || 0) - (a.created || 0));
const segText = l => (l.segs || []).map(s => s.text).join(' ');

/* ---------- Whisper (worker) ---------- */
const WH = {
  w: null, n: 0, wait: new Map(), device: null, prog: {},
  get(){
    if (this.w) return this.w;
    this.w = new Worker('js/whisper.js', { type: 'module' });
    this.w.onmessage = e => {
      const m = e.data;
      if (m.type === 'progress'){ this.prog[m.file] = m.pct; this.onProgress && this.onProgress(this.progress()); }
      else if (m.type === 'ready'){ this.device = m.device; this.prog = {}; this.onProgress && this.onProgress(null); }
      else if (m.type === 'result' || m.type === 'error'){
        const p = this.wait.get(m.id); this.wait.delete(m.id);
        if (p) m.type === 'result' ? p[0](m.chunks) : p[1](new Error(m.message));
      }
    };
    this.w.onerror = e => { for (const [, p] of this.wait) p[1](new Error(e.message || 'o Whisper não carregou')); this.wait.clear(); this.w = null; };
    return this.w;
  },
  progress(){ const v = Object.values(this.prog); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; },
  run(audio){
    const id = ++this.n;
    return new Promise((res, rej) => { this.wait.set(id, [res, rej]); this.get().postMessage({ type: 'run', id, audio, model: modelo(), lang: 'portuguese' }, [audio.buffer]); });
  },
};

/* Áudio → Float32 mono 16 kHz (o que o Whisper espera) */
async function decode16k(blob){
  const buf = await blob.arrayBuffer();
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new Ctx(1, 16000, 16000);
  const ab = await new Promise((res, rej) => { const p = ctx.decodeAudioData(buf, res, rej); p && p.then && p.then(res, rej); });
  if (ab.numberOfChannels === 1) return ab.getChannelData(0).slice();
  const out = new Float32Array(ab.length);
  for (let c = 0; c < ab.numberOfChannels; c++){ const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) out[i] += d[i] / ab.numberOfChannels; }
  return out;
}
/* Ponto de corte num silêncio próximo (evita partir palavra ao meio) */
function quietCut(a, at, span = 3 * 16000){
  const w = 800; let best = at, bv = Infinity;
  for (let i = Math.max(0, at - span); i < Math.min(a.length - w, at + span); i += w){
    let s = 0; for (let j = i; j < i + w; j += 4) s += a[j] * a[j];
    if (s < bv){ bv = s; best = i + w / 2; }
  }
  return best;
}

/* ---------- fila de transcrição ---------- */
const TQ = {
  jobs: [], busy: false, cur: null,
  add(lessonId, ms){ if (!this.jobs.some(j => j.l === lessonId && j.ms === ms)) this.jobs.push({ l: lessonId, ms }); this.pump(); },
  pending(id){ return this.jobs.filter(j => j.l === id).length + (this.cur && this.cur.l === id ? 1 : 0); },
  async pump(){
    if (this.busy) return;
    this.busy = true;
    while (this.jobs.length){
      const j = this.cur = this.jobs.shift();
      try { await transcribeBlock(j.l, j.ms); }
      catch (e) {
        console.warn(e);
        const l = getI('lessons', j.l);
        if (l){ l.err = String(e.message || e); putI('lessons', l); }
        this.jobs = this.jobs.filter(x => x.l !== j.l);
        lessonUi();
        if (/WebGPU|memory|memória|fetch|load|carreg/i.test(l && l.err || '')) toast('A transcrição parou: ' + clip(l.err, 120) + '. O áudio está guardado; tente de novo ou troque o modelo em Aulas → Ajustes.');
      }
    }
    this.cur = null; this.busy = false;
    lessonUi();
  },
};
async function transcribeBlock(lessonId, ms){
  const blob = await DB.get(`aud:${lessonId}:${ms}`);
  let l = getI('lessons', lessonId);
  if (!blob || !l){ dropPend(l, ms); return; }
  const audio = await decode16k(blob);
  // arquivos longos: pedaços de 5 min, cortados no silêncio
  const PART = 300 * 16000;
  let start = 0;
  while (start < audio.length){
    let end = audio.length - start > PART * 1.3 ? quietCut(audio, start + PART) : audio.length;
    const part = audio.slice(start, end);
    const off = ms + Math.round(start / 16);
    const chunks = await WH.run(part);
    l = getI('lessons', lessonId);
    if (!l) return;
    const add = chunks.map(c => ({ id: uid(), ms: off + Math.round((c.timestamp[0] || 0) * 1000), end: off + Math.round((c.timestamp[1] ?? (part.length / 16000)) * 1000), text: trocar(String(c.text || '').trim()) }))
      .filter(s => s.text && !/^\[.*\]$|^\(.*\)$/.test(s.text) && !/^(legendas?|transcri[çc][ãa]o) (pela|por)/i.test(s.text));
    l.segs = [...(l.segs || []).filter(s => s.ms < off || s.ms >= off + part.length / 16), ...add].sort((a, b) => a.ms - b.ms);
    l.err = null;
    putI('lessons', l);
    LIVE.last = add.length ? add[add.length - 1].text : LIVE.last;
    if (l.import) l.importPct = Math.min(1, end / audio.length);
    lessonUi();
    start = end;
  }
  dropPend(getI('lessons', lessonId), ms);
}
function dropPend(l, ms){
  if (!l) return;
  l.pend = (l.pend || []).filter(x => x !== ms);
  if (!l.pend.length && l.status === 'done' && l.needFicha) finishFicha(l);
  putI('lessons', l);
}
async function finishFicha(l){
  l.needFicha = false;
  try { Object.assign(l, await ficha(l)); l.fichaAt = Date.now(); }
  catch (e) { console.warn(e); }
  putI('lessons', l);
  lessonUi();
}

/* ---------- gravação ---------- */
const LIVE = { l: null, rec: null, stream: null, t0: 0, acc: 0, running: false, timer: 0, tick: 0, last: '', an: null };
function pickMime(){ for (const c of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c; return ''; }
const elapsed = () => LIVE.acc + (LIVE.running ? performance.now() - LIVE.t0 : 0);
async function startCapture(mode){
  let stream;
  try {
    if (mode === 'aba'){
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, systemAudio: 'include' });
      if (!stream.getAudioTracks().length){ stream.getTracks().forEach(t => t.stop()); throw new Error('Nenhum áudio foi compartilhado. Ao escolher a aba, marque “Compartilhar áudio da aba”.'); }
      stream.getVideoTracks().forEach(t => t.stop());
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    }
  } catch (e) {
    throw new Error(e.name === 'NotAllowedError' ? 'Permissão negada. Libere o microfone para este site nas configurações do navegador.' : (e.message || String(e)));
  }
  const audio = new MediaStream(stream.getAudioTracks());
  audio.getAudioTracks()[0].addEventListener('ended', () => { if (LIVE.l) stopRec(); });
  LIVE.stream = audio;
  try {
    const ac = new AudioContext(), src = ac.createMediaStreamSource(audio), an = ac.createAnalyser();
    an.fftSize = 512; src.connect(an); LIVE.an = an; LIVE.ac = ac;
  } catch (e) {}
}
function cycle(){
  if (!LIVE.running || !LIVE.stream) return;
  const mime = pickMime(), parts = [], at = Math.round(elapsed());
  const rec = new MediaRecorder(LIVE.stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
  rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
  rec.onstop = async () => {
    if (parts.length && LIVE.l){
      const id = LIVE.l.id, blob = new Blob(parts, { type: mime || 'audio/webm' });
      await DB.set(`aud:${id}:${at}`, blob);
      const l = getI('lessons', id);
      if (l){ l.pend = [...new Set([...(l.pend || []), at])]; l.durMs = Math.max(l.durMs || 0, Math.round(elapsed())); l.hasAudio = true; putI('lessons', l); }
      TQ.add(id, at);
    }
    if (LIVE.running) cycle();
  };
  LIVE.rec = rec;
  rec.start();
  clearTimeout(LIVE.timer);
  LIVE.timer = setTimeout(() => rec.state !== 'inactive' && rec.stop(), BLOCO_S * 1000);
}
async function beginRec(l, mode){
  if (LIVE.l){ toast('Já há uma aula gravando.'); return; }
  await startCapture(mode);
  LIVE.l = l; LIVE.acc = l.durMs || 0; LIVE.t0 = performance.now(); LIVE.running = true; LIVE.last = '';
  l.status = 'rec'; putI('lessons', l);
  wantAwake(true);
  WH.get().postMessage({ type: 'load', model: modelo() });
  cycle();
  clearInterval(LIVE.tick);
  LIVE.tick = setInterval(liveTick, 250);
  lessonUi();
}
function pauseRec(){
  if (!LIVE.running) return;
  LIVE.acc = elapsed(); LIVE.running = false;
  clearTimeout(LIVE.timer);
  LIVE.rec && LIVE.rec.state !== 'inactive' && LIVE.rec.stop();
  lessonUi();
}
function resumeRec(){
  if (LIVE.running || !LIVE.stream) return;
  LIVE.t0 = performance.now(); LIVE.running = true; cycle(); lessonUi();
}
async function stopRec(){
  const l = LIVE.l; if (!l) return;
  const wasRunning = LIVE.running;
  LIVE.acc = elapsed(); LIVE.running = false;
  clearTimeout(LIVE.timer); clearInterval(LIVE.tick);
  if (wasRunning && LIVE.rec && LIVE.rec.state !== 'inactive'){
    await new Promise(r => { LIVE.rec.addEventListener('stop', () => setTimeout(r, 50), { once: true }); LIVE.rec.stop(); });
  }
  LIVE.stream && LIVE.stream.getTracks().forEach(t => t.stop());
  try { LIVE.ac && LIVE.ac.close(); } catch (e) {}
  Object.assign(LIVE, { l: null, rec: null, stream: null, an: null, ac: null });
  wantAwake(false);
  const cur = getI('lessons', l.id);
  if (cur){
    cur.status = 'done'; cur.ended = Date.now(); cur.durMs = Math.round(LIVE.acc);
    if ((cur.pend || []).length) cur.needFicha = true; else await finishFicha(cur);
    putI('lessons', cur);
  }
  lessonUi();
}
function markMoment(text){
  const l = LIVE.l && getI('lessons', LIVE.l.id); if (!l) return;
  const ms = Math.max(0, Math.round(elapsed()) - 5000);  // quem marca já ouviu o trecho
  (l.marks ||= []).push({ id: uid(), ms, text: text || '', note: '' });
  putI('lessons', l);
  const b = $('#markBtn'); if (b){ b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  lessonUi();
}
function liveTick(){
  const c = fmtClock(elapsed());
  document.querySelectorAll('.lclock').forEach(t => { if (t.textContent !== c) t.textContent = c; });
  const m = $('#liveMeter');
  if (m && LIVE.an){
    const d = new Uint8Array(LIVE.an.fftSize); LIVE.an.getByteTimeDomainData(d);
    let s = 0; for (const v of d){ const x = (v - 128) / 128; s += x * x; }
    m.style.setProperty('--lv', Math.min(1, Math.sqrt(s / d.length) * 4).toFixed(3));
  }
}
addEventListener('beforeunload', e => { if (LIVE.l){ e.preventDefault(); e.returnValue = ''; } });

/* Retoma transcrições que ficaram pela metade */
async function resumePending(){
  for (const l of live('lessons')){
    if (l.status === 'rec' && (!LIVE.l || LIVE.l.id !== l.id)){ l.status = 'done'; l.needFicha = true; putI('lessons', l); }
    if (!(l.pend || []).length) continue;
    const keys = await DB.keys(`aud:${l.id}:`);
    const have = new Set(keys.map(k => +k.split(':')[2]));
    const keep = l.pend.filter(ms => have.has(ms));
    if (keep.length !== l.pend.length){ l.pend = keep; putI('lessons', l); }
  }
}
function retryLesson(l){ l.err = null; putI('lessons', l); for (const ms of l.pend || []) TQ.add(l.id, ms); lessonUi(); }

/* ---------- lista de aulas ---------- */
function renderLessons(){
  const list = lessonsSorted();
  $('#lessonCount').textContent = list.length || '';
  const box = $('#lessons');
  const settings = h('details', { class: 'card asr' },
    h('summary', {}, h('b', { text: 'Transcrição' }), h('span', { class: 'muted small', text: MODELOS.find(m => m.id === modelo())?.nome + (WH.device ? ' · ' + (WH.device === 'webgpu' ? 'placa de vídeo' : 'processador') : '') })),
    h('p', { class: 'muted small', text: 'O Whisper roda neste aparelho: o áudio não sai daqui. O modelo é baixado uma vez e fica guardado no navegador.' }),
    h('div', { class: 'opts' }, MODELOS.map(m => h('label', { class: 'opt' + (m.id === modelo() ? ' on' : '') },
      h('input', { type: 'radio', name: 'modelo', checked: m.id === modelo(), onchange: () => { E.prefs.modelo = m.id; saveE(); WH.w && WH.w.terminate(); WH.w = null; renderLessons(); } }),
      h('b', { text: m.nome }), h('span', { text: `~${m.mb} MB · ${m.nota}` })))));
  if (!list.length){
    box.replaceChildren(h('div', { class: 'empty card' },
      h('h2', { text: 'Nenhuma aula ainda.' }),
      h('p', { text: 'Grave a próxima aula daqui, ou traga as que já estão no Caderno Inteligente: no PC, rode tools/exportar-transcrito.py e importe o arquivo gerado (no rodapé, Importar).' })), settings);
    return;
  }
  const byCourse = new Map();
  for (const l of list){ const k = l.course || 'Sem curso'; if (!byCourse.has(k)) byCourse.set(k, []); byCourse.get(k).push(l); }
  box.replaceChildren(
    LIVE.l ? h('section', { class: 'card live-pill', onclick: () => go('aula', LIVE.l.id) }, h('i'), h('b', { text: 'Gravando: ' + LIVE.l.name }), h('span', { class: 'lclock', text: fmtClock(elapsed()) })) : null,
    ...[...byCourse].map(([course, ls]) => h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: course }), h('span', { class: 'pill-muted', text: plural(ls.length, 'aula', 'aulas') + ' · ' + fmtHM(Math.round(ls.reduce((s, l) => s + (l.durMs || 0), 0) / 60000)) })),
      h('div', { class: 'lessons' }, ls.map(lessonRow)))),
    settings);
}
function lessonRow(l){
  const n = TQ.pending(l.id) || (l.pend || []).length;
  const state = LIVE.l && LIVE.l.id === l.id ? 'gravando' : n ? `transcrevendo · faltam ${n}` : l.err ? 'transcrição parou' : '';
  const hls = live('hl').filter(x => x.lesson === l.id).length;
  return h('button', { class: 'row lrow', type: 'button', onclick: () => go('aula', l.id) },
    h('span', { class: 'lnum', text: l.number || '·' }),
    h('span', { class: 'ltxt' },
      h('b', { text: l.name || 'Aula' }),
      h('span', { class: 'muted small', text: [l.professor, fmtDate(l.created), l.durMs ? fmtHM(Math.round(l.durMs / 60000)) : null, hls ? plural(hls, 'destaque', 'destaques') : null].filter(Boolean).join(' · ') }),
      l.oneLiner ? h('span', { class: 'lone', text: clip(l.oneLiner, 160) }) : null),
    state ? h('span', { class: 'tag' + (l.err ? ' danger' : ''), text: state }) : null);
}

/* ---------- nova aula ---------- */
const lastCourse = () => (lessonsSorted()[0] || {}).course || 'EFESC';
function newLessonForm(fromFile){
  const f = {
    name: h('input', { type: 'text', placeholder: 'Ex.: Narrador e ponto de vista', 'aria-label': 'Nome da aula', autofocus: true }),
    course: h('input', { type: 'text', value: lastCourse(), list: 'courseList', 'aria-label': 'Curso' }),
    professor: h('input', { type: 'text', value: (lessonsSorted()[0] || {}).professor || '', 'aria-label': 'Professor' }),
    number: h('input', { type: 'text', value: nextNumber(), 'aria-label': 'Número', style: { width: '80px' } }),
    theme: h('textarea', { class: 'note-ta', rows: 2, placeholder: 'Tema ou ementa (ajuda o resumo e as perguntas)' }),
  };
  const dl = h('datalist', { id: 'courseList' }, [...new Set(live('lessons').map(l => l.course).filter(Boolean))].map(c => h('option', { value: c })));
  const canTab = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && !matchMedia('(hover:none)').matches;
  let mode = 'mic';
  const modes = h('div', { class: 'seg' });
  const paintModes = () => modes.replaceChildren(...[['mic', 'Microfone'], ...(canTab ? [['aba', 'Áudio de uma aba']] : [])].map(([k, l]) => h('button', { type: 'button', class: k === mode ? 'on' : '', text: l, onclick: () => { mode = k; paintModes(); } })));
  paintModes();
  const body = h('div', { class: 'form' },
    h('label', {}, 'Nome', f.name),
    h('div', { class: 'form-row' }, h('label', {}, 'Curso', f.course, dl), h('label', {}, 'Nº', f.number)),
    h('label', {}, 'Professor', f.professor),
    f.theme,
    fromFile ? h('p', { class: 'muted small', text: 'Arquivo: ' + fromFile.name }) : h('div', {}, h('span', { class: 'muted small', text: 'Gravar de' }), modes),
    !fromFile && canTab ? h('p', { class: 'muted small', text: 'Aula no navegador (Zoom, YouTube, plataforma do curso)? Escolha “Áudio de uma aba”, selecione a aba e marque “Compartilhar áudio”. A aula continua tocando normalmente.' }) : null);
  modal(fromFile ? 'Transcrever arquivo' : 'Nova aula', body, [
    { label: 'Cancelar' },
    { label: fromFile ? 'Transcrever' : 'Começar a gravar', primary: true, onclick: async () => {
      const l = putI('lessons', {
        id: 'a' + uid() + uid(), name: f.name.value.trim() || (fromFile ? fromFile.name.replace(/\.[^.]+$/, '') : 'Aula ' + (f.number.value || fmtDay(Date.now()))),
        course: f.course.value.trim(), professor: f.professor.value.trim(), number: f.number.value.trim(), theme: f.theme.value.trim(),
        created: Date.now(), durMs: 0, status: 'done', segs: [], marks: [], pend: [],
      });
      if (fromFile) await importAudio(l, fromFile);
      else {
        try { await beginRec(l, mode); }
        catch (e) { toast(e.message); l.status = 'done'; putI('lessons', l); }
      }
      whenClosed(() => go('aula', l.id));
    } },
  ]);
}
function nextNumber(){
  const c = lastCourse(), ns = live('lessons').filter(l => l.course === c).map(l => parseInt(l.number, 10)).filter(n => n > 0);
  return ns.length ? String(Math.max(...ns) + 1).padStart(2, '0') : '01';
}
async function importAudio(l, file){
  await DB.set(`aud:${l.id}:0`, file);
  let dur = 0;
  try { dur = await new Promise(res => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(a.duration * 1000 || 0); a.onerror = () => res(0); a.src = URL.createObjectURL(file); }); } catch (e) {}
  Object.assign(l, { durMs: Math.round(dur), pend: [0], hasAudio: true, import: true, importPct: 0, needFicha: true, status: 'done' });
  putI('lessons', l);
  if (FRACO && dur > 40 * 60e3) toast('Arquivo longo para este aparelho: a transcrição pode levar mais que a própria aula. Deixe a tela acesa e o carregador ligado.');
  TQ.add(l.id, 0);
}
$('#newLesson').addEventListener('click', () => newLessonForm());
$('#audioFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) newLessonForm(f); });

/* ---------- aula aberta ---------- */
let curLesson = null, lessonTab = 'ficha';
function lessonUi(){
  if (currentView === 'aulas') renderLessons();
  else if (currentView === 'aula' && curLesson) renderLesson(curLesson, true);
}
function renderLesson(id, soft){
  id = id || curLesson;
  const l = getI('lessons', id);
  const box = $('#v-aula');
  if (!l){ box.replaceChildren(h('div', { class: 'empty card' }, h('h2', { text: 'Aula não encontrada.' }), h('button', { class: 'btn', type: 'button', text: '← Aulas', onclick: () => go('aulas') }))); return; }
  if (curLesson !== id){ lessonTab = l.summary || l.segs?.length ? 'ficha' : 'texto'; player.stop(); }
  curLesson = id;
  const recording = LIVE.l && LIVE.l.id === id;
  if (recording) lessonTab = 'ao-vivo';
  else if (lessonTab === 'ao-vivo') lessonTab = 'ficha';
  // atualização vinda da fila: no texto e na ficha, redesenha só se nada estiver selecionado
  if (soft && !recording){
    const s = getSelection();
    if (s && !s.isCollapsed && box.contains(s.anchorNode)) return;
    if (document.activeElement && box.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  }
  if (soft && recording && box.querySelector('.live')){ paintLive(l); return; }
  const scrollY = soft ? window.scrollY : 0;
  const n = TQ.pending(id) || (l.pend || []).length;
  const tabs = recording ? [] : [['ficha', 'Ficha'], ['texto', 'Transcrição'], ['marcas', `Marcações${(l.marks || []).length ? ' · ' + l.marks.length : ''}`]];
  box.replaceChildren(
    h('div', { class: 'wrap-in' },
      h('button', { class: 'btn-text back', type: 'button', text: '← Aulas', onclick: () => go('aulas') }),
      h('header', { class: 'page-head lesson-head' },
        h('span', { class: 'eyebrow', text: [l.course, l.number && 'aula ' + l.number].filter(Boolean).join(' · ') || 'Aula' }),
        h('h1', { text: l.name || 'Aula' }),
        h('p', { class: 'lead', text: [l.professor, fmtDate(l.created), l.durMs ? fmtHM(Math.round(l.durMs / 60000)) : null].filter(Boolean).join(' · ') }),
        l.theme ? h('p', { class: 'muted', text: l.theme }) : null),
      n || l.err ? h('div', { class: 'card tq' + (l.err ? ' is-error' : '') },
        h('b', { text: l.err ? 'A transcrição parou' : l.import ? `Transcrevendo o arquivo · ${Math.round((l.importPct || 0) * 100)}%` : `Transcrevendo · faltam ${plural(n, 'bloco', 'blocos')} de 30 s` }),
        h('span', { class: 'muted small', id: 'tqInfo', text: l.err ? clip(l.err, 160) : WH.progress() != null ? `Baixando o modelo: ${Math.round(WH.progress())}%` : 'Pode navegar pelo app; a fila continua.' }),
        l.err || (!TQ.pending(id) && n) ? h('button', { class: 'btn small', type: 'button', text: 'Tentar de novo', onclick: () => retryLesson(l) }) : null) : null,
      tabs.length ? h('div', { class: 'toolbar' },
        h('div', { class: 'seg' }, tabs.map(([k, t]) => h('button', { type: 'button', class: k === lessonTab ? 'on' : '', text: t, onclick: () => { lessonTab = k; renderLesson(id); } }))),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn ghost small', type: 'button', text: 'Editar', onclick: () => editLesson(l) }),
        h('button', { class: 'btn ghost small', type: 'button', text: 'Exportar .md', onclick: () => exportLessonMd(l) }),
        h('button', { class: 'btn ghost small', type: 'button', text: '⋯', 'aria-label': 'Mais', onclick: e => lessonMenu(l, e.currentTarget) })) : null,
      ({ 'ao-vivo': liveView, ficha: fichaView, texto: textView, marcas: marksView })[lessonTab](l)),
    l.hasAudio && !recording ? player.bar() : null);
  if (scrollY) window.scrollTo(0, scrollY);
}
function lessonMenu(l, btn){
  selbar.show(btn.getBoundingClientRect(), [
    { label: 'Refazer ficha', onclick: async () => { selbar.hide(); toast('Refazendo a ficha…'); await finishFicha(l); toast('Ficha refeita.'); } },
    { label: 'Continuar gravando', onclick: async () => { selbar.hide(); try { await beginRec(l, 'mic'); } catch (e) { toast(e.message); } } },
    { label: 'Apagar aula', cls: 'danger', onclick: async () => {
      selbar.hide();
      if (!await confirmBox(`Apagar “${l.name}”, com a transcrição, o áudio e os destaques?`)) return;
      await DB.delPrefix(`aud:${l.id}:`);
      for (const x of live('hl').filter(x => x.lesson === l.id)) delI('hl', x.id);
      delI('lessons', l.id); go('aulas');
    } },
  ]);
}
function editLesson(l){
  const f = ['name', 'course', 'professor', 'number'].map(k => [k, h('input', { type: 'text', value: l[k] || '', 'aria-label': k })]);
  const th = h('textarea', { class: 'note-ta', rows: 3 }); th.value = l.theme || '';
  const lab = { name: 'Nome', course: 'Curso', professor: 'Professor', number: 'Número' };
  modal('Dados da aula', h('div', { class: 'form' }, f.map(([k, el]) => h('label', {}, lab[k], el)), h('label', {}, 'Tema', th)), [
    { label: 'Cancelar' },
    { label: 'Salvar', primary: true, onclick: () => { for (const [k, el] of f) l[k] = el.value.trim(); l.theme = th.value.trim(); putI('lessons', l); renderLesson(l.id); } },
  ]);
}

/* ao vivo */
function liveView(l){
  const note = h('input', { type: 'text', placeholder: 'Anotar algo neste momento… (Enter)', 'aria-label': 'Anotação rápida' });
  note.addEventListener('keydown', e => { if (e.key === 'Enter' && note.value.trim()){ markMoment(note.value.trim()); note.value = ''; } });
  return h('section', { class: 'card live' },
    h('div', { class: 'live-top' },
      h('span', { class: 'live-dot' + (LIVE.running ? ' on' : '') }, LIVE.running ? 'Gravando' : 'Pausada'),
      h('span', { class: 'live-clock lclock', text: fmtClock(elapsed()) }),
      h('span', { class: 'meter', id: 'liveMeter' }, h('i'))),
    h('p', { class: 'live-last', id: 'liveLast', text: LIVE.last || 'O texto aparece aqui uns segundos depois de cada bloco de 30 s.' }),
    h('p', { class: 'muted small', id: 'liveInfo' }),
    h('div', { class: 'live-acts' },
      h('button', { class: 'btn big', id: 'markBtn', type: 'button', text: 'Marcar momento', onclick: () => markMoment() }),
      LIVE.running ? h('button', { class: 'btn ghost', type: 'button', text: 'Pausar', onclick: pauseRec }) : h('button', { class: 'btn ghost', type: 'button', text: 'Continuar', onclick: resumeRec }),
      h('button', { class: 'btn danger', type: 'button', text: 'Encerrar aula', onclick: stopRec })),
    note,
    h('ol', { class: 'live-marks', id: 'liveMarks' }));
}
function paintLive(l){
  const last = $('#liveLast'); if (last && LIVE.last) last.textContent = LIVE.last;
  const info = $('#liveInfo');
  if (info){
    const p = WH.progress(), n = TQ.pending(l.id);
    info.textContent = p != null ? `Baixando o modelo de transcrição: ${Math.round(p)}% (só na primeira vez)` : l.err ? 'Transcrição parada: ' + clip(l.err, 100) + '. A gravação continua.' : n ? `${plural(n, 'bloco', 'blocos')} na fila de transcrição` : (l.segs || []).length ? `${plural(l.segs.length, 'trecho transcrito', 'trechos transcritos')}` : '';
  }
  const ml = $('#liveMarks');
  if (ml) ml.replaceChildren(...(l.marks || []).slice(-5).reverse().map(m => h('li', {}, h('i', { text: fmtClock(m.ms) }), m.text || 'momento marcado')));
}
WH.onProgress = () => { if (currentView === 'aula' && curLesson){ const l = getI('lessons', curLesson); if (l && LIVE.l) paintLive(l); else { const t = $('#tqInfo'); const p = WH.progress(); if (t && p != null) t.textContent = `Baixando o modelo: ${Math.round(p)}%`; } } };
document.addEventListener('keydown', e => {
  if (!LIVE.l || currentView !== 'aula' || /INPUT|TEXTAREA/.test(e.target.tagName) || !$('#modal').hidden) return;
  if (e.key === 'm' || e.key === 'M'){ e.preventDefault(); markMoment(); }
});

/* ficha */
function fichaView(l){
  if (!l.summary && !(l.segs || []).length) return h('div', { class: 'empty card' }, h('p', { text: 'A ficha sai quando houver transcrição.' }));
  const refs = l.refs || [];
  const grp = [['author', 'Autores'], ['work', 'Obras'], ['concept', 'Conceitos']];
  const qs = l.questions || [];
  const already = new Set(live('cards').filter(c => c.src && c.src.t === 'aula' && c.src.id === l.id).map(c => c.front));
  const toAdd = qs.filter(q => !already.has(q));
  return h('div', { class: 'ficha' },
    l.oneLiner ? h('p', { class: 'one', text: l.oneLiner }) : null,
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: 'Resumo' }), h('span', { class: 'pill-muted', text: 'frases ditas na aula' })),
      ...(l.summary || '').split(/\n{2,}/).map(p => h('p', { class: 'para', text: p }))),
    (l.keyPoints || []).length ? h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: 'Pontos-chave' })),
      h('ol', { class: 'kp' }, l.keyPoints.map(k => h('li', {}, h('span', { text: k }),
        h('button', { class: 'mini', type: 'button', text: 'Cartão', onclick: () => openCardEditor({ kind: 'cloze', text: k, deck: l.course || 'Aulas', src: { t: 'aula', id: l.id, label: l.name } }) }))))) : null,
    qs.length ? h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: 'Perguntas de revisão' }),
        toAdd.length ? h('button', { class: 'btn small', type: 'button', text: `Criar ${plural(toAdd.length, 'cartão', 'cartões')}`, onclick: () => {
          addCards(toAdd.map(q => ({ kind: 'qa', front: q, back: answerFor(l, q), hint: 'Resposta montada com frases da aula. Ajuste com as suas palavras.', src: { t: 'aula', id: l.id, label: l.name } })), l.course || 'Aulas');
          toast(`${plural(toAdd.length, 'cartão criado', 'cartões criados')} em “${l.course || 'Aulas'}”.`); renderLesson(l.id);
        } }) : h('span', { class: 'pill-muted', text: 'já viraram cartões' })),
      h('ol', { class: 'kp' }, qs.map(q => h('li', { text: q })))) : null,
    refs.length ? h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: 'Referências' }), h('span', { class: 'pill-muted', text: '? = possivelmente; toque para conferir' })),
      grp.map(([t, name]) => {
        const rs = refs.filter(r => r.t === t);
        return rs.length ? h('div', { class: 'refs' }, h('h3', { text: name }), h('div', { class: 'ref-chips' }, rs.map(r =>
          h('button', { type: 'button', class: 'rchip' + (r.ok ? '' : ' maybe'), onclick: () => refBox(l, r) },
            r.c, r.x && t === 'work' ? h('i', { text: ' · ' + r.x }) : null, h('span', { text: r.ok ? r.n : '?' }))))) : null;
      })) : null);
}
/* resposta para a pergunta: a frase da aula que mais fala do assunto */
function answerFor(l, q){
  const ws = conteudo(q).filter(w => !['aula', 'ideia', 'central', 'discutida', 'contribuicao', 'explicou', 'destacou', 'relaciona', 'conceito'].includes(w));
  let best = '', bv = 0;
  for (const k of [...(l.keyPoints || []), ...(l.summary || '').split(/(?<=[.!?])\s+/)]){
    const c = new Set(conteudo(k)), v = ws.filter(w => c.has(w)).length;
    if (v > bv){ bv = v; best = k; }
  }
  if (!best){ const r = (l.refs || []).find(r => ws.some(w => normaliza(r.c).includes(w))); if (r && r.occ && r.occ[0]) best = r.occ[0].text; }
  return best || l.oneLiner || 'Responda com suas palavras e confira na ficha.';
}
function refBox(l, r){
  const body = h('div', {},
    h('p', { class: 'muted small', text: r.ok ? `Citado ${plural(r.n, 'vez', 'vezes')}.` : `O Whisper escreveu “${r.raw}”. Parece “${r.c}”, mas não é certo.` }),
    h('ol', { class: 'occ' }, (r.occ || []).map(o => h('li', {}, h('button', { type: 'button', onclick: () => { popLayer(); lessonTab = 'texto'; renderLesson(l.id); setTimeout(() => lessonJump(o.ms), 60); } }, h('i', { text: fmtClock(o.ms) }), clip(o.text, 220))))));
  const acts = [{ label: 'Fechar' }];
  if (!r.ok){
    acts.unshift({ label: 'Não é', onclick: () => { l.refs = l.refs.filter(x => x !== r); putI('lessons', l); renderLesson(l.id); } });
    acts.push({ label: 'É isso: corrigir no texto', primary: true, onclick: () => fixName(l, r.raw, r.c, r.t) });
  }
  modal(r.c, body, acts, { wide: true });
}
/* Corrige um nome em toda a transcrição e lembra para as próximas aulas */
function fixName(l, wrong, right, t){
  if (!wrong || !right || wrong === right) return;
  const re = new RegExp('(^|[^\\p{L}])' + wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[^\\p{L}]|$)', 'giu');
  let n = 0;
  for (const s of l.segs || []) s.text = s.text.replace(re, (m, a) => { n++; return a + right; });
  for (const m of l.marks || []) if (m.text) m.text = m.text.replace(re, (x, a) => a + right);
  (E.prefs.correcoes ||= {})[normaliza(wrong)] = { t: t || 'author', c: right };
  DIC = null;
  const r = (l.refs || []).find(x => x.c === right);
  if (r){ r.ok = true; r.raw = right; }
  putI('lessons', l);
  toast(`${plural(n, 'troca feita', 'trocas feitas')}. As próximas aulas já reconhecem “${right}”.`);
  renderLesson(l.id);
}

/* transcrição */
function textView(l){
  const segs = l.segs || [];
  if (!segs.length) return h('div', { class: 'empty card' }, h('p', { text: (l.pend || []).length ? 'O texto aparece aqui conforme a fila anda.' : 'Sem transcrição.' }));
  const inp = h('input', { type: 'search', placeholder: 'Buscar na transcrição', 'aria-label': 'Buscar na transcrição' });
  const body = h('div', { class: 'tr', id: 'trBody', lang: 'pt-BR' });
  const marks = (l.marks || []).map(m => m.ms);
  // parágrafos: quebra em pausa longa, a cada ~5 trechos ou numa marcação
  let p = null, k = 0, lastEnd = -1;
  for (const s of segs){
    const brk = !p || k >= 5 || (s.ms - lastEnd > 2500 && k >= 2) || marks.some(m => m > lastEnd && m <= s.ms);
    if (brk){
      p = h('p', { class: 'tp' }, h('button', { class: 'ts', type: 'button', 'data-ms': s.ms, text: fmtClock(s.ms), title: l.hasAudio ? 'Ouvir daqui' : '' }));
      body.append(p); k = 0;
    }
    p.append(h('span', { class: 'sg', 'data-s': s.id, 'data-ms': s.ms, text: s.text + ' ' }));
    k++; lastEnd = s.end || s.ms;
  }
  for (const m of l.marks || []){
    const sg = [...body.querySelectorAll('.sg')].find(x => +x.dataset.ms >= m.ms);
    const tp = sg ? sg.closest('.tp') : null;
    if (tp && !tp.querySelector('.mk')) tp.classList.add('marked');
  }
  paintLessonHl(l, body);
  body.addEventListener('click', e => {
    const ts = e.target.closest('.ts');
    if (ts){ if (l.hasAudio) player.playAt(l, +ts.dataset.ms); return; }
    const s = getSelection(); if (s && !s.isCollapsed) return;
    const m = e.target.closest('[data-h]');
    if (m){ const x = getI('hl', m.dataset.h); if (x) selbar.show(m.getBoundingClientRect(), lessonHlActions(l, x)); return; }
    const sg = e.target.closest('.sg');
    if (sg && player.on) player.playAt(l, +sg.dataset.ms);
  });
  let t;
  inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => {
    body.querySelectorAll('mark.hit').forEach(m => m.replaceWith(...m.childNodes)); body.normalize();
    const q = inp.value.trim(); if (q.length < 2) return;
    const nq = norm(q); let first = null;
    for (const sg of body.querySelectorAll('.sg')){
      const low = norm(sg.textContent); let i = low.indexOf(nq);
      const hits = []; while (i > -1){ hits.push(i); i = low.indexOf(nq, i + nq.length); }
      for (const a of hits.reverse()) wrapOffsets(sg, a, a + q.length, () => h('mark', { class: 'hit' }));
      if (hits.length && !first) first = sg;
    }
    if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    else toast('Nada encontrado.');
  }, 400); });
  return h('div', {}, h('div', { class: 'toolbar' }, inp, h('span', { class: 'muted small', text: 'Selecione um trecho para destacar, anotar ou virar cartão.' + (l.hasAudio ? ' Toque na hora para ouvir.' : '') })), h('section', { class: 'card tr-card' }, body));
}
function absOffset(root, node, off){
  const r = document.createRange(); r.setStart(root, 0); r.setEnd(node, off); return r.toString().length;
}
function segStart(root, id){ const sg = root.querySelector(`.sg[data-s="${CSS.escape(id)}"]`); return sg ? absOffset(root, sg, 0) : null; }
function paintLessonHl(l, root){
  for (const x of live('hl').filter(x => x.lesson === l.id)){
    const a0 = segStart(root, x.s1), b0 = segStart(root, x.s2);
    if (a0 == null || b0 == null) continue;
    wrapOffsets(root, a0 + x.a, b0 + x.b, () => { const m = document.createElement('mark'); m.className = 'hl c-' + x.color + (x.note ? ' has-note' : ''); m.dataset.h = x.id; return m; });
  }
}
function lessonHlActions(l, x){
  const redo = () => renderLesson(l.id);
  return [
    ...colorDots(x.color, c => { x.color = c; putI('hl', x); selbar.hide(); redo(); }),
    { label: x.note ? 'Ver nota' : 'Nota', onclick: () => { selbar.hide(); editNote(x.note, v => { x.note = v; putI('hl', x); redo(); }); } },
    { label: 'Cartão', onclick: () => { selbar.hide(); lessonCard(l, x); } },
    l.hasAudio ? { label: '▶', title: 'Ouvir', onclick: () => { selbar.hide(); player.playAt(l, x.ms); } } : null,
    { label: 'Apagar', cls: 'danger', onclick: () => { selbar.hide(); delI('hl', x.id); redo(); } },
  ].filter(Boolean);
}
function lessonCard(l, x){ openCardEditor({ kind: 'cloze', text: x.text, deck: l.course || 'Aulas', hint: x.note, src: { t: 'hl', id: x.id, lesson: l.id, label: `${l.name}, ${fmtClock(x.ms)}` } }); }
document.addEventListener('selectionchange', () => {
  if (currentView !== 'aula' || RD.eng) return;
  clearTimeout(lessonSel.t); lessonSel.t = setTimeout(lessonSel, 260);
});
function lessonSel(){
  const root = $('#trBody'), s = getSelection();
  if (!root || !s || s.isCollapsed || !s.rangeCount) return;
  const r = s.getRangeAt(0);
  if (!root.contains(r.commonAncestorContainer)) return;
  const text = s.toString().replace(/\s+/g, ' ').trim();
  if (text.length < 2) return;
  const segOf = (n) => (n.nodeType === 1 ? n : n.parentElement)?.closest('.sg');
  let s1 = segOf(r.startContainer), s2 = segOf(r.endContainer);
  if (!s1) s1 = root.querySelector('.sg');
  if (!s2) return;
  const l = getI('lessons', curLesson);
  const A = absOffset(root, r.startContainer, r.startOffset), B = absOffset(root, r.endContainer, r.endOffset);
  const make = color => {
    const x = putI('hl', { id: uid() + uid(), lesson: l.id, s1: s1.dataset.s, a: A - segStart(root, s1.dataset.s), s2: s2.dataset.s, b: B - segStart(root, s2.dataset.s), ms: +s1.dataset.ms, text, color, note: '', created: Date.now() });
    return x;
  };
  const done = () => { selbar.hide(); getSelection().removeAllRanges(); };
  const rects = r.getClientRects(), last = rects[rects.length - 1] || r.getBoundingClientRect();
  const words = text.split(' ').length;
  selbar.show(last, [
    ...colorDots(null, c => { make(c); done(); renderLesson(l.id); }),
    { label: 'Nota', onclick: () => { const x = make('am'); done(); editNote('', v => { x.note = v; putI('hl', x); renderLesson(l.id); }); renderLesson(l.id); } },
    { label: 'Cartão', onclick: () => { const x = make('am'); done(); renderLesson(l.id); lessonCard(l, x); } },
    words <= 4 ? { label: 'Corrigir', title: 'Corrigir este nome em toda a aula', onclick: () => {
      done();
      const inp = h('input', { type: 'text', value: text, 'aria-label': 'Forma certa', autofocus: true });
      const tp = h('select', { 'aria-label': 'Tipo' }, [['author', 'Autor'], ['work', 'Obra'], ['concept', 'Conceito'], ['', 'Outra palavra']].map(([v, t]) => h('option', { value: v, text: t })));
      modal('Corrigir “' + text + '”', h('div', { class: 'form' }, h('label', {}, 'Como se escreve', inp), h('label', {}, 'É um', tp), h('p', { class: 'muted small', text: 'Troca em toda a transcrição desta aula. Autores, obras e conceitos passam a ser reconhecidos nas próximas.' })), [
        { label: 'Cancelar' },
        { label: 'Corrigir', primary: true, onclick: () => {
          const right = inp.value.trim();
          if (!tp.value){ (E.prefs.trocas ||= {})[text] = right; for (const sg of l.segs) sg.text = trocar(sg.text); putI('lessons', l); toast('Corrigido nesta aula e nas próximas transcrições.'); renderLesson(l.id); return; }
          fixName(l, text, right, tp.value);
        } },
      ]);
    } } : null,
    { label: 'Copiar', onclick: () => { navigator.clipboard?.writeText(text); done(); toast('Copiado.'); } },
  ].filter(Boolean));
}
function lessonJump(ms, hlId){
  if (lessonTab !== 'texto'){ lessonTab = 'texto'; renderLesson(curLesson); }
  const root = $('#trBody'); if (!root) return;
  const el = (hlId && root.querySelector(`[data-h="${hlId}"]`)) || [...root.querySelectorAll('.sg')].reverse().find(x => +x.dataset.ms <= ms) || root.querySelector('.sg');
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove('blink'); void el.offsetWidth; el.classList.add('blink');
}

/* marcações */
function marksView(l){
  const ms = (l.marks || []).slice().sort((a, b) => a.ms - b.ms);
  if (!ms.length) return h('div', { class: 'empty card' }, h('p', { text: 'Nenhuma marcação. Durante a gravação, “Marcar momento” (ou a tecla M) guarda o ponto exato da aula.' }));
  const near = m => (l.segs || []).filter(s => s.ms >= m.ms - 4000 && s.ms <= m.ms + 25000).map(s => s.text).join(' ');
  return h('section', { class: 'card' }, h('ol', { class: 'marks' }, ms.map(m => h('li', {},
    h('button', { class: 'ts', type: 'button', text: fmtClock(m.ms), onclick: () => l.hasAudio ? player.playAt(l, m.ms) : lessonJump(m.ms) }),
    h('div', { class: 'mk-body' },
      m.text ? h('b', { text: m.text }) : null,
      h('p', { text: clip(near(m) || 'sem transcrição neste ponto', 360) }),
      m.note ? h('p', { class: 'hl-note', text: m.note }) : null,
      h('div', { class: 'hl-acts' },
        h('button', { type: 'button', text: 'Ver no texto', onclick: () => lessonJump(m.ms) }),
        h('button', { type: 'button', text: m.note ? 'Editar nota' : 'Nota', onclick: () => editNote(m.note, v => { m.note = v; putI('lessons', l); renderLesson(l.id); }) }),
        h('button', { type: 'button', text: 'Cartão', onclick: () => openCardEditor({ kind: 'cloze', text: clip(near(m), 400), deck: l.course || 'Aulas', hint: m.note || m.text, src: { t: 'aula', id: l.id, ms: m.ms, label: `${l.name}, ${fmtClock(m.ms)}` } }) }),
        h('button', { type: 'button', class: 'danger', text: 'Apagar', onclick: () => { l.marks = l.marks.filter(x => x.id !== m.id); putI('lessons', l); renderLesson(l.id); } })))))));
}

function exportLessonMd(l){
  const hls = live('hl').filter(x => x.lesson === l.id).sort((a, b) => a.ms - b.ms);
  let md = `# ${l.name}\n\n` + [l.course && `Curso: ${l.course}`, l.professor && `Professor: [[${l.professor}]]`, `Data: ${fmtDate(l.created)}`, l.durMs && `Duração: ${fmtHM(Math.round(l.durMs / 60000))}`].filter(Boolean).join('  \n') + '\n\n';
  if (l.theme) md += `> ${l.theme}\n\n`;
  if (l.summary) md += `## Resumo\n\n${l.summary}\n\n`;
  if ((l.keyPoints || []).length) md += '## Pontos-chave\n\n' + l.keyPoints.map(k => `- ${k}`).join('\n') + '\n\n';
  if ((l.questions || []).length) md += '## Perguntas\n\n' + l.questions.map(k => `- ${k}`).join('\n') + '\n\n';
  const ok = (l.refs || []).filter(r => r.ok);
  if (ok.length) md += '## Referências\n\n' + ok.map(r => `- [[${r.c}]]` + (r.x ? ` (${r.x})` : '')).join('\n') + '\n\n';
  if (hls.length) md += '## Destaques\n\n' + hls.map(x => `> ${x.text} (${fmtClock(x.ms)})` + (x.note ? `\n\n${x.note}` : '')).join('\n\n') + '\n\n';
  if ((l.marks || []).length) md += '## Marcações\n\n' + l.marks.map(m => `- ${fmtClock(m.ms)} ${m.text || ''}${m.note ? ' — ' + m.note : ''}`.replace(' — ', ': ')).join('\n') + '\n\n';
  md += '## Transcrição\n\n' + paragrafos((l.segs || []).map(s => s.text), 5).join('\n\n') + '\n';
  download(fileSafe(`${l.number ? l.number + ' ' : ''}${l.name}`) + '.md', md);
}

/* ---------- player do áudio guardado ---------- */
const player = {
  a: null, l: null, keys: [], i: -1, on: false, url: null,
  async load(l){
    if (this.l === l.id && this.keys.length) return;
    this.stop();
    this.l = l.id;
    this.keys = (await DB.keys(`aud:${l.id}:`)).map(k => +k.split(':')[2]).sort((a, b) => a - b);
  },
  async playAt(l, ms){
    await this.load(l);
    if (!this.keys.length){ toast('O áudio desta aula não está neste aparelho.'); return; }
    let i = 0; while (i < this.keys.length - 1 && this.keys[i + 1] <= ms) i++;
    await this.src(i);
    this.a.currentTime = Math.max(0, (ms - this.keys[i]) / 1000 - 1);
    this.a.play().catch(() => {});
  },
  async src(i){
    if (i === this.i && this.a) return;
    const blob = await DB.get(`aud:${this.l}:${this.keys[i]}`);
    if (!blob) return;
    this.a ||= Object.assign(new Audio(), { preload: 'auto' });
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(blob);
    this.a.src = this.url; this.i = i;
    this.a.onended = () => { if (this.i < this.keys.length - 1) this.src(this.i + 1).then(() => this.a.play()); else this.paint(); };
    this.a.ontimeupdate = () => this.paint();
    this.a.onplay = this.a.onpause = () => { this.on = !this.a.paused; this.paint(); };
  },
  now(){ return this.a && this.i > -1 ? this.keys[this.i] + this.a.currentTime * 1000 : 0; },
  toggle(){ if (!this.a || !this.a.src){ const l = getI('lessons', curLesson); if (l) this.playAt(l, 0); return; } this.a.paused ? this.a.play() : this.a.pause(); },
  skip(s){ const l = getI('lessons', curLesson); if (l) this.playAt(l, Math.max(0, this.now() + s * 1000 + 1000)); },
  rate(){ if (!this.a) return; const r = [1, 1.25, 1.5, 1.75, 2, .75]; this.a.playbackRate = r[(r.indexOf(this.a.playbackRate) + 1) % r.length]; this.paint(); },
  stop(){ if (this.a){ this.a.pause(); this.a.removeAttribute('src'); } if (this.url) URL.revokeObjectURL(this.url); this.url = null; this.i = -1; this.keys = []; this.l = null; this.on = false; },
  bar(){
    return h('div', { class: 'player', id: 'player' },
      h('button', { type: 'button', class: 'pl-btn', 'aria-label': 'Voltar 10 s', text: '−10', onclick: () => this.skip(-10) }),
      h('button', { type: 'button', class: 'pl-btn play', id: 'plPlay', 'aria-label': 'Tocar ou pausar', text: this.on ? 'Pausar' : 'Ouvir', onclick: () => this.toggle() }),
      h('button', { type: 'button', class: 'pl-btn', 'aria-label': 'Avançar 10 s', text: '+10', onclick: () => this.skip(10) }),
      h('span', { class: 'pl-time', id: 'plTime', text: fmtClock(this.now()) }),
      h('button', { type: 'button', class: 'pl-btn', id: 'plRate', text: ((this.a && this.a.playbackRate) || 1).toString().replace('.', ',') + '×', onclick: () => this.rate() }));
  },
  paint(){
    const p = $('#plPlay'), t = $('#plTime'), r = $('#plRate');
    if (p) p.textContent = this.on ? 'Pausar' : 'Ouvir';
    if (t) t.textContent = fmtClock(this.now());
    if (r && this.a) r.textContent = this.a.playbackRate.toString().replace('.', ',') + '×';
    // acompanha o texto
    const root = $('#trBody');
    if (root && this.on){
      const ms = this.now();
      const cur = root.querySelector('.sg.now');
      const sg = [...root.querySelectorAll('.sg')].reverse().find(x => +x.dataset.ms <= ms);
      if (sg !== cur){ cur && cur.classList.remove('now'); if (sg){ sg.classList.add('now'); } }
    }
  },
};
