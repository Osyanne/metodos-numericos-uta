// Orquesta la interfaz: carga los metodos, arma el formulario, resuelve,
// dibuja la tabla y el plano.

import { Formulario } from "./forms.js";
import { Plano, capasDesdePlot } from "./plano.js";
import { dibujarFilaActual, dibujarResumen, dibujarTabla, formatear, marcarFila } from "./tabla.js";
import { montarRecorrido } from "./recorrido.js";
import { montarComparador } from "./comparador.js";
import { presetsPara } from "./presets.js";
import { montarVistaIntegral } from "./vista-integral.js";
import { ICONOS } from "./iconos.js";
import { formulaPara, sustitucionPara } from "./formulas.js";
import { asasDe, mover, campoDe, describir } from "./asas.js";

const $ = (sel) => document.querySelector(sel);

const estado = {
  metodos: [],
  metodo: null,
  resultado: null,
  // Cada peticion se sella con el valor de este contador. Si al volver la
  // respuesta el contador cambio, el usuario ya pidio otra cosa y lo que
  // llego corresponde a una pregunta que nadie esta haciendo: se descarta.
  corrida: 0,
  // Parametros de la ultima resolucion exitosa: de ahi salen las asas del plano.
  params: null,
  // Arrastre de un asa en curso (ver alArrastrar) o null.
  arrastre: null,
  // Ultimo metodo marcado en cada familia, para volver a el al regresar.
  ultimoPorFamilia: {},
};

// Nombre e icono de cada familia. `otros` recoge una familia que esta tabla
// no conozca: un metodo nuevo aparece igual, solo que sin color propio.
const FAMILIAS = {
  raices: { nombre: "Raíces", icono: "target" },
  interpolacion: { nombre: "Interpolación", icono: "chart-dots" },
  integracion: { nombre: "Integración", icono: "chart-area-line" },
  edo: { nombre: "EDO", icono: "wave-sine" },
  otros: { nombre: "Otros", icono: "funcion" },
};

const familiaDe = (metodo) => (metodo.family in FAMILIAS ? metodo.family : "otros");

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
  metodos: () => pedir("api/methods"),
  resolver: (slug, cuerpo) =>
    pedir(`api/methods/${slug}/solve`, { method: "POST", body: JSON.stringify(cuerpo) }),
  muestrear: (cuerpo) =>
    pedir("api/plot/sample", { method: "POST", body: JSON.stringify(cuerpo) }),
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
  alElegir: (k) => recorrido.ir(k),
  alArrastrar,
  alMuestrear: async (peticion) => {
    try {
      return await api.muestrear(peticion);
    } catch {
      // Un remuestreo fallido no puede tumbar la grafica que ya se ve.
      return null;
    }
  },
});

// Rotulo del recorrido segun lo que es una fila en cada metodo.
function nombrePaso(metodo) {
  if (metodo.family === "raices") return "iteración";
  if (metodo.family === "edo") return "paso";
  return metodo.slug === "punto-medio" ? "subintervalo" : "punto";
}

// La tabla, la franja y la formula sustituida muestran la fila k (null:
// ninguna). `desplazar`: la tabla sigue la fila con la pagina, solo cuando el
// usuario movio el paso.
function mostrarFila(k, desplazar = false) {
  marcarFila($("#tabla"), k, desplazar);
  dibujarFilaActual($("#fila-actual"), estado.resultado, k, Number($("#decimales").value));
  mostrarSustitucion(k);
}

// Bajo la formula general, la misma con los numeros de la fila k.
function mostrarSustitucion(k) {
  const caja = $("#formula-datos");
  const resultado = estado.resultado;
  const decimales = Number($("#decimales").value);
  const sustitucion = resultado && k !== null
    ? sustitucionPara(estado.metodo.slug, resultado.iterations, k, resultado,
      (v) => formatear(v, decimales))
    : null;
  if (sustitucion === null) {
    caja.innerHTML = "";
  } else {
    const paso = nombrePaso(estado.metodo);
    caja.innerHTML = `<p class="campo-ayuda">En ${paso === "iteración" ? "la" : "el"} ${paso} `
      + `${resultado.iterations[k].n}:</p>${sustitucion}`;
  }
  caja.hidden = sustitucion === null;
}

