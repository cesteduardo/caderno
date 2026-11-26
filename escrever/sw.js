/* Escritor · service worker.
   Guarda o aplicativo inteiro no aparelho na primeira visita, para que ele
   abra sem internet e possa ser instalado (Chrome, Edge, Android).
   Trocar a VERSAO apaga o cache antigo e baixa o novo. */
const VERSAO = 'escritor-2.8.3';
const ESSENCIAL = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/escritor.svg',
  "./app.js","./dicionario.js","./estudo.js","./icones.js","./personalizar.js","./ponte.js","./sons.js","./usos.js",
  "./fontes/AtkinsonHyperlegible-Bold.woff2","./fontes/AtkinsonHyperlegible-Regular.woff2","./fontes/Inter-Medium.woff2","./fontes/Inter-Regular.woff2","./fontes/Inter-SemiBold.woff2","./fontes/iAWriterDuoS-Bold.woff2","./fontes/iAWriterDuoS-BoldItalic.woff2","./fontes/iAWriterDuoS-Italic.woff2","./fontes/iAWriterDuoS-Regular.woff2","./fontes/iAWriterDuoV-Italic.woff2","./fontes/iAWriterDuoV.woff2","./fontes/iAWriterMonoS-Bold.woff2","./fontes/iAWriterMonoS-BoldItalic.woff2","./fontes/iAWriterMonoS-Italic.woff2","./fontes/iAWriterMonoS-Regular.woff2","./fontes/iAWriterMonoV-Italic.woff2","./fontes/iAWriterMonoV.woff2","./fontes/iAWriterQuattroS-Bold.woff2","./fontes/iAWriterQuattroS-BoldItalic.woff2","./fontes/iAWriterQuattroS-Italic.woff2","./fontes/iAWriterQuattroS-Regular.woff2","./fontes/iAWriterQuattroV-Italic.woff2","./fontes/iAWriterQuattroV.woff2",
  "./orto/hunspell.js","./orto/orto-worker.js","./orto/pt-BR.aff","./orto/pt-BR.dic"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('escritor-') && n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

/* Tudo sai do cache primeiro, inclusive a página: assim o HTML, o CSS e o
   JavaScript são sempre da mesma versão. O navegador confere o sw.js a cada
   abertura; quando a VERSAO muda, a versão nova vale a partir da próxima
   vez que o Escritor for aberto. O que não está na lista (os sons de cada
   switch, por exemplo) é baixado uma vez e guardado. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((achado) => achado || fetch(req).then((r) => {
      if (r.ok && r.type === 'basic') {
        const copia = r.clone();
        caches.open(VERSAO).then((c) => c.put(req, copia));
      }
      return r;
    }))
  );
});
