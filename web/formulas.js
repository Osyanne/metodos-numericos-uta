// Formula de cada metodo, en MathML: el navegador la dibuja solo, sin
// librerias ni internet. Es texto fijo, con la notacion de clase
// (docs/INFORME.md): aca no entra ningun dato del usuario ni se calcula nada.
//
// Un metodo nuevo suma aca su formula. Si no la tiene, la tarjeta se oculta.

const mi = (t) => `<mi>${t}</mi>`;
const mn = (t) => `<mn>${t}</mn>`;
const mo = (t) => `<mo>${t}</mo>`;
const fila = (...partes) => `<mrow>${partes.join("")}</mrow>`;
const sub = (base, indice) => `<msub>${base}${indice}</msub>`;
const frac = (arriba, abajo) => `<mfrac>${arriba}${abajo}</mfrac>`;
const paren = (...partes) => fila(mo("("), ...partes, mo(")"));
const f = (...args) => fila(mi("f"), paren(...args.flatMap((a, i) => (i ? [mo(","), a] : [a]))));
const separa = '<mspace width="1em"></mspace>';
const suma = (desde, hasta) =>
  `<munderover>${mo("∑")}${desde}${hasta}</munderover>`;

// Una sola linea, o varias alineadas a la izquierda para que entren en la
// tarjeta de un celular: las largas se parten como en el pizarron.
function tabla(renglones) {
  return renglones.length === 1
    ? renglones[0]
    : '<mtable>' +
      renglones.map((r) => `<mtr><mtd>${r}</mtd></mtr>`).join("") +
      "</mtable>";
}

function math(id, ...renglones) {
  return `<math display="block" data-formula="${id}">${tabla(renglones)}</math>`;
}

const x = mi("x");
const i = mi("i");
const n = mi("n");
const h = mi("h");
const uno = mn("1");
const dos = mn("2");
const xi = sub(x, i);
const x0 = sub(x, mn("0"));
const x1 = sub(x, uno);
const xn = sub(x, n);
const xSig = sub(x, fila(i, mo("+"), uno));
const xAnt = sub(x, fila(i, mo("−"), uno));
const xnAnt = sub(x, fila(n, mo("−"), uno));
const yi = sub(mi("y"), i);
const ySig = sub(mi("y"), fila(i, mo("+"), uno));
const k = (j) => sub(mi("k"), mn(j));
const fPrima = `<msup>${mi("f")}${mo("′")}</msup>`;
const resta = (a, b) => fila(a, mo("−"), b);
const ancho = frac(resta(mi("b"), mi("a")), n);
const medio = (m) => fila(sub(mi("m"), i), mo("="), frac(fila(xAnt, mo("+"), xi), dos), m ?? "");
const iDesde1 = fila(i, mo("="), uno);

