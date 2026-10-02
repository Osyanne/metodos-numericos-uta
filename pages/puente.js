// Puente para la version publicada en GitHub Pages.
//
// Pages solo sirve archivos: no puede correr el servidor FastAPI. En vez de
// reescribir la matematica en JavaScript (dos parsers, dos resultados), se
// corre el MISMO aplicativo de Python dentro del navegador con Pyodide, y cada
// fetch a `api/...` se le entrega a la aplicacion FastAPI por ASGI, igual que
// lo haria uvicorn. app.js no se entera: sigue pidiendo y recibiendo JSON.
//
// Este archivo no existe en la version local. pages/construir.py lo agrega al
// armar el sitio, como script clasico antes de app.js, para que el reemplazo de
// fetch este puesto cuando app.js pida la lista de metodos.
(function () {
  "use strict";

  var PYODIDE = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
  var PAQUETES = ["sympy", "fastapi", "pydantic", "pillow", "fonttools", "micropip"];
  // fpdf2 no viene con Pyodide; es Python puro y se baja de PyPI.
  var DESDE_PYPI = ["fpdf2==2.8.9"];

  var fetchOriginal = window.fetch.bind(window);

  // ------------------------------------------------------------ aviso

  var aviso = document.createElement("div");
  aviso.id = "puente-aviso";
  aviso.setAttribute("role", "status");
  aviso.innerHTML =
    '<span class="puente-giro" aria-hidden="true"></span>' +
    '<span><b>Preparando el núcleo de Python en tu navegador.</b> ' +
    '<span id="puente-paso">Descargando Pyodide…</span><br>' +
    '<small>La primera visita tarda unos segundos; después queda en la caché.</small></span>';

  var estilo = document.createElement("style");
  estilo.textContent =
    "#puente-aviso{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));" +
    "transform:translateX(-50%);z-index:50;display:flex;gap:12px;align-items:center;" +
    "max-width:min(560px,calc(100vw - 32px));padding:12px 16px;border-radius:10px;" +
    "background:var(--surface,#fbfcfb);color:var(--ink,#1a211f);" +
    "border:1px solid var(--rule-firm,#b9c3bd);box-shadow:0 6px 24px rgba(0,0,0,.12);" +
    "font:14px/1.45 var(--sans,system-ui,sans-serif)}" +
    "#puente-aviso small{color:var(--ink-soft,#4c5854)}" +
    "#puente-aviso.puente-mal{border-color:var(--mal,#9b372b)}" +
    ".puente-giro{flex:none;width:18px;height:18px;border-radius:50%;" +
    "border:2px solid var(--rule,#d3dad5);border-top-color:var(--accent,#0e6e63);" +
    "animation:puente-giro .8s linear infinite}" +
    "@keyframes puente-giro{to{transform:rotate(360deg)}}" +
    "@media (prefers-reduced-motion:reduce){.puente-giro{animation:none}}";

  function montarAviso() {
    document.head.appendChild(estilo);
    document.body.appendChild(aviso);
  }
  if (document.body) montarAviso();
  else document.addEventListener("DOMContentLoaded", montarAviso);

  function paso(texto) {
    var p = document.getElementById("puente-paso");
    if (p) p.textContent = texto;
  }

  // ------------------------------------------------------------ Python

  function cargarScript(src) {
    return new Promise(function (resolver, rechazar) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolver;
      s.onerror = function () { rechazar(new Error("No se pudo descargar " + src)); };
      document.head.appendChild(s);
    });
  }

  async function arrancar() {
    await cargarScript(PYODIDE + "pyodide.js");
    paso("Iniciando Python…");
    var pyodide = await window.loadPyodide({ indexURL: PYODIDE });

    paso("Cargando SymPy y FastAPI…");
    var codigo = fetchOriginal("codigo.zip").then(function (r) {
      if (!r.ok) throw new Error("No se encontró codigo.zip (" + r.status + ")");
      return r.arrayBuffer();
    });
    await pyodide.loadPackage(PAQUETES);
    var micropip = pyodide.pyimport("micropip");
    await micropip.install(DESDE_PYPI);

    paso("Cargando los métodos…");
    pyodide.unpackArchive(await codigo, "zip", { extractDir: "/home/pyodide/aplicativo" });

    await pyodide.runPythonAsync(`
import asyncio, os, sys, traceback
import anyio.to_thread
from pyodide.ffi import to_js
from js import Object

# FastAPI corre los endpoints sincronos (todos los de api/routes.py) en un
# hilo aparte, y en WebAssembly no hay hilos. Aca se corren en el mismo: el
# navegador atiende un pedido a la vez, asi que no hay nada que paralelizar.
async def _en_el_mismo_hilo(func, *args, abandon_on_cancel=False, cancellable=None, limiter=None):
    return func(*args)

anyio.to_thread.run_sync = _en_el_mismo_hilo

RAIZ = "/home/pyodide/aplicativo"
# api/main.py exige la carpeta web/ al lado de api/. En el navegador la
# interfaz la sirve Pages, asi que alcanza con que exista.
os.makedirs(os.path.join(RAIZ, "web"), exist_ok=True)
sys.path.insert(0, RAIZ)

from api.main import create_app
_app = create_app()

async def atender(metodo, ruta, consulta, cuerpo):
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": metodo, "scheme": "https", "path": ruta,
        "raw_path": ruta.encode(), "root_path": "",
        "query_string": consulta.encode(),
        "headers": [(b"host", b"pages"), (b"content-type", b"application/json")],
        "client": ("navegador", 0), "server": ("pages", 443),
    }
    pendiente = [cuerpo.encode()]

    async def receive():
        if pendiente:
            return {"type": "http.request", "body": pendiente.pop(), "more_body": False}
        # Nadie se desconecta: se espera hasta que Starlette cancele.
        await asyncio.Future()

    respuesta = {"status": 500, "headers": [], "body": bytearray()}

    async def send(mensaje):
        if mensaje["type"] == "http.response.start":
            respuesta["status"] = mensaje["status"]
            respuesta["headers"] = [
                [k.decode("latin-1"), v.decode("latin-1")]
                for k, v in mensaje.get("headers", [])
            ]
        elif mensaje["type"] == "http.response.body":
            respuesta["body"].extend(mensaje.get("body", b""))

    try:
        await _app(scope, receive, send)
    except Exception:
        # Starlette ya mando el 500 con su mensaje generico antes de relanzar,
        # igual que con uvicorn. El detalle queda en la consola, como en el log.
        traceback.print_exc()
    return to_js(
        {"status": respuesta["status"], "headers": respuesta["headers"],
         "body": bytes(respuesta["body"])},
        dict_converter=Object.fromEntries,
    )
`);
    return pyodide.globals.get("atender");
  }

  var listo = arrancar().then(
    function (atender) {
      aviso.remove();
      return atender;
    },
    function (error) {
      aviso.classList.add("puente-mal");
      var giro = aviso.querySelector(".puente-giro");
      if (giro) giro.remove();
      paso("No se pudo cargar: " + error.message + ". Revisa la conexión y recarga la página.");
      throw error;
    },
  );

  // ------------------------------------------------------------ fetch

  // Solo las rutas api/ del propio sitio van a Python; todo lo demas
  // (Pyodide, los paquetes, codigo.zip) sale por la red como siempre.
  function rutaApi(entrada) {
    var texto = typeof entrada === "string" ? entrada : entrada.url;
    var url = new URL(texto, document.baseURI);
    var base = new URL(".", document.baseURI);
    if (url.origin !== base.origin || url.pathname.indexOf(base.pathname + "api/") !== 0) {
      return null;
    }
    return {
      ruta: "/" + url.pathname.slice(base.pathname.length),
      consulta: url.search.replace(/^\?/, ""),
    };
  }

  window.fetch = async function (entrada, opciones) {
    var api = rutaApi(entrada);
    if (!api) return fetchOriginal(entrada, opciones);

    var atender = await listo;
    var metodo = ((opciones && opciones.method) || "GET").toUpperCase();
    var cuerpo = (opciones && typeof opciones.body === "string") ? opciones.body : "";
    var r = await atender(metodo, api.ruta, api.consulta, cuerpo);
    return new Response(r.body, { status: r.status, headers: r.headers });
  };
})();
