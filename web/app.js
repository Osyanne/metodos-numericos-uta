// Orquesta la interfaz: carga los metodos, arma el formulario, resuelve,
// dibuja la tabla y el plano.

import { Formulario } from "./forms.js";
import { Plano, capasDesdePlot } from "./plano.js";
import { dibujarResumen, dibujarTabla } from "./tabla.js";
import { montarComparador } from "./comparador.js";
import { presetsPara } from "./presets.js";
import { montarVistaIntegral } from "./vista-integral.js";

const $ = (sel) => document.querySelector(sel);

const estado = {
  metodos: [],
  metodo: null,
  resultado: null,
  // Cada peticion se sella con el valor de este contador. Si al volver la
  // respuesta el contador cambio, el usuario ya pidio otra cosa y lo que
  // llego corresponde a una pregunta que nadie esta haciendo: se descarta.
  corrida: 0,
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

function limpiarPantalla() {
  $("#resumen").innerHTML = "";
  $("#tabla").innerHTML = "";
  $("#leyenda").innerHTML = "";
  $("#comparacion").innerHTML = "";
  plano.limpiar();
}

function avisar(mensaje, clase = "mal") {
  const caja = $("#aviso");
  caja.textContent = mensaje;
  caja.className = `aviso aviso-${clase}`;
  caja.hidden = !mensaje;
}

function seleccionarMetodo(slug) {
  estado.metodo = estado.metodos.find((m) => m.slug === slug);
  if (!estado.metodo) return;

  // Olvidar el resultado, no solo borrarlo de la pantalla. Vaciar el DOM y
  // dejar `estado.resultado` en pie hacia que mover el control de Decimales
  // repintara la corrida del metodo anterior bajo el nombre del nuevo:
  // numeros correctos atribuidos al metodo equivocado, que es peor que no
  // mostrar nada.
  estado.resultado = null;
  estado.corrida += 1;

  $("#descripcion").textContent = estado.metodo.description ?? "";
  llenarPresets(estado.metodo.slug);
  formulario.dibujar(estado.metodo);
  mostrarVistaIntegral();
  limpiarPantalla();
  avisar("");
}

// La vista previa con el simbolo ∫ solo tiene sentido para los metodos de
// integracion: se muestra encima del formulario del Punto Medio y se oculta
// para los demas. Se remonta cada vez porque el formulario se redibujo.
function mostrarVistaIntegral() {
  const caja = $("#vista-integral");
  if (estado.metodo?.family === "integracion") {
    caja.hidden = false;
    montarVistaIntegral(caja, formulario);
  } else {
    caja.hidden = true;
    caja.innerHTML = "";
  }
}


// ------------------------------------------------------------ presets

function llenarPresets(slug) {
  const select = $("#preset");
  const disponibles = presetsPara(slug);
  select.innerHTML = "";

  const vacio = document.createElement("option");
  vacio.value = "";
  vacio.textContent = disponibles.length
    ? "Escribir los datos a mano"
    : "No hay ejercicios cargados para este metodo";
  select.append(vacio);

  for (const preset of disponibles) {
    const op = document.createElement("option");
    op.value = preset.id;
    op.textContent = preset.nombre;
    select.append(op);
  }
  select.disabled = disponibles.length === 0;
  $("#preset-descripcion").textContent = "";
}

function aplicarPreset(id) {
  const preset = presetsPara(estado.metodo.slug).find((p) => p.id === id);
  if (!preset) {
    formulario.dibujar(estado.metodo);
    $("#preset-descripcion").textContent = "";
    return;
  }

  // Un ejercicio cargado reemplaza los datos Y la configuracion de calculo:
  // media carga (los datos nuevos con la precision vieja) da una tabla que no
  // es la del ejercicio ni la de nadie.
  formulario.dibujar(estado.metodo, preset.params);
  mostrarVistaIntegral();
  $("#decimales").value = preset.config.decimals;
  $("#decimales-valor").textContent = preset.config.decimals;
  $("#iteraciones").value = preset.config.max_iterations;
  $("#tolerancia").value = preset.config.tolerance;
  $("#criterio").value = preset.config.error_criterion;
  $("#parar").checked = preset.config.stop_on_tolerance;

  $("#preset-descripcion").textContent =
    `${preset.descripcion} Fuente: ${preset.fuente}.`;

  estado.resultado = null;
  estado.corrida += 1;
  limpiarPantalla();
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

  const corrida = ++estado.corrida;
  $("#resolver").disabled = true;
  try {
    const resultado = await api.resolver(estado.metodo.slug, {
      params,
      ...configuracion(),
    });
    if (corrida !== estado.corrida) return;
    estado.resultado = resultado;
    pintarResultado();
    // Si la pagina esta scrolleada hacia abajo (mirando los campos del
    // formulario o la configuracion), la animacion del plano pasa fuera de
    // pantalla y el usuario no la ve. Al terminar de resolver la traemos
    // hacia arriba: primero el resumen con el numero, y despues el plano.
    llevarLaVistaAlPlano();
  } catch (e) {
    if (corrida !== estado.corrida) return;
    avisar(e.message);
    estado.resultado = null;
    limpiarPantalla();
  } finally {
    // Se rehabilita siempre. Condicionarlo a que la corrida siga siendo la
    // actual dejaba el boton muerto cuando la respuesta llegaba tarde: el
    // guard esta para no pintar datos viejos, no para trabar la interfaz.
    $("#resolver").disabled = false;
  }
}

// Lleva la vista al inicio del panel principal, para que el resumen y el
// plano queden a la vista al terminar de resolver: sin esto, un usuario que
// scrolleo hacia abajo mirando los campos del formulario se pierde toda la
// animacion del dibujo. Se intenta primero el smooth-scroll nativo y se
// asegura despues con un scroll directo, porque hay webviews embebidos que
// aceptan el behavior "smooth" y lo ignoran sin fallar: sin este seguro, la
// vista se queda donde estaba en esos entornos. En navegadores normales el
// scrollTo suave ya movio la vista y el salto final es un no-op.
function llevarLaVistaAlPlano() {
  const panel = document.querySelector(".panel-principal");
  if (!panel) return;

  const destino = window.scrollY + panel.getBoundingClientRect().top;
  if (Math.abs(destino - window.scrollY) < 4) return;

  const sinAnimacion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    window.scrollTo({
      top: destino,
      behavior: sinAnimacion ? "auto" : "smooth",
    });
  } catch {
    // Firma antigua de scrollTo(x, y): no acepta objeto de opciones.
    window.scrollTo(0, destino);
  }

  // Seguro: si el smooth-scroll no arranco (webview que lo ignora), la
  // proxima vuelta del event loop scrollea de una. Cuando si arranco, el
  // scrollTo directo simplemente confirma la posicion final.
  setTimeout(() => {
    if (Math.abs(window.scrollY - destino) > 4) {
      window.scrollTo(0, destino);
    }
  }, 0);
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
    op.textContent = m.name;
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

$("#preset").addEventListener("change", () => aplicarPreset($("#preset").value));
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
    const boton = $(`#exportar-${formato}`);
    boton.disabled = true;
    try {
      const respuesta = await fetch(
        `/api/methods/${estado.metodo.slug}/export/${formato}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ params, ...configuracion() }),
        },
      );
      if (!respuesta.ok) {
        // El servidor manda la causa en `detail`, ya explicada en terminos del
        // problema. Reemplazarla por "no se pudo exportar" obliga al usuario a
        // adivinar que estaba mal, cuando el resto de la app si se la muestra.
        let detalle = `No se pudo exportar a ${formato.toUpperCase()}.`;
        try {
          const cuerpo = await respuesta.json();
          if (cuerpo?.detail) {
            detalle = typeof cuerpo.detail === "string"
              ? cuerpo.detail
              : JSON.stringify(cuerpo.detail);
          }
        } catch { /* la respuesta no era JSON */ }
        avisar(detalle);
        return;
      }
      const blob = await respuesta.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${estado.metodo.slug}.${formato}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      avisar(
        `No se pudo exportar a ${formato.toUpperCase()}: ${e.message}`,
      );
    } finally {
      boton.disabled = false;
    }
  });
}

iniciar();