export const FORMULAS = {
  "newton-raphson": math(
    "newton-raphson",
    fila(xSig, mo("="), xi, mo("−"), frac(f(xi), fila(fPrima, paren(xi)))),
  ),

  "von-mises": math(
    "von-mises",
    fila(xSig, mo("="), xi, mo("−"), frac(f(xi), fila(fPrima, paren(x0)))),
  ),

  "interpolacion-newton": math(
    "interpolacion-newton",
    fila(mi("P"), paren(x), mo("="), sub(mi("a"), mn("0")), mo("+"), sub(mi("a"), uno), paren(resta(x, x0))),
    fila(mo("+"), sub(mi("a"), dos), paren(resta(x, x0)), paren(resta(x, x1)), mo("+"), mo("⋯")),
    fila(mo("+"), sub(mi("a"), n), paren(resta(x, x0)), mo("⋯"), paren(resta(x, xnAnt))),
  ),

  "interpolacion-lagrange": math(
    "interpolacion-lagrange",
    fila(
      mi("P"), paren(x), mo("="),
      suma(fila(i, mo("="), mn("0")), n), f(xi), sub(mi("L"), i), paren(x),
    ),
    fila(
      sub(mi("L"), i), paren(x), mo("="),
      `<munder>${mo("∏")}${fila(mi("j"), mo("≠"), i)}</munder>`,
      frac(resta(x, sub(x, mi("j"))), resta(xi, sub(x, mi("j")))),
    ),
  ),

  "punto-medio": math(
    "punto-medio",
    fila(mi("I"), mo("≈"), mi("Δx"), suma(iDesde1, n), f(sub(mi("m"), i))),
    medio(fila(mo(","), separa, mi("Δx"), mo("="), ancho)),
  ),

  trapecio: math(
    "trapecio",
    fila(mi("I"), mo("≈"), frac(h, dos), mo("["), f(x0), mo("+"), dos, f(x1), mo("+"), mo("⋯")),
    fila(mo("+"), dos, f(xnAnt), mo("+"), f(xn), mo("]")),
    fila(h, mo("="), ancho),
  ),

  simpson: math(
    "simpson",
    fila(
      mi("I"), mo("≈"), frac(resta(mi("b"), mi("a")), fila(mn("6"), n)),
      mo("["), f(x0), mo("+"), mn("4"), suma(iDesde1, n), f(sub(mi("m"), i)),
    ),
    fila(
      mo("+"), dos, suma(iDesde1, fila(n, mo("−"), uno)), f(xi), mo("+"), f(xn), mo("]"),
    ),
    medio(),
  ),

  "runge-kutta": {
    campo: "orden",
    defecto: "4",
    variantes: {
      2: math(
        "runge-kutta-2",
        fila(ySig, mo("="), yi, mo("+"), frac(h, dos), paren(k("1"), mo("+"), k("2"))),
        fila(k("1"), mo("="), f(xi, yi)),
        fila(k("2"), mo("="), f(fila(xi, mo("+"), h), fila(yi, mo("+"), h, k("1")))),
      ),
      4: math(
        "runge-kutta-4",
        fila(
          ySig, mo("="), yi, mo("+"), frac(h, mn("6")),
          paren(k("1"), mo("+"), dos, k("2"), mo("+"), dos, k("3"), mo("+"), k("4")),
        ),
        fila(k("1"), mo("="), f(xi, yi)),
        fila(k("2"), mo("="), f(fila(xi, mo("+"), frac(h, dos)), fila(yi, mo("+"), frac(h, dos), k("1")))),
        fila(k("3"), mo("="), f(fila(xi, mo("+"), frac(h, dos)), fila(yi, mo("+"), frac(h, dos), k("2")))),
        fila(k("4"), mo("="), f(fila(xi, mo("+"), h), fila(yi, mo("+"), h, k("3")))),
      ),
    },
  },
};

// `valorDe(campo)` devuelve lo que la persona escribio en ese campo. Un valor
// sin variante propia (orden vacio o invalido) muestra la de por defecto.
export function formulaPara(slug, valorDe) {
  const entrada = FORMULAS[slug];
  if (entrada === undefined) return null;
  if (typeof entrada === "string") return entrada;
  // Se compara el numero, no el texto: "2.0" es el orden 2 que el nucleo calcula.
  return entrada.variantes[String(Number(valorDe(entrada.campo)))]
    ?? entrada.variantes[entrada.defecto];
}

// ---------------------------------------------------------------- sustitucion

// La misma formula con los numeros de la fila elegida, sin el resultado al
// final: la interfaz coloca lo que calculo el nucleo, no calcula nada. Un
// negativo va entre parentesis (U+2212) para que no se confunda con la resta.
function numero(valor, fmt) {
  const texto = fmt(valor);
  if (texto === "—") return "<mtext>—</mtext>";
  // El signo y la cifra van en su propio grupo: sueltos se dibujan como resta.
  if (texto.startsWith("-")) return fila(mo("("), fila(mo("−"), mn(texto.slice(1))), mo(")"));
  return mn(texto);
}

const por = mo("·");
const rotulo = (texto) => `<mtext>${texto}</mtext>`;
const igual = (izquierda, ...derecha) => fila(izquierda, mo("="), ...derecha);

// `dfx` es la clave de `detalle` con la derivada que uso esa fila.
const raiz = (dfx) => ({ it: { values: v, detalle }, num }) =>
  [igual(xSig, num(v.xi), mo("−"), frac(num(v.fxi), num(detalle?.[dfx])))];

// Una linea por componente (un sistema tiene varias) y el corchete partido en
// dos para que entre en la tarjeta de un celular.
function rungeKutta(orden) {
  const pesos = orden === 2 ? [1, 1] : [1, 2, 2, 1];
  const grupos = orden === 2 ? [[0, 1]] : [[0, 1], [2, 3]];
  return ({ it, ant, k, res, num }) => {
    if (k === 0) return [rotulo("condición inicial")];
    const comps = res.columns.map((c) => c.key).filter((c) => c !== "x");
    return comps.flatMap((c) => {
      const termino = (j) => {
        const kj = num(it.detalle?.[`k${j + 1}_${c}`] ?? it.detalle?.[`k${j + 1}`]);
        return pesos[j] === 1 ? kj : fila(mn(pesos[j]), por, kj);
      };
      const renglonesK = grupos.map((js, g) => fila(
        mo(g ? "+" : "("),
        ...js.flatMap((j, p) => (p ? [mo("+"), termino(j)] : [termino(j)])),
        ...(g === grupos.length - 1 ? [mo(")")] : []),
      ));
      // "y1" es la componente 1 de y: se escribe y con subindice (1, paso).
      const [, base, indice] = c.match(/^(.*?)(\d*)$/);
      const subindice = indice ? fila(mn(indice), mo(","), mn(it.n)) : mn(it.n);
      return [
        igual(sub(mi(base), subindice), num(ant.values[c]), mo("+"),
          frac(num(it.detalle?.h), mn(orden === 2 ? "2" : "6")), por),
        ...renglonesK,
      ];
    });
  };
}

