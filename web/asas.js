// Datos del problema que se pueden tomar con el puntero en el plano: el x0 de
// las raices, los puntos y el x a evaluar de la interpolacion, los extremos de
// la integracion y la condicion inicial de una EDO.
//
// El plano solo dibuja asas y avisa cuando una se mueve; aca se decide que
// parametro es cada una. Se buscan los campos por nombre, asi un metodo nuevo
// de una familia conocida tiene asas sin tocar nada si usa los mismos nombres.

const SUBINDICES = "₀₁₂₃₄₅₆₇₈₉";
const subindice = (n) => String(n).replace(/\d/g, (d) => SUBINDICES[d]);
const finito = (v) => typeof v === "number" && Number.isFinite(v);
const tiene = (metodo, nombre) => (metodo.inputs ?? []).some((c) => c.name === nombre);

// Un asa de eje x vive sobre el eje: su y es 0 y el plano decide donde dibujarla.
const sobreEje = (id, x, etiqueta) => ({ id, x, y: 0, eje: "x", etiqueta });

const POR_FAMILIA = {
  raices: (metodo, p) =>
    (tiene(metodo, "x0") && finito(p.x0) ? [sobreEje("x0", p.x0, "x₀")] : []),

  interpolacion: (metodo, p) => [
    ...(tiene(metodo, "points") && Array.isArray(p.points) ? p.points : [])
      .flatMap(([x, y], i) => (finito(x) && finito(y)
        ? [{ id: `p:${i}`, x, y, eje: "xy", etiqueta: `P${subindice(i)}` }]
        : [])),
    ...(tiene(metodo, "x") && finito(p.x) ? [sobreEje("x", p.x, "x")] : []),
  ],

  integracion: (metodo, p) => ["a", "b"]
    .filter((c) => tiene(metodo, c) && finito(p[c]))
    .map((c) => sobreEje(c, p[c], c)),

  // Una asa por componente en (x0, y0_j). Con una sola ecuacion y0 es un escalar.
  edo: (metodo, p, resultado) => {
    if (!tiene(metodo, "x0") || !tiene(metodo, "y0") || !finito(p.x0)) return [];
    const nombres = (resultado?.columns ?? []).filter((c) => c.key !== "x").map((c) => c.label);
    return [p.y0].flat().flatMap((y, j) => (finito(y)
      ? [{
        id: `y0:${j}`, x: p.x0, y, eje: "xy",
        etiqueta: Array.isArray(p.y0) ? (nombres[j] ?? `y${j + 1}`) : "y₀",
      }]
      : []));
  },
};

export function asasDe(metodo, params, resultado = null) {
  const asas = POR_FAMILIA[metodo.family]?.(metodo, params, resultado) ?? [];
  return asas.length ? { tipo: "asas", asas } : null;
}

// Parametros nuevos con el asa `id` llevada a (x, y). Un asa de eje x ignora y.
export function mover(metodo, params, id, x, y) {
  const [campo, indice] = id.split(":");
  const i = Number(indice);
  if (campo === "p") {
    return { ...params, points: params.points.map((p, j) => (j === i ? [x, y] : [...p])) };
  }
  if (campo === "y0") {
    // x0 es de todas las componentes: mover una mueve el arranque de todas.
    const y0 = Array.isArray(params.y0) ? params.y0.map((v, j) => (j === i ? y : v)) : y;
    return { ...params, x0: x, y0 };
  }
  return { ...params, [campo]: x };
}

export const campoDe = (id) => {
  const campo = id.split(":")[0];
  return campo === "p" ? "points" : campo;
};

export const describir = (asa) =>
  `${asa.etiqueta} = ${asa.eje === "x" ? asa.x : `(${asa.x}, ${asa.y})`}`;
