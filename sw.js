/* Caderno — service worker
   Guarda os arquivos do app para abrir rápido e funcionar sem internet.
   "Stale-while-revalidate": responde do cache na hora e atualiza em
   segundo plano; uma versão nova aparece na abertura seguinte.
   A sincronização (api.github.com) e o modelo do Whisper (Hugging Face,
   guardado pela própria biblioteca) não passam por aqui. */
const CACHE = 'caderno-v2';
const FILES = [
  './', 'index.html', 'style.css', 'estudo.css', 'manifest.webmanifest',
  'js/rotina.js', 'js/base.js', 'js/formatos.js', 'js/leitor.js', 'js/pdf.js', 'js/analise.js',
  'js/aulas.js', 'js/revisar.js', 'js/notas.js', 'js/app.js', 'js/whisper.js',
  'vendor/jszip.min.js', 'vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'data/dicionario.json',
  'fonts/Inter-Regular.woff2', 'fonts/Inter-Medium.woff2', 'fonts/Inter-SemiBold.woff2', 'fonts/Jersey10-Regular.woff2',
  'icons/icon-192.png', 'icons/icon-512.png',
];
const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // a biblioteca do Whisper (versão fixa) também fica guardada, para transcrever sem internet
  const lib = url.href.startsWith(CDN);
  if (url.origin !== location.origin && !lib) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: !lib });
    if (cached && lib) return cached;
    const fresh = fetch(e.request).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