// Con puntos equiespaciados el coeficiente sale de la tabla de diferencias:
// a_k = Δᵏy₀ / (k!·hᵏ) hacia adelante (Δᵏy₀ esta en la fila 0) y
// a_k = ∇ᵏy_k / (k!·hᵏ) hacia atras (en la fila k). El nucleo no da h: se
// escribe (x₁ − x₀) con las x de las filas 1 y 0. Con divididas, a_k es el
// coeficiente tal cual.
function interpolacionNewton({ filas, it, k, res, num }) {
  const a = sub(mi("a"), mn(k));
  const variante = res.result?.variante_usada;
  if (variante !== "adelante" && variante !== "atras") {
    return [igual(a, num(res.result?.coeficientes?.[k]))];
  }
  if (k === 0) return [igual(a, sub(mi("y"), mn("0")), num(filas[0].values.y))];

  const adelante = variante === "adelante";
  const diferencia = adelante ? "Δ" : "∇";
  const clave = adelante ? `delta${k}` : `nabla${k}`;
  const fuente = adelante ? filas[0] : it;
  const y = sub(mi("y"), mn(adelante ? "0" : k));
  const potencia = (base) => `<msup>${base}${mn(k)}</msup>`;
  const factorial = fila(mn(k), mo("!"));
  const hHecha = paren(num(filas[1]?.values.x), mo("−"), num(filas[0]?.values.x));
  return [
    igual(a, frac(fila(potencia(mi(diferencia)), y), fila(factorial, por, potencia(h)))),
    fila(mo("="), frac(num(fuente.values[clave]), fila(factorial, por, potencia(hHecha)))),
  ];
}

const SUSTITUCIONES = {
  "newton-raphson": raiz("dfxi"),

  "von-mises": (c) => [
    ...raiz("dfx0")(c),
    igual(fila(fPrima, paren(x0)), c.num(c.it.detalle?.dfx0)),
  ],

  "interpolacion-newton": interpolacionNewton,

  "interpolacion-lagrange": ({ it, num }) => [
    igual(
      fila(f(sub(x, mn(it.n))), por, sub(mi("L"), mn(it.n)), paren(`<msup>${x}${mo("∗")}</msup>`)),
      num(it.values.yi), por, num(it.values.Li_evaluado),
    ),
  ],

  "punto-medio": ({ it, res, num }) => [
    igual(fila(mi("Δx"), por, f(sub(mi("m"), mn(it.n)))),
      num(res.result?.delta_x), por, num(it.values.fxi)),
    igual(rotulo("suma acumulada"), num(it.values.suma)),
  ],

  trapecio: ({ it, res, num }) => [
    fila(rotulo("peso"), por, f(sub(x, mn(it.n))), por, frac(h, dos)),
    fila(mo("="), num(it.values.peso), por, num(it.values.fxi), por,
      frac(num(res.result?.delta_x), dos)),
    igual(rotulo("suma acumulada"), num(it.values.suma)),
  ],

  simpson: ({ it, num }) => [
    igual(fila(rotulo("peso"), por, f(x)), num(it.values.peso), por, num(it.values.fxi)),
    igual(rotulo("suma del corchete"), num(it.values.suma)),
  ],
};

// La variante de Runge-Kutta sale del orden que uso el nucleo, no del formulario.
function porMetodo(slug, res) {
  if (slug !== "runge-kutta") return SUSTITUCIONES[slug];
  return rungeKutta(Number(res.result?.orden) === 2 ? 2 : 4);
}

// `fmt(v)` da el texto con los Decimales vigentes. Devuelve null si el metodo no
// tiene sustitucion o la fila no existe.
export function sustitucionPara(slug, filas, k, resultado, fmt) {
  const it = filas?.[k];
  const hacer = it && porMetodo(slug, resultado);
  if (!hacer) return null;
  const renglones = hacer({
    filas, it, ant: filas[k - 1], k, res: resultado, num: (v) => numero(v, fmt),
  });
  return `<math display="block" data-sustitucion="${slug}">${tabla(renglones)}</math>`;
}
