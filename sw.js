// Ao publicar mudanças em style.css/app.js, incremente o número aqui E no
// ?v= dos <link>/<script> do index.html (mantê-los iguais evita cache velho).
const VERSAO_ASSETS = '20';
const CACHE_NAME = 'controle-financeiro-v' + VERSAO_ASSETS;
const ARQUIVOS_SHELL = [
  './',
  './index.html',
  './style.css?v=' + VERSAO_ASSETS,
  './app.js?v=' + VERSAO_ASSETS,
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca interceptar chamadas de fora do próprio app: API do Supabase, CDN
  // do supabase-js e o fluxo de login OAuth do Google.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first: sempre tenta buscar a versão mais nova primeiro.
  // Só usa o cache se estiver offline. cache: 'no-store' ignora o cache
  // HTTP do próprio navegador (o GitHub Pages manda max-age=600 no
  // index.html), senão "network-first" viraria "cache do navegador
  // primeiro" por até 10 minutos depois de cada deploy.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return resposta;
      })
      .catch(() => caches.match(event.request))
  );
});
