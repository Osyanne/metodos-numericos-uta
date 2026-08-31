// Orquesta la interfaz: carga los metodos, arma el formulario, resuelve,
// dibuja la tabla y el plano.

import { Formulario } from "./forms.js";
import { Plano, capasDesdePlot } from "./plano.js";
import { dibujarResumen, dibujarTabla } from "./tabla.js";
import { montarComparador } from "./comparador.js";

const $ = (sel) => document.querySelector(sel);

const estado = {
  metodos: [],
  metodo: null,
  resultado: null,
};

// ------------------------------------------------------------ API

async function pedir(ruta, opciones) {
  const respuesta = await fetch(ruta, {
    headers: { "Content-Type": "application/json" },
    ...opciones,
  });
  if (!respuesta.ok) {
    let detalle = `Error ${respuesta.status}`;
    try {
      const cuerpo = await respuesta.json();
      // 422 trae el mensaje del nucleo, ya explicado en terminos del problema.
      if (cuerpo?.detail) {
        detalle = typeof cuerpo.detail === "string"
          ? cuerpo.detail
          : JSON.stringify(cuerpo.detail);
      }
    } catch { /* la respuesta no era JSON */ }
    throw new Error(detalle);
  }
  return respuesta.json();
}

export const api = {
  metodos: () => pedir("/api/methods"),
  resolver: (slug, cuerpo) =>
    pedir(`/api/methods/${slug}/solve`, { method: "POST", body: JSON.stringify(cuerpo) }),
  muestrear: (cuerpo) =>
    pedir("/api/plot/sample", { method: "POST", body: JSON.stringify(cuerpo) }),
};

// ------------------------------------------------------------ configuracion

function configuracion() {
  return {
    decimals: Number($("#decimales").value),
    max_iterations: Number($("#iteraciones").value),
    tolerance: Number($("#tolerancia").value),
    error_criterion: $("#criterio").value,
    stop_on_tolerance: $("#parar").checked,
  };
}

// ------------------------------------------------------------ arranque

const formulario = new Formulario($("#formulario"));

const plano = new Plano($("#plano"), {
  alMuestrear: async (peticion) => {
    try {
      return await api.muestrear(peticion);
    } catch {
      // Un remuestreo fallido no puede tumbar la grafica que ya se ve.
      return null;
    }
  },
});

function avisar(mensaje, clase = "mal") {
  const caja = $("#aviso");
  caja.textContent = mensaje;
  caja.className = `aviso aviso-${clase}`;
  caja.hidden = !mensaje;
}

function seleccionarMetodo(slug) {
  estado.metodo = estado.metodos.find((m) => m.slug === slug);
  if (!estado.metodo) return;
  $("#descripcion").textContent = estado.metodo.description ?? "";
  formulario.dibujar(estado.metodo);
  $("#resumen").innerHTML = "";
  $("#tabla").innerHTML = "";
  plano.limpiar();
  avisar("");
}

async function resolver() {
  avisar("");
  let params;
  try {
    params = formulario.valores();
  } catch (e) {
    avisar(e.message);
    return;
  }

  $("#resolver").disabled = true;
  try {
    const resultado = await api.resolver(estado.metodo.slug, {
      params,
      ...configuracion(),
    });
    estado.resultado = resultado;
    pintarResultado();
  } catch (e) {
    avisar(e.message);
    $("#resumen").innerHTML = "";
    $("#tabla").innerHTML = "";
    plano.limpiar();
  } finally {
    $("#resolver").disabled = false;
  }
}

function pintarResultado() {
  const decimales = Number($("#decimales").value);
  dibujarResumen($("#resumen"), estado.resultado, decimales);
  dibujarTabla($("#tabla"), estado.resultado, decimales);
  const { capas, resample } = capasDesdePlot(estado.resultado.plot);
  plano.mostrar(capas, resample);
  $("#leyenda").innerHTML = "";
  for (const capa of plano.capas) {
    if (!capa.nombre) continue;
    const item = document.createElement("span");
    item.className = "leyenda-item";
    item.innerHTML =
      `<i style="background:${capa.color}"></i>${capa.nombre}`;
    $("#leyenda").append(item);
  }
}

async function iniciar() {
  try {
    estado.metodos = await api.metodos();
  } catch (e) {
    avisar(`No se pudo cargar la lista de metodos: ${e.message}`);
    return;
  }

  const select = $("#metodo");
  select.innerHTML = "";
  for (const m of estado.metodos) {
    const op = document.createElement("option");
    op.value = m.slug;
    op.textContent = `${m.name}  ·  ${m.unit}`;
    select.append(op);
  }
  select.addEventListener("change", () => seleccionarMetodo(select.value));
  seleccionarMetodo(estado.metodos[0]?.slug);

  montarComparador({ api, estado, plano, configuracion, formulario });
}

// Cambiar la precision solo re-formatea: no se vuelve a pedir nada.
$("#decimales").addEventListener("input", () => {
  $("#decimales-valor").textContent = $("#decimales").value;
  if (estado.resultado) pintarResultado();
});

$("#resolver").addEventListener("click", resolver);
$("#encuadrar").addEventListener("click", () => plano.encuadrar());
$("#reiniciar-vista").addEventListener("click", () => plano.reiniciarVista());

for (const [id, panel] of [["ver-plano", "panel-plano"], ["ver-tabla", "panel-tabla"]]) {
  $(`#${id}`).addEventListener("click", () => {
    for (const b of document.querySelectorAll(".pestana")) b.classList.remove("activa");
    for (const p of document.querySelectorAll(".panel")) p.hidden = true;
    $(`#${id}`).classList.add("activa");
    $(`#${panel}`).hidden = false;
  });
}

for (const formato of ["csv", "pdf"]) {
  $(`#exportar-${formato}`).addEventListener("click", async () => {
    if (!estado.metodo) return;
    let params;
    try {
      params = formulario.valores();
    } catch (e) {
      avisar(e.message);
      return;
    }
    const respuesta = await fetch(
      `/api/methods/${estado.metodo.slug}/export/${formato}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params, ...configuracion() }),
      },
    );
    if (!respuesta.ok) {
      avisar(`No se pudo exportar a ${formato.toUpperCase()}.`);
      return;
    }
    const blob = await respuesta.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${estado.metodo.slug}.${formato}`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

iniciar();
