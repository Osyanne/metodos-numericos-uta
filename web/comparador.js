// Comparador: el mismo problema resuelto con varios metodos a la vez.
//
// Es lo que mas separa este aplicativo de una calculadora. El caso obvio es
// Newton-Raphson contra Von Mises: misma f(x), mismo x0, y se ve para que
// sirve congelar la derivada y lo que cuesta.

import { formatear } from "./tabla.js";

const $ = (sel) => document.querySelector(sel);

// Dos metodos son comparables si piden exactamente los mismos campos.
function comparables(metodos, metodo) {
  const firma = (m) => m.inputs.map((c) => `${c.name}:${c.kind}`).sort().join("|");
  const mia = firma(metodo);
  return metodos.filter((m) => firma(m) === mia);
}

export function montarComparador({ api, estado, plano, configuracion, formulario }) {
  const boton = $("#comparar");
  const caja = $("#comparacion");

  boton.addEventListener("click", async () => {
    caja.innerHTML = "";
    const rivales = comparables(estado.metodos, estado.metodo);
    if (rivales.length < 2) {
      caja.innerHTML =
        `<p class="vacio">No hay otro metodo que reciba los mismos datos que ` +
        `${estado.metodo.name}, asi que no hay nada con que compararlo.</p>`;
      return;
    }

    let params;
    try {
      params = formulario.valores();
    } catch (e) {
      caja.innerHTML = `<p class="vacio">${e.message}</p>`;
      return;
    }

    boton.disabled = true;
    const cuerpo = { params, ...configuracion() };
    const corridas = [];

    for (const metodo of rivales) {
      try {
        const r = await api.resolver(metodo.slug, cuerpo);
        corridas.push({ metodo, resultado: r });
      } catch (e) {
        corridas.push({ metodo, error: e.message });
      }
    }
    boton.disabled = false;

    dibujarComparacion(caja, corridas, Number($("#decimales").value));
    superponerConvergencia(plano, corridas);
  });
}

function dibujarComparacion(caja, corridas, decimales) {
  const tabla = document.createElement("table");
  tabla.className = "iteraciones";
  tabla.innerHTML =
    "<thead><tr><th>metodo</th><th>iteraciones</th><th>resultado</th>" +
    "<th>error final</th><th>estado</th></tr></thead>";
  const tbody = document.createElement("tbody");

  for (const { metodo, resultado, error } of corridas) {
    const tr = document.createElement("tr");
    const celda = (texto, clase) => {
      const td = document.createElement("td");
      td.textContent = texto;
      if (clase) td.className = clase;
      tr.append(td);
    };

    celda(metodo.name);
    if (error) {
      const td = document.createElement("td");
      td.colSpan = 4;
      td.className = "col-error";
      td.textContent = error;
      tr.append(td);
    } else {
      const ultima = resultado.iterations.at(-1);
      const principal = Object.values(resultado.result ?? {})[0];
      celda(resultado.iterations.length, "col-n");
      celda(typeof principal === "number" ? formatear(principal, decimales) : String(principal ?? "—"));
      celda(formatear(ultima?.error, decimales), "col-error");
      celda(resultado.converged ? "convergio" : resultado.stop_reason);
    }
    tbody.append(tr);
  }

  tabla.append(tbody);
  caja.append(tabla);

  const nota = document.createElement("p");
  nota.className = "campo-ayuda";
  nota.textContent =
    "Menos iteraciones no siempre es mejor: un metodo puede converger rapido " +
    "en un punto y romperse en otro. El plano muestra como baja el error de cada uno.";
  caja.append(nota);
}

// Curva de convergencia de cada metodo sobre el mismo plano: iteracion contra
// error. Son puntos discretos, asi que no se remuestrea al hacer zoom.
function superponerConvergencia(plano, corridas) {
  const capas = [];
  for (const { metodo, resultado } of corridas) {
    if (!resultado) continue;
    const xs = [];
    const ys = [];
    for (const it of resultado.iterations) {
      if (it.error === null || it.error === undefined) continue;
      xs.push(it.n);
      ys.push(it.error);
    }
    if (xs.length) capas.push({ tipo: "curva", nombre: metodo.name, xs, ys });
  }
  if (capas.length) {
    plano.mostrar(capas, null, { x: "iteracion", y: "error" });
    const leyenda = $("#leyenda");
    leyenda.innerHTML = "";
    for (const capa of plano.capas) {
      const item = document.createElement("span");
      item.className = "leyenda-item";
      item.innerHTML = `<i style="background:${capa.color}"></i>${capa.nombre}`;
      leyenda.append(item);
    }
  }
}
