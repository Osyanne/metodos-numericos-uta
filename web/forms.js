// Formulario generico: se dibuja a partir de los `inputs` que declara cada
// metodo, sin saber cual es. Agregar el metodo numero cinco no obliga a tocar
// este archivo, que es el requisito de expansion que pidio el docente.

const ETIQUETA_TIPO = {
  expression: "expresion",
  number: "numero",
  integer: "entero",
  points: "tabla de puntos",
  matrix: "matriz",
  vector: "vector",
};

export class Formulario {
  constructor(contenedor) {
    this.contenedor = contenedor;
    this.campos = [];
  }

  dibujar(metodo, params) {
    this.contenedor.innerHTML = "";
    this.campos = [];
    for (const campo of metodo.inputs) {
      // Un ejercicio cargado reemplaza todos los datos, incluso opcionales
      // vacios. Nunca se conserva una derivada o una fila del ejercicio previo.
      const definicion = params === undefined ? campo : {
        ...campo,
        default: params[campo.name] ?? (campo.kind === "points" ? [] : null),
      };
      const control = crearControl(definicion);
      this.campos.push(control);
      this.contenedor.append(control.elemento);
    }
  }

  // Devuelve params tal como los espera el contrato. Los campos opcionales
  // vacios no se mandan, para que el metodo aplique su propio criterio.
  valores() {
    const params = {};
    for (const campo of this.campos) {
      const valor = campo.leer();
      if (valor === null || valor === undefined || valor === "") {
        if (campo.definicion.required) {
          throw new Error(`Falta ${campo.definicion.label}.`);
        }
        continue;
      }
      params[campo.definicion.name] = valor;
    }
    return params;
  }
}

function etiquetaDe(campo) {
  const label = document.createElement("label");
  label.className = "campo-etiqueta";
  label.textContent = campo.label;
  if (!campo.required) {
    const op = document.createElement("span");
    op.className = "campo-opcional";
    op.textContent = "opcional";
    label.append(op);
  }
  return label;
}

function envoltorio(campo, control) {
  const div = document.createElement("div");
  div.className = "campo";
  const etiqueta = etiquetaDe(campo);
  const id = `campo-${campo.name}`;
  if (control.matches("input, textarea, select")) {
    control.id = id;
    etiqueta.htmlFor = id;
  } else {
    etiqueta.id = `${id}-etiqueta`;
    control.setAttribute("role", "group");
    control.setAttribute("aria-labelledby", etiqueta.id);
  }
  div.append(etiqueta, control);
  if (campo.help) {
    const ayuda = document.createElement("p");
    ayuda.className = "campo-ayuda";
    ayuda.id = `${id}-ayuda`;
    ayuda.textContent = campo.help;
    control.setAttribute("aria-describedby", ayuda.id);
    div.append(ayuda);
  }
  return div;
}

function numero(bruto, etiqueta, entero = false) {
  const n = Number(bruto);
  if (!Number.isFinite(n)) {
    throw new Error(`${etiqueta} tiene que ser un numero finito.`);
  }
  if (entero && !Number.isInteger(n)) {
    throw new Error(`${etiqueta} tiene que ser un entero, sin decimales.`);
  }
  return n;
}

function leerTexto(input, etiqueta) {
  // Un input numerico invalido (p. ej. 1e309) puede exponerse como value="".
  // Su estado badInput lo distingue de un campo opcional que se dejo vacio.
  if (input.validity.badInput) {
    throw new Error(`${etiqueta} tiene que ser un numero finito.`);
  }
  return input.value.trim();
}

function crearControl(campo) {
  if (campo.kind === "points") return controlPuntos(campo);
  if (campo.kind === "matrix") return controlMatriz(campo);
  if (campo.multiple) return controlLista(campo);
  if (campo.kind === "vector") return controlVector(campo);
  return controlSimple(campo);
}

// ------------------------------------------------------------ simples

