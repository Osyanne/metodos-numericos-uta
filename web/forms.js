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

  dibujar(metodo) {
    this.contenedor.innerHTML = "";
    this.campos = [];
    for (const campo of metodo.inputs) {
      const control = crearControl(campo);
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
  div.append(etiquetaDe(campo), control);
  if (campo.help) {
    const ayuda = document.createElement("p");
    ayuda.className = "campo-ayuda";
    ayuda.textContent = campo.help;
    div.append(ayuda);
  }
  return div;
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
      const bruto = input.value.trim();
      if (bruto === "") return null;
      if (campo.kind === "expression") return bruto;
      const n = Number(bruto);
      if (Number.isNaN(n)) throw new Error(`${campo.label} tiene que ser un numero.`);
      return campo.kind === "integer" ? Math.round(n) : n;
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
      const quitar = fila.querySelector(".boton-quitar");
      const sobra = todas.length > 1;
      quitar.style.visibility = sobra ? "visible" : "hidden";
      quitar.disabled = !sobra;
    });
  };

  agregar.addEventListener("click", () => nuevaFila());
  nuevaFila(campo.default ?? "");
  caja.append(filas, agregar);

  return {
    definicion: campo,
    elemento: envoltorio(campo, caja),
    leer() {
      const valores = [...filas.querySelectorAll("input")]
        .map((i) => i.value.trim())
        .filter((v) => v !== "");
      if (!valores.length) return null;
      const convertir = (v) => {
        if (campo.kind === "expression") return v;
        const n = Number(v);
        if (Number.isNaN(n)) throw new Error(`${campo.label}: '${v}' no es un numero.`);
        return campo.kind === "integer" ? Math.round(n) : n;
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
      return bruto.split(/[,\s]+/).filter(Boolean).map((v) => {
        const n = Number(v);
        if (Number.isNaN(n)) throw new Error(`${campo.label}: '${v}' no es un numero.`);
        return n;
      });
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
    quitar.addEventListener("click", () => tr.remove());
    td.append(quitar);
    tr.append(td);
    cuerpo.append(tr);
  };

  const agregar = document.createElement("button");
  agregar.type = "button";
  agregar.className = "boton-tenue boton-agregar";
  agregar.textContent = "+ punto";
  agregar.addEventListener("click", () => nuevaFila());

  const iniciales = Array.isArray(campo.default) && campo.default.length
    ? campo.default
    : [[1, 0], [4, 1.386294], [6, 1.791759]];
  for (const [x, y] of iniciales) nuevaFila(x, y);

  caja.append(tabla, agregar);

  return {
    definicion: campo,
    elemento: envoltorio(campo, caja),
    leer() {
      const puntos = [];
      for (const tr of cuerpo.children) {
        const [ex, ey] = tr.querySelectorAll("input");
        if (ex.value.trim() === "" && ey.value.trim() === "") continue;
        const x = Number(ex.value);
        const y = Number(ey.value);
        if (Number.isNaN(x) || Number.isNaN(y)) {
          throw new Error("Hay un punto con un valor que no es numero.");
        }
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
        linea.trim().split(/[,\s]+/).filter(Boolean).map((v) => {
          const n = Number(v);
          if (Number.isNaN(n)) throw new Error(`En la matriz, '${v}' no es un numero.`);
          return n;
        }),
      );
      const ancho = filas[0].length;
      if (filas.some((f) => f.length !== ancho)) {
        throw new Error("Todas las filas de la matriz tienen que tener el mismo largo.");
      }
      return filas;
    },
  };
}