// Cada vez que cambia la fila k (null: no hay recorrido) se enteran el plano,
// la tabla, la franja y la formula sustituida. `porUsuario` es false al cargar un resultado: ahi la
// animacion de entrada del plano tiene que seguir.
let terminoVigente = 0;
function alCambiar(k, porUsuario) {
  terminoVigente += 1;
  if (porUsuario) plano.cortarAnimacion();
  plano.marcarPaso(k);
  mostrarFila(k, porUsuario);
  pedirTermino(k);
}

const recorrido = montarRecorrido({ raiz: $("#recorrido"), alCambiar, tabla: $("#tabla") });

// En Lagrange el plano muestra tambien el termino f(x_i) L_i(x) de la fila k.
// Lo muestrea el nucleo (la interfaz no evalua nada); una respuesta tardia, de
// otra fila o de otra corrida, se descarta.
async function pedirTermino(k) {
  const resultado = estado.resultado;
  const expresion = resultado?.iterations?.[k]?.values?.termino;
  if (estado.metodo?.slug !== "interpolacion-lagrange" || typeof expresion !== "string") {
    // Solo repinta si hay un termino que quitar: cada paso ya repinta una vez.
    if (plano.termino) plano.ponerTermino(null);
    return;
  }
  const { x } = resultado.plot.series.curve;
  const marca = terminoVigente;
  const corrida = estado.corrida;
  let muestra = null;
  try {
    muestra = await api.muestrear({
      expression: expresion, variables: ["x"], x_min: x[0], x_max: x.at(-1), points: 200,
    });
  } catch { /* sin el termino la grafica sigue siendo valida */ }
  if (marca !== terminoVigente || corrida !== estado.corrida) return;
  plano.ponerTermino(muestra && {
    tipo: "curva", nombre: "término", color: "--iteraciones", xs: muestra.x, ys: muestra.y,
  });
}

function limpiarPantalla() {
  cancelarArrastre();
  recorrido.ocultar();
  $("#fila-actual").innerHTML = "";
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
  mostrarFormula();
  limpiarPantalla();
  avisar("");
}

// La vista previa con el simbolo ∫ solo tiene sentido para los metodos de
// integracion: se muestra encima del formulario de la regla elegida y se oculta
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


// La formula se muestra en cuanto se elige el metodo, antes de resolver. Si
// depende de un campo (el orden de Runge-Kutta), se lee lo que esta escrito.
function mostrarFormula() {
  const formula = estado.metodo
    ? formulaPara(estado.metodo.slug,
      (campo) => $(`#formulario #campo-${campo}`)?.value.trim() ?? "")
    : null;
  $("#formula").innerHTML = formula ?? "";
  $("#tarjeta-formula").hidden = !formula;
}

$("#formulario").addEventListener("input", mostrarFormula);

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
    mostrarFormula();
    $("#preset-descripcion").textContent = "";
    return;
  }

  // Un ejercicio cargado reemplaza los datos Y la configuracion de calculo:
  // media carga (los datos nuevos con la precision vieja) da una tabla que no
  // es la del ejercicio ni la de nadie.
  formulario.dibujar(estado.metodo, preset.params);
  mostrarVistaIntegral();
  mostrarFormula();
  $("#decimales").value = preset.config.decimals;
  $("#decimales-valor").textContent = preset.config.decimals;
  $("#iteraciones").value = preset.config.max_iterations;
  $("#tolerancia").value = preset.config.tolerance;
  $("#criterio").value = preset.config.error_criterion;
  $("#parar").checked = preset.config.stop_on_tolerance;

  $("#preset-descripcion").textContent =
    `${preset.descripcion} Fuente: ${preset.fuente}.`;
  actualizarResumenAjustes();

  estado.resultado = null;
  estado.corrida += 1;
  limpiarPantalla();
  avisar("");
}

