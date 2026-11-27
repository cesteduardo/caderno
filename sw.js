/* Caderno — service worker
   Guarda os arquivos do app para abrir rápido e funcionar sem internet.
   O motor do tradutor (vendor/bergamot, 5 MB) não entra na lista: fica
   guardado na primeira vez que for usado, como qualquer arquivo do app.
   Rede primeiro (versão nova na hora); o cache serve sem internet.
   A sincronização (api.github.com) e o modelo do Whisper (Hugging Face,
   guardado pela própria biblioteca) não passam por aqui. */
const CACHE = 'caderno-v34';
const FILES = [
  './', 'index.html', 'style.css', 'estudo.css', 'manifest.webmanifest',
  'js/icones.js', 'js/pilula.js', 'js/rotina.js', 'js/agenda.js', 'js/base.js', 'js/formatos.js', 'js/leitor.js', 'js/pdf.js', 'js/analise.js',
  'js/aulas.js', 'js/revisar.js', 'js/traduzir.js', 'js/escrever.js', 'js/notas.js', 'js/app.js', 'js/whisper.js',
  'escrever/index.html', 'escrever/app.js', 'escrever/personalizar.js', 'escrever/estudo.js', 'escrever/icones.js', 'escrever/ponte.js', 'escrever/usos.js', 'escrever/sons.js', 'escrever/style.css', 'escrever/icons/favicon.svg', 'escrever/icons/escritor.svg',
  'escrever/fontes/Inter-Regular.woff2', 'escrever/fontes/Inter-Medium.woff2', 'escrever/fontes/Inter-SemiBold.woff2',
  'escrever/fontes/AtkinsonHyperlegible-Regular.woff2', 'escrever/fontes/AtkinsonHyperlegible-Bold.woff2',
  'escrever/fontes/iAWriterDuoS-Regular.woff2', 'escrever/fontes/iAWriterDuoS-Bold.woff2', 'escrever/fontes/iAWriterDuoS-Italic.woff2', 'escrever/fontes/iAWriterDuoS-BoldItalic.woff2',
  'escrever/fontes/iAWriterMonoS-Regular.woff2', 'escrever/fontes/iAWriterMonoS-Bold.woff2', 'escrever/fontes/iAWriterMonoS-Italic.woff2', 'escrever/fontes/iAWriterMonoS-BoldItalic.woff2',
  'escrever/fontes/iAWriterQuattroS-Regular.woff2', 'escrever/fontes/iAWriterQuattroS-Bold.woff2', 'escrever/fontes/iAWriterQuattroS-Italic.woff2', 'escrever/fontes/iAWriterQuattroS-BoldItalic.woff2',
  'escrever/fontes/iAWriterDuoV.woff2', 'escrever/fontes/iAWriterDuoV-Italic.woff2', 'escrever/fontes/iAWriterMonoV.woff2', 'escrever/fontes/iAWriterMonoV-Italic.woff2',
  'escrever/fontes/iAWriterQuattroV.woff2', 'escrever/fontes/iAWriterQuattroV-Italic.woff2',
  'vendor/jszip.min.js', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs', 'vendor/franc.min.mjs', 'data/dicionario.json',
  'js/folio.js', 'js/bergamot.mjs',
  ...['view', 'epub', 'epubcfi', 'progress', 'overlayer', 'text-walker', 'paginator', 'fixed-layout', 'search', 'mobi', 'fb2', 'comic-book', 'tts', 'vendor/zip', 'vendor/fflate'].map(f => 'vendor/foliate/' + f + '.js'),
  'fonts/Inter-Regular.woff2', 'fonts/Inter-Medium.woff2', 'fonts/Inter-SemiBold.woff2',
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
  /* Rede primeiro: com internet, sempre a versão nova (atualizar o site
     chega na hora, sem precisar abrir duas vezes). Sem internet, ou se a
     rede demorar mais de 4 s, a cópia guardada. A biblioteca do Whisper
     tem versão fixa: vem do cache direto. */
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: !lib });
    if (cached && lib) return cached;
    const fresh = fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    });
    if (!cached) return fresh;
    const lento = new Promise(r => setTimeout(() => r(cached), 4000));
    return Promise.race([fresh.catch(() => cached), lento]);
  }));
});
