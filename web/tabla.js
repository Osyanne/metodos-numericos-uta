// Tabla de iteraciones. El docente la pide completa, no solo el resultado.
//
// La tabla se dibuja recorriendo `columns` y buscando cada `key` en `values`,
// asi que un metodo nuevo trae sus propias columnas sin tocar este archivo.
//
// `decimals` es formato: los datos llegan sin redondear y se redondean aca, al
// mostrar. Cambiar la precision no vuelve a pedir nada al servidor.

import { ICONOS } from "./iconos.js";

export function formatear(valor, decimales) {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "—";
  return valor.toFixed(decimales);
}

// Texto de una columna de la fila: las de texto tal cual, las numericas
// redondeadas al mostrar. La usan la tabla y la franja de la fila actual.
const textoDe = (columna, it, decimales) => {
  const valor = it.values[columna.key];
  return columna.numeric === false ? (valor ?? "—") : formatear(valor, decimales);
};

export function dibujarTabla(contenedor, resultado, decimales) {
  contenedor.innerHTML = "";
  if (!resultado?.iterations?.length) {
    contenedor.innerHTML = '<p class="vacio">Sin iteraciones que mostrar.</p>';
    return;
  }

  const tabla = document.createElement("table");
  tabla.className = "iteraciones";

  const thead = document.createElement("thead");
  const filaCab = document.createElement("tr");
  for (const texto of ["i", ...resultado.columns.map((c) => c.label), "error"]) {
    const th = document.createElement("th");
    th.textContent = texto;
    filaCab.append(th);
  }
  thead.append(filaCab);

  const tbody = document.createElement("tbody");
  for (const [indice, it] of resultado.iterations.entries()) {
    const tr = document.createElement("tr");
    // Posicion de la fila: con ella un clic le dice al recorrido a donde ir.
    tr.dataset.indice = indice;

    const tdN = document.createElement("td");
    tdN.className = "col-n";
    tdN.textContent = it.n;
    tr.append(tdN);

    for (const columna of resultado.columns) {
      const td = document.createElement("td");
      td.textContent = textoDe(columna, it, decimales);
      tr.append(td);
    }

    const tdErr = document.createElement("td");
    tdErr.className = "col-error";
    tdErr.textContent = formatear(it.error, decimales);
    tr.append(tdErr);

    tbody.append(tr);
  }

  tabla.append(thead, tbody);
  contenedor.append(tabla);
}

// Resalta la fila k del recorrido (null: ninguna) y la trae a la vista. Si la
// pestana de la tabla esta cerrada la fila no tiene caja y no hay nada que mover.
export function marcarFila(contenedor, k) {
  for (const tr of contenedor.querySelectorAll("tr.actual")) {
    tr.classList.remove("actual");
    tr.removeAttribute("aria-current");
  }
  const tr = k === null ? null : contenedor.querySelector(`tr[data-indice="${k}"]`);
  if (!tr) return;
  tr.classList.add("actual");
  tr.setAttribute("aria-current", "true");
  tr.scrollIntoView({ block: "nearest" });
}

// La fila k como pares columna/valor, con los mismos numeros y decimales que la
// tabla. Va debajo del plano para leer la fila sin abrir la pestana.
export function dibujarFilaActual(contenedor, resultado, k, decimales) {
  contenedor.innerHTML = "";
  const it = resultado?.iterations?.[k];
  if (!it) return;
  const lista = document.createElement("dl");
  const pares = [
    ["i", it.n],
    ...resultado.columns.map((c) => [c.label, textoDe(c, it, decimales)]),
    ["error", formatear(it.error, decimales)],
  ];
  for (const [etiqueta, valor] of pares) {
    const dt = document.createElement("dt");
    dt.textContent = etiqueta;
    const dd = document.createElement("dd");
    dd.textContent = valor;
    lista.append(dt, dd);
  }
  contenedor.append(lista);
}

// Claves que son conteos o etiquetas, no mediciones: mostrarlas con seis
// decimales ("iteraciones 4.000000") es ruido y sugiere una precision que no
// tienen.
const CONTEOS = new Set([
  "iteraciones", "grado", "n", "orden", "pasos", "puntos", "subintervalos",
]);

const MOTIVO = {
  tolerancia_alcanzada: ["ok", "Alcanzó la tolerancia"],
  n_iteraciones_completadas: ["aviso", "Completó las n iteraciones sin alcanzar la tolerancia"],
  solucion_exacta: ["ok", "Solución exacta"],
  // Un metodo de malla fija termina cuando recorre sus n pasos. Eso es el final
  // normal, en verde: no persigue ninguna tolerancia que pudiera no alcanzar.
  integracion_completada: ["ok", "Integración completada"],
  divergio: ["mal", "El método diverge"],
  fallo: ["mal", "Falló"],
};

// El numero que la persona vino a buscar, segun la familia del metodo. Va
// primero y en grande; el resto del resumen queda chico al lado.
export const PRINCIPAL = {
  raices: "raiz",
  interpolacion: "polinomio",
  integracion: "integral",
  edo: "y",
};

export function dibujarResumen(contenedor, resultado, decimales, familia) {
  contenedor.innerHTML = "";
  if (!resultado) return;

  const [clase, texto] = MOTIVO[resultado.stop_reason] ?? ["aviso", resultado.stop_reason];
  const estado = document.createElement("div");
  estado.className = `estado estado-${clase}`;
  estado.textContent = texto;
  if (clase === "ok") estado.insertAdjacentHTML("afterbegin", ICONOS["circle-check"]);
  contenedor.append(estado);

  // Sin clave principal (familia desconocida), manda la primera.
  const pares = Object.entries(resultado.result ?? {});
  const indice = Math.max(0, pares.findIndex(([clave]) => clave === PRINCIPAL[familia]));
  pares.unshift(...pares.splice(indice, 1));

  const lista = document.createElement("dl");
  lista.className = "resultado";
  for (const [i, [clave, valor]] of pares.entries()) {
    const dt = document.createElement("dt");
    dt.textContent = clave;
    const dd = document.createElement("dd");
    if (i === 0) dt.className = dd.className = "principal";
    dd.textContent = typeof valor === "number"
      ? (CONTEOS.has(clave) ? String(valor) : formatear(valor, decimales))
      : Array.isArray(valor)
        ? valor.map((v) => formatear(v, decimales)).join(", ")
        : String(valor ?? "—");
    lista.append(dt, dd);
  }
  contenedor.append(lista);

  if (resultado.notes?.length) {
    const notas = document.createElement("ul");
    notas.className = "notas";
    for (const nota of resultado.notes) {
      const li = document.createElement("li");
      li.textContent = nota;
      notas.append(li);
    }
    contenedor.append(notas);
  }
}