function controlSimple(campo) {
  const input = document.createElement("input");
  input.className = "control";
  input.type = campo.kind === "expression" ? "text" : "number";
  if (campo.kind === "number") input.step = "any";
  if (campo.kind === "expression") input.spellcheck = false;
  if (campo.default !== null && campo.default !== undefined) {
    input.value = campo.default;
  }
  input.placeholder = ETIQUETA_TIPO[campo.kind] ?? "";

  return {
    definicion: campo,
    elemento: envoltorio(campo, input),
    leer() {
      const bruto = leerTexto(input, campo.label);
      if (bruto === "") return null;
      if (campo.kind === "expression") return bruto;
      return numero(bruto, campo.label, campo.kind === "integer");
    },
  };
}

// ------------------------------------------------------------ listas
// Un campo con multiple acepta uno o varios valores. Lo necesita Runge-Kutta:
// una ecuacion o un sistema. Con un solo valor manda el escalar, no una lista
// de uno, porque es lo que espera el contrato.

function controlLista(campo) {
  const caja = document.createElement("div");
  caja.className = "lista";

  const filas = document.createElement("div");
  filas.className = "lista-filas";

  const agregar = document.createElement("button");
  agregar.type = "button";
  agregar.className = "boton-tenue boton-agregar";
  agregar.textContent = "+ agregar";
  agregar.setAttribute("aria-label", `Agregar valor a ${campo.label}`);

  const nuevaFila = (valor = "") => {
    const fila = document.createElement("div");
    fila.className = "lista-fila";

    const input = document.createElement("input");
    input.className = "control";
    input.type = campo.kind === "expression" ? "text" : "number";
    if (campo.kind === "number") input.step = "any";
    input.spellcheck = false;
    input.value = valor;

    const prefijo = document.createElement("span");
    prefijo.className = "lista-indice";

    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "boton-tenue boton-quitar";
    quitar.textContent = "×";
    quitar.title = "quitar";
    quitar.addEventListener("click", () => {
      fila.remove();
      renumerar();
    });

    fila.append(prefijo, input, quitar);
    filas.append(fila);
    renumerar();
  };

  // y1, y2... cuando hay mas de uno; nada cuando hay uno solo.
  const renumerar = () => {
    const todas = [...filas.children];
    todas.forEach((fila, i) => {
      const indice = fila.querySelector(".lista-indice");
      indice.textContent = todas.length > 1 ? `${i + 1}` : "";
      fila.querySelector("input").setAttribute("aria-label",
        todas.length > 1 ? `${campo.label}, valor ${i + 1}` : campo.label);
      const quitar = fila.querySelector(".boton-quitar");
      quitar.setAttribute("aria-label", `Quitar valor ${i + 1} de ${campo.label}`);
      const sobra = todas.length > 1;
      quitar.style.visibility = sobra ? "visible" : "hidden";
      quitar.disabled = !sobra;
    });
  };

  agregar.addEventListener("click", () => nuevaFila());
  const iniciales = Array.isArray(campo.default) ? campo.default : [campo.default ?? ""];
  for (const valor of iniciales.length ? iniciales : [""]) nuevaFila(valor);
  caja.append(filas, agregar);

  return {
    definicion: campo,
    elemento: envoltorio(campo, caja),
    leer() {
      const valores = [...filas.querySelectorAll("input")]
        .map((input, indice) => leerTexto(input, `${campo.label}, valor ${indice + 1}`));
      if (valores.every(valor => valor === "")) return null;
      const incompleta = valores.indexOf("");
      if (incompleta !== -1) {
        throw new Error(`${campo.label}: completa el valor de la fila ${incompleta + 1} o elimina esa fila.`);
      }
      const convertir = (v) => {
        if (campo.kind === "expression") return v;
        return numero(v, campo.label, campo.kind === "integer");
      };
      const lista = valores.map(convertir);
      return lista.length === 1 ? lista[0] : lista;
    },
  };
}

