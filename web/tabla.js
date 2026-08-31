// Tabla de iteraciones. El docente la pide completa, no solo el resultado.
//
// La tabla se dibuja recorriendo `columns` y buscando cada `key` en `values`,
// asi que un metodo nuevo trae sus propias columnas sin tocar este archivo.
//
// `decimals` es formato: los datos llegan sin redondear y se redondean aca, al
// mostrar. Cambiar la precision no vuelve a pedir nada al servidor.

export function formatear(valor, decimales) {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "—";
  return valor.toFixed(decimales);
}

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
  for (const it of resultado.iterations) {
    const tr = document.createElement("tr");

    const tdN = document.createElement("td");
    tdN.className = "col-n";
    tdN.textContent = it.n;
    tr.append(tdN);

    for (const columna of resultado.columns) {
      const td = document.createElement("td");
      const valor = it.values[columna.key];
      td.textContent = columna.numeric === false
        ? (valor ?? "—")
        : formatear(valor, decimales);
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

// Claves que son conteos o etiquetas, no mediciones: mostrarlas con seis
// decimales ("iteraciones 4.000000") es ruido y sugiere una precision que no
// tienen.
const CONTEOS = new Set(["iteraciones", "grado", "n", "orden", "pasos", "puntos"]);

const MOTIVO = {
  tolerancia_alcanzada: ["ok", "Alcanzó la tolerancia"],
  n_iteraciones_completadas: ["aviso", "Completó las n iteraciones sin alcanzar la tolerancia"],
  solucion_exacta: ["ok", "Solución exacta"],
  divergio: ["mal", "El método diverge"],
  fallo: ["mal", "Falló"],
};

export function dibujarResumen(contenedor, resultado, decimales) {
  contenedor.innerHTML = "";
  if (!resultado) return;

  const [clase, texto] = MOTIVO[resultado.stop_reason] ?? ["aviso", resultado.stop_reason];
  const estado = document.createElement("div");
  estado.className = `estado estado-${clase}`;
  estado.textContent = texto;
  contenedor.append(estado);

  const lista = document.createElement("dl");
  lista.className = "resultado";
  for (const [clave, valor] of Object.entries(resultado.result ?? {})) {
    const dt = document.createElement("dt");
    dt.textContent = clave;
    const dd = document.createElement("dd");
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
