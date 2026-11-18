// Service worker de la version publicada en GitHub Pages: la segunda visita
// no vuelve a bajar Pyodide, sus paquetes ni el sitio.
//
// pages/construir.py reemplaza __VERSION__ por una huella del contenido y
// __ARCHIVOS__ por la lista de todo lo armado. Como el nombre de la cache lleva
// la huella, un despliegue nuevo instala una cache nueva y borra la anterior:
// nunca se mezclan archivos de dos versiones. Se registra con ruta relativa,
// asi que su alcance es la subcarpeta /metodos-numericos-uta/.
"use strict";

var VERSION = "__VERSION__";
var ARCHIVOS = __ARCHIVOS__;
var SITIO = "sitio-" + VERSION;
// Direcciones con la version en la ruta: nunca cambian de contenido, asi que
// se guardan para siempre (cache-first). Lo demas va siempre a la red.
var INMUTABLES = [
  { host: "cdn.jsdelivr.net", ruta: "/pyodide/v" },
  { host: "files.pythonhosted.org", ruta: "/packages/" },
];
var CDN = "inmutables-v1";

var rutasDelSitio = ARCHIVOS.map(function (a) { return new URL(a, self.location).pathname; });

self.addEventListener("install", function (evento) {
  // Si un archivo falla, la instalacion falla y sigue sirviendo la version anterior.
  evento.waitUntil(
    caches.open(SITIO)
      .then(function (cache) {
        return cache.addAll(ARCHIVOS.map(function (a) { return new Request(a, { cache: "reload" }); }));
      })
      .then(function () { return self.skipWaiting(); }),
  );
});

self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches.keys()
      .then(function (nombres) {
        return Promise.all(nombres
          .filter(function (n) { return n.indexOf("sitio-") === 0 && n !== SITIO; })
          .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); }),
  );
});

function esInmutable(url) {
  return INMUTABLES.some(function (i) {
    return url.host === i.host && url.pathname.indexOf(i.ruta) === 0;
  });
}

self.addEventListener("fetch", function (evento) {
  var pedido = evento.request;
  if (pedido.method !== "GET") return;
  var url = new URL(pedido.url);

  if (url.origin === self.location.origin) {
    if (rutasDelSitio.indexOf(url.pathname) === -1) return;
    evento.respondWith(
      caches.open(SITIO)
        .then(function (cache) { return cache.match(pedido, { ignoreSearch: true }); })
        .then(function (guardado) { return guardado || fetch(pedido); }),
    );
    return;
  }

  if (esInmutable(url)) {
    evento.respondWith(
      caches.open(CDN).then(function (cache) {
        return cache.match(pedido).then(function (guardado) {
          if (guardado) return guardado;
          return fetch(pedido).then(function (respuesta) {
            // 200 completo y con CORS: una respuesta opaca o parcial no se guarda.
            if (respuesta.status === 200 && respuesta.type !== "opaque") {
              // Sin waitUntil el navegador puede cortar el worker antes de guardar.
              evento.waitUntil(cache.put(pedido, respuesta.clone()).catch(function () {}));
            }
            return respuesta;
          });
        });
      }),
    );
  }
});