function controlVector(campo) {
  const input = document.createElement("input");
  input.className = "control";
  input.type = "text";
  input.spellcheck = false;
  input.placeholder = "1, 1, 1";
  if (Array.isArray(campo.default)) input.value = campo.default.join(", ");

  return {
    definicion: campo,
    elemento: envoltorio(campo, input),
    leer() {
      const bruto = input.value.trim();
      if (bruto === "") return null;
      return bruto.split(/[,\s]+/).filter(Boolean).map(v => numero(v, campo.label));
    },
  };
}

// ------------------------------------------------------------ tabla de puntos

function controlPuntos(campo) {
  const caja = document.createElement("div");
  caja.className = "puntos";

  const tabla = document.createElement("table");
  tabla.className = "puntos-tabla";
  tabla.innerHTML = "<thead><tr><th>x</th><th>y</th><th></th></tr></thead>";
  const cuerpo = document.createElement("tbody");
  tabla.append(cuerpo);

  const renumerar = () => {
    [...cuerpo.children].forEach((tr, indice) => {
      const [x, y] = tr.querySelectorAll("input");
      x.setAttribute("aria-label", `x del punto ${indice + 1}`);
      y.setAttribute("aria-label", `y del punto ${indice + 1}`);
      tr.querySelector("button").setAttribute("aria-label", `Quitar punto ${indice + 1}`);
    });
  };

  const nuevaFila = (x = "", y = "") => {
    const tr = document.createElement("tr");
    for (const valor of [x, y]) {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.className = "control control-mini";
      input.type = "number";
      input.step = "any";
      input.value = valor;
      td.append(input);
      tr.append(td);
    }
    const td = document.createElement("td");
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "boton-tenue boton-quitar";
    quitar.textContent = "×";
    quitar.addEventListener("click", () => {
      tr.remove();
      renumerar();
    });
    td.append(quitar);
    tr.append(td);
    cuerpo.append(tr);
    renumerar();
  };

  const agregar = document.createElement("button");
  agregar.type = "button";
  agregar.className = "boton-tenue boton-agregar";
  agregar.textContent = "+ punto";
  agregar.addEventListener("click", () => nuevaFila());

  const iniciales = Array.isArray(campo.default)
    ? campo.default
    : [[1, 0], [4, 1.386294], [6, 1.791759]];
  for (const [x, y] of iniciales) nuevaFila(x, y);

  caja.append(tabla, agregar);

  return {
    definicion: campo,
    elemento: envoltorio(campo, caja),
    leer() {
      const puntos = [];
      for (const [indice, tr] of [...cuerpo.children].entries()) {
        const [ex, ey] = tr.querySelectorAll("input");
        const xTexto = leerTexto(ex, `La x del punto ${indice + 1}`);
        const yTexto = leerTexto(ey, `La y del punto ${indice + 1}`);
        if (xTexto === "" && yTexto === "") continue;
        if (xTexto === "" || yTexto === "") {
          throw new Error(`El punto ${indice + 1} esta incompleto: escribe ambas coordenadas x e y, o elimina la fila.`);
        }
        const x = numero(xTexto, `La x del punto ${indice + 1}`);
        const y = numero(yTexto, `La y del punto ${indice + 1}`);
        puntos.push([x, y]);
      }
      return puntos.length ? puntos : null;
    },
  };
}

// ------------------------------------------------------------ matriz

function controlMatriz(campo) {
  const area = document.createElement("textarea");
  area.className = "control control-area";
  area.rows = 4;
  area.spellcheck = false;
  area.placeholder = "4 1 0\n1 3 1\n0 1 2";
  if (Array.isArray(campo.default)) {
    area.value = campo.default.map((f) => f.join(" ")).join("\n");
  }

  return {
    definicion: campo,
    elemento: envoltorio(campo, area),
    leer() {
      const bruto = area.value.trim();
      if (bruto === "") return null;
      const filas = bruto.split("\n").map((linea) =>
        linea.trim().split(/[,\s]+/).filter(Boolean).map(v => numero(v, campo.label)),
      );
      const ancho = filas[0].length;
      if (filas.some((f) => f.length !== ancho)) {
        throw new Error("Todas las filas de la matriz tienen que tener el mismo largo.");
      }
      return filas;
    },
  };
}