async function resolver() {
  cancelarArrastre();
  avisar("");
  // La reproduccion vieja no sigue mientras llega el resultado nuevo.
  recorrido.pausar();
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
    estado.params = params;
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
    estado.params = null;
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

// `conservarVista`: el resultado de un dato arrastrado, sobre la vista que ya
// se esta mirando (sin reencuadrar ni animar).
function pintarResultado({ conservarVista = false } = {}) {
  formatearResultado();
  const { capas, resample } = capasDesdePlot(estado.resultado.plot, estado.resultado.iterations);
  plano.mostrar(capas, resample, {}, { conservarVista });
  plano.ponerAsas(asasDe(estado.metodo, estado.params, estado.resultado));
  $("#leyenda").innerHTML = "";
  for (const capa of plano.capas) {
    if (!capa.nombre) continue;
    const item = document.createElement("span");
    item.className = "leyenda-item";
    item.innerHTML =
      `<i style="background:var(${capa.color})"></i>${capa.nombre}`;
    $("#leyenda").append(item);
  }
  // Despues de mostrar: mostrar() suelta el paso y cargar() lo vuelve a poner.
  recorrido.cargar(estado.resultado.iterations, nombrePaso(estado.metodo));
}

// Los datos llegan sin redondear: la precision solo cambia como se escriben.
function formatearResultado() {
  const decimales = Number($("#decimales").value);
  dibujarResumen($("#resumen"), estado.resultado, decimales, estado.metodo.family);
  dibujarTabla($("#tabla"), estado.resultado, decimales);
}

// ------------------------------------------------------------ arrastre

// Un dato arrastrado en el plano se vuelve a resolver en vivo, con freno: una
// peticion en vuelo como mucho y una cada FRENO_MS. Mientras tanto solo se
// rehacen el plano y el resumen; tabla, franja y recorrido esperan a soltar.
const FRENO_MS = 100;

function alArrastrar(id, x, y, soltado) {
  if (!estado.metodo || !estado.params) return;
  if (!estado.arrastre) {
    recorrido.pausar();
    recorrido.deshabilitar(true);
    // Lo que la persona ve en el formulario, aunque haya cambiado otro campo
    // sin resolver; si no se puede leer, lo ultimo que se resolvio.
    let actuales;
    try {
      actuales = formulario.valores();
    } catch {
      actuales = estado.params;
    }
    estado.arrastre = {
      actuales, validos: estado.params, enVuelo: false, pendiente: null,
      ultimoEnvio: -Infinity, soltado: false, temporizador: null,
    };
  }
  const arrastre = estado.arrastre;
  arrastre.id = id;
  arrastre.actuales = mover(estado.metodo, arrastre.actuales, id, x, y);
  const campo = campoDe(id);
  formulario.poner(campo, arrastre.actuales[campo]);
  if (campo === "y0") formulario.poner("x0", arrastre.actuales.x0);
  plano.ponerAsas(asasDe(estado.metodo, arrastre.actuales, estado.resultado));
  arrastre.soltado = soltado;
  arrastre.pendiente = arrastre.actuales;
  avanzarArrastre();
}

const mismos = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Manda lo pendiente si no hay nada en vuelo y el freno lo deja.
function avanzarArrastre() {
  const arrastre = estado.arrastre;
  if (!arrastre || arrastre.enVuelo || !arrastre.pendiente) return;
  // Soltar donde ya se resolvio no vuelve a pedir: se pinta lo que hay.
  if (arrastre.soltado && mismos(arrastre.pendiente, arrastre.validos)) {
    terminarArrastre();
    return;
  }
  const espera = arrastre.ultimoEnvio + FRENO_MS - performance.now();
  clearTimeout(arrastre.temporizador);
  if (espera > 0) {
    arrastre.temporizador = setTimeout(avanzarArrastre, espera);
    return;
  }
  const params = arrastre.pendiente;
  arrastre.pendiente = null;
  enviarArrastre(arrastre, params, arrastre.soltado);
}

async function enviarArrastre(arrastre, params, final) {
  arrastre.enVuelo = true;
  arrastre.ultimoEnvio = performance.now();
  const corrida = ++estado.corrida;
  let resultado = null;
  let error = null;
  try {
    resultado = await api.resolver(estado.metodo.slug, { params, ...configuracion() });
  } catch (e) {
    error = e;
  }
  // Resolver, cambiar de metodo o comparar cancelaron el arrastre.
  if (corrida !== estado.corrida || estado.arrastre !== arrastre) return;
  arrastre.enVuelo = false;
  if (resultado) {
    estado.resultado = resultado;
    arrastre.validos = params;
    if (final) {
      terminarArrastre();
      return;
    }
    avisoArrastre("");
    pintarEnVivo();
  } else if (final) {
    volverAlValido(arrastre, params, error);
    return;
  } else {
    // El nucleo no acepta este valor: lo ultimo valido queda tenue, el asa
    // sigue al puntero y el motivo se ve sin anunciarse en cada movimiento.
    avisoArrastre(error.message);
  }
  avanzarArrastre();
}

function pintarEnVivo() {
  const { capas, resample } = capasDesdePlot(estado.resultado.plot, estado.resultado.iterations);
  plano.mostrar(capas, resample, {}, { conservarVista: true });
  dibujarResumen($("#resumen"), estado.resultado, Number($("#decimales").value), estado.metodo.family);
}

// Mensaje del nucleo mientras se arrastra ("" lo quita). #aviso-arrastre no
// es una region viva: el definitivo va una sola vez a #aviso al soltar.
function avisoArrastre(mensaje) {
  $("#aviso-arrastre").textContent = mensaje;
  $("#aviso-arrastre").hidden = !mensaje;
  if (plano.atenuado !== Boolean(mensaje)) plano.atenuar(Boolean(mensaje));
}

// Soltar en un valor que el nucleo rechaza devuelve el dato al ultimo valido:
// sin dibujo no quedarian asas para corregirlo arrastrando.
function volverAlValido(arrastre, intentados, error) {
  const { validos, id } = arrastre;
  const asa = (params) => asasDe(estado.metodo, params, estado.resultado).asas.find((a) => a.id === id);
  const campo = campoDe(id);
  formulario.poner(campo, validos[campo]);
  if (campo === "y0") formulario.poner("x0", validos.x0);
  const mensaje = `Con ${describir(asa(intentados))} no se pudo resolver: `
    + `${error.message.replace(/\.$/, "")}. Se volvió a ${describir(asa(validos))}.`;
  terminarArrastre();
  avisar(mensaje);
}

// Al soltar: el ultimo resultado valido se pinta completo y el recorrido vuelve.
function terminarArrastre() {
  const { validos } = estado.arrastre;
  cancelarArrastre();
  estado.params = validos;
  pintarResultado({ conservarVista: true });
}

// Resolver, cambiar de metodo, limpiar o comparar cortan un arrastre en curso:
// una respuesta que llegue despues ya es de otra corrida y se descarta.
function cancelarArrastre() {
  const arrastre = estado.arrastre;
  if (!arrastre) return;
  clearTimeout(arrastre.temporizador);
  estado.arrastre = null;
  avisoArrastre("");
  recorrido.deshabilitar(false);
}

// ------------------------------------------------------------ familias y chips

// Radio nativo dentro de su etiqueta: las flechas y el lector de pantalla
// funcionan sin codigo propio. Lo que se ve es `.cara`, el hermano del radio.
function opcion(grupo, valor, texto, familia, icono) {
  const label = document.createElement("label");
  label.className = grupo === "familia" ? "familia" : "chip";
  label.dataset.familia = familia;
  const input = document.createElement("input");
  input.type = "radio";
  input.name = grupo;
  input.value = valor;
  input.dataset.familia = familia;
  const cara = document.createElement("span");
  cara.className = "cara";
  if (icono) {
    const dibujo = document.createElement("span");
    dibujo.dataset.icono = icono;
    cara.append(dibujo);
  }
  const nombre = document.createElement("span");
  nombre.textContent = texto;
  cara.append(nombre);
  label.append(input, cara);
  return label;
}

// Las familias salen en el orden de su primer metodo: la API ya los da
// ordenados por `orden`.
function armarSelector(metodos) {
  const familias = $("#familia");
  const chips = $("#metodo");
  familias.innerHTML = "";
  chips.innerHTML = "";
  for (const m of metodos) {
    const familia = familiaDe(m);
    if (!familias.querySelector(`input[value="${familia}"]`)) {
      const { nombre, icono } = FAMILIAS[familia];
      familias.append(opcion("familia", familia, nombre, familia, icono));
    }
    chips.append(opcion("metodo", m.slug, m.name, familia));
  }
  pintarIconos(familias);
  familias.addEventListener("change", (e) => elegirFamilia(e.target.value));
  chips.addEventListener("change", (e) => marcarMetodo(e.target.value));
}

function elegirFamilia(familia) {
  marcarMetodo(
    estado.ultimoPorFamilia[familia]
      ?? $(`#metodo input[data-familia="${familia}"]`).value,
  );
}

function marcarMetodo(slug) {
  const chip = [...document.querySelectorAll("#metodo input")].find((i) => i.value === slug);
  if (!chip) return;
  const familia = chip.dataset.familia;
  chip.checked = true;
  $(`#familia input[value="${familia}"]`).checked = true;
  for (const label of $("#metodo").children) {
    label.hidden = label.dataset.familia !== familia;
  }
  estado.ultimoPorFamilia[familia] = slug;
  document.body.dataset.familia = familia;
  seleccionarMetodo(slug);
}

async function iniciar() {
  try {
    estado.metodos = await api.metodos();
  } catch (e) {
    avisar(`No se pudo cargar la lista de metodos: ${e.message}`);
    return;
  }

  armarSelector(estado.metodos);
  if (estado.metodos.length) marcarMetodo(estado.metodos[0].slug);

  montarComparador({ api, estado, plano, configuracion, formulario, recorrido, cancelarArrastre });
}

// ------------------------------------------------------------ ajustes

const CRITERIO_CORTO = {
  relativo_porcentual: "relativo %",
  relativo: "relativo",
  absoluto: "absoluto",
};

// Los ajustes van plegados; este renglon dice lo vigente sin abrirlos. La
// tolerancia va tal como esta escrita: es lo que la persona tecleo.
function actualizarResumenAjustes() {
  const partes = [
    `tol ${$("#tolerancia").value}`,
    `máx ${$("#iteraciones").value}`,
    CRITERIO_CORTO[$("#criterio").value] ?? $("#criterio").value,
  ];
  if (!$("#parar").checked) partes.push("sin parar");
  $("#ajustes-resumen").textContent = partes.join(" · ");
}

for (const id of ["iteraciones", "tolerancia", "criterio", "parar"]) {
  $(`#${id}`).addEventListener("input", actualizarResumenAjustes);
  $(`#${id}`).addEventListener("change", actualizarResumenAjustes);
}
actualizarResumenAjustes();

// ------------------------------------------------------------ tema e iconos

function pintarIconos(raiz = document) {
  for (const el of raiz.querySelectorAll("[data-icono]")) {
    el.innerHTML = ICONOS[el.dataset.icono] ?? "";
  }
}

const sistemaOscuro = window.matchMedia("(prefers-color-scheme: dark)");

function temaEfectivo() {
  return document.documentElement.dataset.tema
    ?? (sistemaOscuro.matches ? "oscuro" : "claro");
}

// El boton ofrece el tema contrario al que se ve.
function rotularTema() {
  const destino = temaEfectivo() === "oscuro" ? "claro" : "oscuro";
  const boton = $("#tema");
  boton.setAttribute("aria-label", `Cambiar a tema ${destino}`);
  boton.querySelector("[data-icono]").dataset.icono = destino === "oscuro" ? "moon" : "sun";
  pintarIconos(boton);
}

function alternarTema() {
  const nuevo = temaEfectivo() === "oscuro" ? "claro" : "oscuro";
  document.documentElement.dataset.tema = nuevo;
  try {
    localStorage.setItem("tema", nuevo);
  } catch { /* almacenamiento bloqueado: el tema vale solo para esta visita */ }
  rotularTema();
  plano.repintar();
}

$("#tema").addEventListener("click", alternarTema);
sistemaOscuro.addEventListener("change", () => {
  rotularTema();
  plano.repintar();
});
pintarIconos();
rotularTema();

// Cambiar la precision solo re-formatea: no se vuelve a pedir nada.
$("#decimales").addEventListener("input", () => {
  $("#decimales-valor").textContent = $("#decimales").value;
  if (!estado.resultado) return;
  formatearResultado();
  // El recorrido sigue donde estaba: se reescriben la tabla, la franja y la sustitucion.
  if (recorrido.activo) mostrarFila(recorrido.k);
});

// Un clic en una fila de la tabla lleva el recorrido a esa fila.
$("#tabla").addEventListener("click", (e) => {
  const fila = e.target.closest("tr[data-indice]");
  if (fila && recorrido.disponible) recorrido.ir(Number(fila.dataset.indice));
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
        `api/methods/${estado.metodo.slug}/export/${formato}`,
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

// Para las pruebas de interfaz, que necesitan llegar al plano y al recorrido.
export { plano, recorrido };
