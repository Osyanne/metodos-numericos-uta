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
const corchete = (...partes) => fila(mo("["), ...partes, mo("]"));
const f = (...args) => fila(mi("f"), paren(...args.flatMap((a, i) => (i ? [mo(","), a] : [a]))));
const separa = '<mspace width="1em"></mspace>';
const suma = (desde, hasta) =>
  `<munderover>${mo("∑")}${desde}${hasta}</munderover>`;

// Una sola linea, o varias alineadas a la izquierda para que entren en la
// tarjeta de un celular.
function math(id, ...renglones) {
  const cuerpo = renglones.length === 1
    ? renglones[0]
    : '<mtable>' +
      renglones.map((r) => `<mtr><mtd>${r}</mtd></mtr>`).join("") +
      "</mtable>";
  return `<math display="block" data-formula="${id}">${cuerpo}</math>`;
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
    fila(
      mi("P"), paren(x), mo("="), sub(mi("a"), mn("0")),
      mo("+"), sub(mi("a"), uno), paren(resta(x, x0)),
      mo("+"), sub(mi("a"), dos), paren(resta(x, x0)), paren(resta(x, x1)),
    ),
    fila(
      mo("+"), mo("⋯"), mo("+"), sub(mi("a"), n),
      paren(resta(x, x0)), mo("⋯"), paren(resta(x, xnAnt)),
    ),
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
    fila(
      mi("I"), mo("≈"), frac(h, dos),
      corchete(
        f(x0), mo("+"), dos, f(x1), mo("+"), mo("⋯"),
        mo("+"), dos, f(xnAnt), mo("+"), f(xn),
      ),
    ),
    fila(h, mo("="), ancho),
  ),

  simpson: math(
    "simpson",
    // El corchete en dos renglones, como en el pizarron: entero no cabe en
    // la tarjeta.
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
  return entrada.variantes[valorDe(entrada.campo)] ?? entrada.variantes[entrada.defecto];
}
