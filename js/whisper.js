/* Whisper no próprio aparelho (worker).
   O modelo é baixado do Hugging Face na primeira vez e fica no cache do
   navegador; depois transcreve sem internet. Usa a placa de vídeo
   (WebGPU) quando há, senão o processador (WASM). */
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';

env.allowLocalModels = false;
env.useBrowserCache = true;

let asr = null, modelo = null;

async function carregar(model){
  if (asr && modelo === model) return;
  let device = 'wasm';
  try {
    const ad = self.navigator && navigator.gpu && await navigator.gpu.requestAdapter();
    const inf = (ad && ad.info) || {};
    // placa emulada por software (SwiftShader, llvmpipe) é mais lenta que o processador
    const soft = ad && (ad.isFallbackAdapter || inf.isFallbackAdapter || /swiftshader|llvmpipe|lavapipe|software|cpu/i.test([inf.vendor, inf.architecture, inf.device, inf.description].join(' ')));
    if (ad && !soft) device = 'webgpu';
  } catch (e) {}
  const opts = {
    device,
    dtype: device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback: p => { if (p.status === 'progress') postMessage({ type: 'progress', file: p.file, pct: p.progress || 0 }); },
  };
  try { asr = await pipeline('automatic-speech-recognition', model, opts); }
  catch (e) {
    if (device !== 'webgpu') throw e;
    device = 'wasm';
    asr = await pipeline('automatic-speech-recognition', model, { ...opts, device, dtype: 'q8' });
  }
  modelo = model;
  postMessage({ type: 'ready', device });
}

self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === 'load'){ await carregar(m.model); return; }
    if (m.type === 'run'){
      await carregar(m.model);
      const out = await asr(m.audio, { language: m.lang || 'portuguese', task: 'transcribe', return_timestamps: true, chunk_length_s: 30, stride_length_s: 4 });
      postMessage({ type: 'result', id: m.id, chunks: out.chunks || [{ timestamp: [0, m.audio.length / 16000], text: out.text }] });
    }
  } catch (err) {
    postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) });
  }
};
