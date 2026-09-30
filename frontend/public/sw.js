const CACHE_NAME = 'nuvra-ai-v1';
const ARQUIVOS_ESSENCIAIS = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_ESSENCIAIS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((chave) => chave !== CACHE_NAME).map((chave) => caches.delete(chave))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Só a própria origem: sem isso, chamadas à API (outra origem/porta) também passam por aqui,
  // e se a rede "falhar" (CORS, aborto, etc.) a queda para cache devolveria a home no lugar da resposta da API.
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return resposta;
      })
      .catch(() => caches.match(event.request).then((resposta) => resposta ?? caches.match('/'))),
  );
});
