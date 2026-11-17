// Explicacion de cada metodo para la pestana "Teoria": texto, formulas en
// MathML, graficas estaticas y un ejemplo a mano. Es contenido fijo: aca no se
// calcula nada. Los numeros de los ejemplos estan verificados por el `esperado`
// del ejercicio que cita (web/presets.js).
//
// Un metodo nuevo suma aca su entrada. Sin entrada, la pestana no aparece.

import { mml } from "./formulas.js";

const { mi, mn, mo, fila, sub, frac, paren, f, suma, resta, tabla, separa } = mml;

const mtext = (t) => `<mtext>${t}</mtext>`;
const sup = (base, exponente) => `<msup>${base}${exponente}</msup>`;
const mat = (...renglones) =>
  `<div class="teo-formula"><math display="block">${tabla(renglones)}</math></div>`;

const x = mi("x");
const i = mi("i");
const n = mi("n");
const h = mi("h");
const a = mi("a");
const b = mi("b");
const nodo = (k) => sub(x, typeof k === "number" ? mn(k) : k);
const f4 = (arg) => fila(sup(mi("f"), paren(mn("4"))), paren(arg));
const ba = resta(b, a);
const tres8h = frac(fila(mn("3"), h), mn("8"));
const h3 = frac(h, mn("3"));

// --------------------------------------------------------------- formulas

const integralDe = (cuerpo, desde = a, hasta = b) =>
  fila(`<msubsup>${mo("∫")}${desde}${hasta}</msubsup>`, cuerpo, mi("dx"));

const IDEA = mat(
  fila(
    mi("I"), mo("="), integralDe(f(x)), mo("≈"), integralDe(fila(sub(mi("f"), mn("3")), paren(x))),
  ),
);

// Como la escribe el docente: ancho por altura promedio.
const SIMPLE_DOCENTE = mat(
  fila(
    mi("I"), mo("≈"), paren(ba), mo("·"),
    frac(fila(f(nodo(0)), mo("+"), mn("3"), f(nodo(1)), mo("+"), mn("3"), f(nodo(2)), mo("+"), f(nodo(3))), mn("8")),
  ),
);

const SIMPLE_CON_H = mat(
  fila(mi("I"), mo("≈"), tres8h, mo("["), f(nodo(0)), mo("+"), mn("3"), f(nodo(1)), mo("+"), mn("3"), f(nodo(2)), mo("+"), f(nodo(3)), mo("]")),
  fila(h, mo("="), frac(ba, mn("3")), mo(","), separa, nodo(i), mo("="), a, mo("+"), i, h),
);

const menos = (k) => fila(n, mo("−"), mn(k));
const COMPUESTA = mat(
  fila(
    mi("I"), mo("≈"), tres8h, mo("["), f(nodo(0)), mo("+"), mn("3"), f(nodo(1)),
    mo("+"), mn("3"), f(nodo(2)),
  ),
  fila(mo("+"), mn("2"), f(nodo(3)), mo("+"), mn("3"), f(nodo(4)), mo("+"), mn("3"), f(nodo(5))),
  fila(mo("+"), mn("2"), f(nodo(6)), mo("+"), mo("⋯")),
  fila(
    mo("+"), mn("2"), f(nodo(menos(3))), mo("+"), mn("3"), f(nodo(menos(2))),
    mo("+"), mn("3"), f(nodo(menos(1))), mo("+"), f(nodo(n)), mo("]"),
  ),
  fila(h, mo("="), frac(ba, n), mo(","), separa, mtext("n múltiplo de 3")),
);

const COMPACTA = mat(
  fila(
    mi("I"), mo("≈"), tres8h, mo("["), f(nodo(0)), mo("+"), mn("3"),
    `<munder>${mo("∑")}${fila(i, mo("≠"), mn("3"), mi("k"))}</munder>`, f(nodo(i)),
  ),
  fila(
    mo("+"), mn("2"), `<munder>${mo("∑")}${fila(i, mo("="), mn("3"), mi("k"))}</munder>`, f(nodo(i)),
    mo("+"), f(nodo(n)), mo("]"),
  ),
  fila(i, mo("="), mn("1"), mo(","), mo("…"), mo(","), n, mo("−"), mn("1"), mo(","), separa, mtext("k entero")),
);

// n = 5: la regla 1/3 en [x0, x2] y la 3/8 en [x2, x5].
const COMBINADA = mat(
  fila(
    mi("I"), mo("≈"), h3, mo("["), f(nodo(0)), mo("+"), mn("4"), f(nodo(1)), mo("+"), f(nodo(2)), mo("]"),
  ),
  fila(
    mo("+"), tres8h, mo("["), f(nodo(2)), mo("+"), mn("3"), f(nodo(3)), mo("+"), mn("3"), f(nodo(4)), mo("+"), f(nodo(5)), mo("]"),
  ),
);

const sumaI = suma(fila(i, mo("="), mn("0")), mn("3"));
const LAGRANGE = mat(
  fila(
    sub(mi("P"), mn("3")), paren(x), mo("="), sumaI, f(nodo(i)), sub(mi("L"), i), paren(x),
  ),
  fila(
    sub(mi("L"), i), paren(x), mo("="),
    `<munder>${mo("∏")}${fila(mi("j"), mo("≠"), i)}</munder>`,
    frac(resta(x, nodo(mi("j"))), resta(nodo(i), nodo(mi("j")))),
  ),
  fila(
    mi("I"), mo("≈"), integralDe(fila(sub(mi("P"), mn("3")), paren(x)), nodo(0), nodo(3)),
    mo("="), sumaI, f(nodo(i)), integralDe(fila(sub(mi("L"), i), paren(x)), nodo(0), nodo(3)),
  ),
  fila(mo("="), sumaI, sub(mi("w"), i), f(nodo(i)), mo(","), separa,
    sub(mi("w"), i), mo("="), integralDe(fila(sub(mi("L"), i), paren(x)), nodo(0), nodo(3))),
);

const CAMBIO = mat(
  fila(
    x, mo("="), nodo(0), mo("+"), mi("s"), h, mo(","), separa, mi("dx"), mo("="), h, mi("ds"), mo(","), separa,
    mi("s"), mo("∈"), mo("["), mn("0"), mo(","), mn("3"), mo("]"),
  ),
  fila(
    sub(mi("w"), i), mo("="), h, `<msubsup>${mo("∫")}${mn("0")}${mn("3")}</msubsup>`, sub(mi("L"), i), paren(mi("s")), mi("ds"),
  ),
);

const ERROR_SIMPLE = mat(
  fila(
    sub(mi("E"), mi("t")), mo("="), mo("−"), frac(sup(paren(ba), mn("5")), mn("6480")), f4(mi("ξ")),
    mo("="), mo("−"), frac(mn("3"), mn("80")), sup(h, mn("5")), f4(mi("ξ")),
    mo(","), separa, mi("ξ"), mo("∈"), mo("["), a, mo(","), b, mo("]"),
  ),
);

const ERROR_COMPUESTO = mat(
  fila(
    sub(mi("E"), mi("a")), mo("="), mo("−"), frac(ba, mn("80")), sup(h, mn("4")), f4(mi("ξ")),
    mo(","), separa, mi("ξ"), mo("∈"), mo("["), a, mo(","), b, mo("]"),
  ),
  fila(
    mo("="), mo("−"), frac(mn("3"), mn("80")), sup(h, mn("5")), mo("·"),
    frac(n, mn("3")), mo("·"), f4(mi("ξ")),
  ),
);

const COTA = mat(
  fila(
    mo("|"), mi("E"), mo("|"), mo("≤"), frac(ba, mn("80")), sup(h, mn("4")),
    `<mi mathvariant="normal">max</mi>`, mo("|"), f4(x), mo("|"),
  ),
);

// ------------------------------------------------------------ graficas SVG

// Curva de ejemplo f(s) = 1.55 + 0.95 sen(1.7 s) con sus nodos en s = 0, 1, 2, 3
// y la cubica que pasa por ellos (una Bezier cubica exacta). Todos los numeros
// salen de ese calculo hecho una vez, aparte: aca solo se dibujan.
const GRAFICA = `
<svg class="teo-svg" viewBox="0 0 320 214" role="img" aria-labelledby="teo-g-t teo-g-d">
  <title id="teo-g-t">Simpson 3/8 sobre un tramo</title>
  <desc id="teo-g-d">Una curva f(x) y la cúbica que pasa por cuatro de sus puntos, x₀, x₁, x₂ y x₃, separados por una distancia h. El área bajo la cúbica, entre x₀ y x₃, está sombreada y es la aproximación de la integral.</desc>
  <path class="teo-area teo-area-cubica" d="M40 172 L40 100.7 C120 -32.6 200 165.5 280 141.2 L280 172 Z"/>
  <line class="teo-eje" x1="24" y1="172" x2="304" y2="172"/>
  <g class="teo-guia">
    <line x1="40" y1="100.7" x2="40" y2="172"/>
    <line x1="120" y1="57.4" x2="120" y2="172"/>
    <line x1="200" y1="111.9" x2="200" y2="172"/>
    <line x1="280" y1="141.2" x2="280" y2="172"/>
  </g>
  <path class="teo-curva" d="M40 100.7 L48 93.3 L56 86.1 L64 79.4 L72 73.2 L80 67.9 L88 63.5 L96 60.1 L104 58 L112 57 L120 57.4 L128 58.9 L136 61.7 L144 65.6 L152 70.5 L160 76.3 L168 82.8 L176 89.8 L184 97.1 L192 104.6 L200 111.9 L208 118.9 L216 125.3 L224 131.1 L232 135.9 L240 139.8 L248 142.5 L256 144.1 L264 144.4 L272 143.4 L280 141.2"/>
  <path class="teo-cubica" d="M40 100.7 C120 -32.6 200 165.5 280 141.2"/>
  <g class="teo-nodos">
    <circle cx="40" cy="100.7" r="4"/><circle cx="120" cy="57.4" r="4"/>
    <circle cx="200" cy="111.9" r="4"/><circle cx="280" cy="141.2" r="4"/>
  </g>
  <g class="teo-rotulo" text-anchor="middle">
    <text x="40" y="188">x<tspan dy="3" font-size="9">0</tspan></text>
    <text x="120" y="188">x<tspan dy="3" font-size="9">1</tspan></text>
    <text x="200" y="188">x<tspan dy="3" font-size="9">2</tspan></text>
    <text x="280" y="188">x<tspan dy="3" font-size="9">3</tspan></text>
    <text x="160" y="156" class="teo-nota-svg">área ≈ integral de la cúbica</text>
  </g>
  <g class="teo-cota">
    <line x1="40" y1="203" x2="120" y2="203"/>
    <line x1="40" y1="199" x2="40" y2="207"/><line x1="120" y1="199" x2="120" y2="207"/>
  </g>
  <text class="teo-rotulo" x="80" y="213" text-anchor="middle" font-style="italic">h</text>
  <g class="teo-leyenda">
    <line class="teo-curva" x1="196" y1="16" x2="220" y2="16"/>
    <text class="teo-rotulo" x="226" y="20">f(x)</text>
    <line class="teo-cubica" x1="196" y1="34" x2="220" y2="34"/>
    <text class="teo-rotulo" x="226" y="38">cúbica por x<tspan dy="3" font-size="9">0</tspan><tspan dy="-3">…</tspan>x<tspan dy="3" font-size="9">3</tspan></text>
  </g>
</svg>`;

// El ejemplo de Chapra: f(x) = 0.2 + 25x - 200x^2 + 675x^3 - 900x^4 + 400x^5 en
// [0, 0.8] con n = 5 (h = 0.16). Parabola por x0, x1, x2 y cubica por x2 .. x5.
const GRAFICA_COMBINADA = `
<svg class="teo-svg" viewBox="0 0 360 246" role="img" aria-labelledby="teo-g2-t teo-g2-d">
  <title id="teo-g2-t">Simpson 1/3 y 3/8 combinadas con n = 5</title>
  <desc id="teo-g2-d">Una curva f(x) sobre seis nodos, x₀ a x₅, con cinco subintervalos de ancho h. Una parábola, la regla 1/3, pasa por x₀, x₁ y x₂ y cubre los dos primeros subintervalos; una cúbica, la regla 3/8, pasa por x₂, x₃, x₄ y x₅ y cubre los tres últimos. Las dos áreas están sombreadas con colores distintos.</desc>
  <path class="teo-area teo-area-parabola" d="M36 176 L36 168 Q96 111.1 156 106.3 L156 176 Z"/>
  <path class="teo-area teo-area-cubica" d="M156 176 L156 106.3 C216 39.6 276 -30.2 336 166.7 L336 176 Z"/>
  <line class="teo-eje" x1="24" y1="176" x2="348" y2="176"/>
  <g class="teo-guia">
    <line x1="36" y1="168" x2="36" y2="176"/><line x1="96" y1="124.1" x2="96" y2="176"/>
    <line x1="156" y1="106.3" x2="156" y2="176"/><line x1="216" y1="48.6" x2="216" y2="176"/>
    <line x1="276" y1="48.7" x2="276" y2="176"/><line x1="336" y1="166.7" x2="336" y2="176"/>
  </g>
  <path class="teo-curva" d="M36 168 L43.5 151 L51 139.2 L58.5 131.4 L66 126.8 L73.5 124.4 L81 123.6 L88.5 123.7 L96 124.1 L103.5 124.5 L111 124.5 L118.5 123.8 L126 122.3 L133.5 119.7 L141 116.2 L148.5 111.7 L156 106.3 L163.5 100 L171 93 L178.5 85.5 L186 77.8 L193.5 69.9 L201 62.3 L208.5 55.1 L216 48.6 L223.5 43 L231 38.6 L238.5 35.7 L246 34.4 L253.5 34.9 L261 37.4 L268.5 42 L276 48.7 L283.5 57.6 L291 68.5 L298.5 81.5 L306 96.2 L313.5 112.5 L321 130 L328.5 148.2 L336 166.7"/>
  <path class="teo-parabola" d="M36 168 Q96 111.1 156 106.3"/>
  <path class="teo-cubica" d="M156 106.3 C216 39.6 276 -30.2 336 166.7"/>
  <g class="teo-nodos">
    <circle cx="36" cy="168" r="4"/><circle cx="96" cy="124.1" r="4"/><circle cx="156" cy="106.3" r="4"/>
    <circle cx="216" cy="48.6" r="4"/><circle cx="276" cy="48.7" r="4"/><circle cx="336" cy="166.7" r="4"/>
  </g>
  <g class="teo-rotulo" text-anchor="middle">
    <text x="36" y="192">x<tspan dy="3" font-size="9">0</tspan></text>
    <text x="96" y="192">x<tspan dy="3" font-size="9">1</tspan></text>
    <text x="156" y="192">x<tspan dy="3" font-size="9">2</tspan></text>
    <text x="216" y="192">x<tspan dy="3" font-size="9">3</tspan></text>
    <text x="276" y="192">x<tspan dy="3" font-size="9">4</tspan></text>
    <text x="336" y="192">x<tspan dy="3" font-size="9">5</tspan></text>
  </g>
  <g class="teo-cota">
    <line x1="36" y1="208" x2="156" y2="208"/><line x1="36" y1="204" x2="36" y2="212"/><line x1="156" y1="204" x2="156" y2="212"/>
    <line x1="156" y1="208" x2="336" y2="208"/><line x1="336" y1="204" x2="336" y2="212"/>
  </g>
  <g class="teo-rotulo" text-anchor="middle">
    <text x="96" y="226">regla 1/3 (2 subintervalos)</text>
    <text x="246" y="226">regla 3/8 (3 subintervalos)</text>
    <text x="180" y="243" font-style="italic" class="teo-nota-svg">cada subintervalo mide h = 0.16</text>
  </g>
  <g class="teo-leyenda">
    <line class="teo-curva" x1="40" y1="14" x2="64" y2="14"/>
    <text class="teo-rotulo" x="70" y="18">f(x)</text>
    <line class="teo-parabola" x1="40" y1="32" x2="64" y2="32"/>
    <text class="teo-rotulo" x="70" y="36">parábola (regla 1/3)</text>
    <line class="teo-cubica" x1="40" y1="50" x2="64" y2="50"/>
    <text class="teo-rotulo" x="70" y="54">cúbica (regla 3/8)</text>
  </g>
</svg>`;

// ------------------------------------------------------------- Simpson 3/8

const SIMPSON_38 = `
<section aria-labelledby="teo-definicion">
  <h3 id="teo-definicion">Qué es</h3>
  <p><strong>Simpson 3/8</strong> es una regla de integración numérica de la familia de Newton-Cotes
  cerradas: aproxima una integral definida ∫ₐᵇ f(x) dx cuando no se puede (o no conviene) buscar una primitiva.</p>
  <p><strong>La idea.</strong> En lugar de integrar f, se integra un <em>polinomio de tercer grado</em>, f₃, que
  pasa por cuatro puntos equiespaciados de la curva, (x₀, f(x₀)), (x₁, f(x₁)), (x₂, f(x₂)) y (x₃, f(x₃)),
  separados por una distancia h. Esa integral sí se calcula exacta, y resulta un promedio ponderado de los
  cuatro valores de f.</p>
  ${IDEA}
  <p><strong>De dónde sale el nombre.</strong> El resultado lleva el factor 3h/8 delante del corchete: de ahí «3/8».
  Para un intervalo largo se parte [a, b] en n subintervalos y se aplica la regla simple a cada tramo de tres
  subintervalos: es la <em>aplicación múltiple</em>.</p>
</section>

<section aria-labelledby="teo-simple">
  <h3 id="teo-simple">Fórmula simple</h3>
  <p>Con los cuatro puntos x₀ = a, x₁, x₂ y x₃ = b, la fórmula del docente es «ancho por altura promedio»:</p>
  ${SIMPLE_DOCENTE}
  <ul>
    <li><strong>Ancho:</strong> (b − a), la base del área.</li>
    <li><strong>Altura promedio:</strong> [f(x₀) + 3f(x₁) + 3f(x₂) + f(x₃)] / 8, un promedio ponderado de las
    cuatro alturas con pesos 1, 3, 3, 1, que suman 8.</li>
  </ul>
  <p>Con el ancho de cada subintervalo, h = (b − a)/3, el factor (b − a)/8 es 3h/8 y queda la forma con h:</p>
  ${SIMPLE_CON_H}
  <p class="teo-nota"><strong>Condición:</strong> las distancias h entre los cuatro puntos tienen que ser iguales.
  Los pesos 1, 3, 3, 1 salen de suponer nodos equiespaciados; con otra separación la fórmula ya no vale.</p>
</section>

<section aria-labelledby="teo-pesos">
  <h3 id="teo-pesos">De dónde salen los pesos 1, 3, 3, 1</h3>
  <p>Sea P₃ el polinomio de grado 3 que pasa por los cuatro nodos (la regla es la Newton-Cotes cerrada de 4 puntos:
  incluye los dos extremos). En la forma de Lagrange es la suma de cada valor f(xᵢ) por su polinomio básico Lᵢ,
  que vale 1 en xᵢ y 0 en los otros tres nodos. Integrar P₃ es integrar cada Lᵢ; cada integral es un peso wᵢ:</p>
  ${LAGRANGE}
  <p>Con el cambio x = x₀ + s·h los nodos pasan a ser s = 0, 1, 2, 3 y los pesos no dependen de la función
  ni del intervalo, solo de h:</p>
  ${CAMBIO}
  <div class="teo-scroll">
  <table class="teo-tabla">
    <caption>Pesos de la regla de 4 puntos (Newton-Cotes cerrada)</caption>
    <thead>
      <tr><th scope="col">i</th><th scope="col">Lᵢ(s)</th><th scope="col">∫₀³ Lᵢ(s) ds</th><th scope="col">peso wᵢ</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">0</th><td>−(s − 1)(s − 2)(s − 3)/6</td><td>3/8</td><td>(3h/8)·1</td></tr>
      <tr><th scope="row">1</th><td>s(s − 2)(s − 3)/2</td><td>9/8</td><td>(3h/8)·3</td></tr>
      <tr><th scope="row">2</th><td>−s(s − 1)(s − 3)/2</td><td>9/8</td><td>(3h/8)·3</td></tr>
      <tr><th scope="row">3</th><td>s(s − 1)(s − 2)/6</td><td>3/8</td><td>(3h/8)·1</td></tr>
    </tbody>
  </table>
  </div>
  <p class="teo-nota">Comprobación: 3/8 + 9/8 + 9/8 + 3/8 = 3, así que los pesos suman 3h = x₃ − x₀. Es lo
  esperable: la regla integra exactamente la función constante 1.</p>
</section>

<section aria-labelledby="teo-grafica">
  <h3 id="teo-grafica">Gráfica del método</h3>
  <figure class="teo-figura">
    ${GRAFICA}
    <figcaption>Un tramo: la cúbica reproduce f en los cuatro nodos y entre ellos se separa un poco. El área
    sombreada bajo la cúbica es lo que la regla entrega como valor de la integral.</figcaption>
  </figure>
  <p>Para verlo con tu ejercicio: elige un ejemplo, pulsa <strong>Resolver</strong> y abre la pestaña
  <strong>Plano</strong>. Ahí se dibuja la cúbica de cada tramo con sus nodos y el área sombreada, y se
  pueden mover los extremos a y b con el puntero.</p>
</section>

<section aria-labelledby="teo-algoritmo">
  <h3 id="teo-algoritmo">Algoritmo paso a paso</h3>
  <ol class="teo-pasos">
    <li>Elige f(x), los extremos a y b, y n (con n = 3 es la regla simple).</li>
    <li>Calcula el ancho h = (b − a)/n.</li>
    <li>Arma los nodos xᵢ = a + i·h, para i = 0, 1, …, n.</li>
    <li>Evalúa f(xᵢ) en cada nodo.</li>
    <li>Si n es múltiplo de 3, todo el intervalo es de la regla 3/8. Si no (n = 5 o más, salvo 4), la regla 1/3
    toma los primeros 2 subintervalos (n deja resto 2 al dividir entre 3) o los primeros 4 (resto 1) y la 3/8 el resto.</li>
    <li>En cada regla asigna los pesos: 1 en los extremos del tramo; en la 3/8, 2 en los nodos de unión
    entre cúbicas (x₃, x₆, …) y 3 en los demás; en la 1/3, 4 en los nodos impares y 2 en los pares interiores.</li>
    <li>Suma el corchete S = Σ pesoᵢ · f(xᵢ) de cada regla.</li>
    <li>Multiplica cada corchete por su factor, 3h/8 en la 3/8 y h/3 en la 1/3, y suma los resultados: I ≈ (3h/8)·S.</li>
  </ol>
</section>

<section aria-labelledby="teo-multiple">
  <h3 id="teo-multiple">Aplicación múltiple</h3>
  <h4>Con n múltiplo de 3: la 3/8 compuesta</h4>
  <p>Se parte [a, b] en n subintervalos de ancho h y se aplica la regla simple a cada tramo de tres. Los nodos donde
  un tramo termina y empieza el siguiente (x₃, x₆, …) pesan 1 + 1 = 2:</p>
  ${COMPUESTA}
  <p>Escrita con sumas, con k entero:</p>
  ${COMPACTA}
  <h4>Con n que no es múltiplo de 3: 1/3 y 3/8 juntas</h4>
  <p>Cuando n no es múltiplo de 3 se combinan las dos reglas de Simpson (Chapra, ejemplo 21.6): la regla 1/3 cubre
  los primeros subintervalos con parábolas y la 3/8 el resto con cúbicas.</p>
  <div class="teo-scroll">
  <table class="teo-tabla">
    <caption>Cómo se reparten los subintervalos</caption>
    <thead>
      <tr><th scope="col">n</th><th scope="col">Regla 1/3</th><th scope="col">Regla 3/8</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">múltiplo de 3 (3, 6, 9, …)</th><td>ninguno</td><td>los n</td></tr>
      <tr><th scope="row">resto 2 al dividir entre 3 (5, 8, 11, …)</th><td>los 2 primeros</td><td>los n − 2 restantes</td></tr>
      <tr><th scope="row">resto 1 (7, 10, 13, …)</th><td>los 4 primeros</td><td>los n − 4 restantes</td></tr>
      <tr><th scope="row">1, 2 y 4</th><td colspan="2">no se puede: no queda un tramo de tres subintervalos. Con n = 4 usa Simpson 1/3.</td></tr>
    </tbody>
  </table>
  </div>
  <p>Cada regla lleva su corchete y su factor, y la integral es la suma de las dos. Con n = 5:</p>
  ${COMBINADA}
  <figure class="teo-figura">
    ${GRAFICA_COMBINADA}
    <figcaption>Ejemplo de Chapra con n = 5: la parábola de la regla 1/3 sobre los dos primeros subintervalos y la
    cúbica de la regla 3/8 sobre los tres últimos. El nodo x₂ es el último de la 1/3 y el primero de la 3/8.</figcaption>
  </figure>
  <p><strong>Ejemplo de Chapra resuelto.</strong> f(x) = 0.2 + 25x − 200x² + 675x³ − 900x⁴ + 400x⁵ en [0, 0.8], con
  n = 5 y h = 0.16. Es el ejercicio «Docente · Chapra: grado 5 en [0, 0.8], n = 5 (1/3 + 3/8)» del desplegable.
  El nodo x₂ aparece dos veces en la tabla, una por cada regla, siempre con peso 1; así cada corchete se suma por separado.</p>
  <div class="teo-scroll">
  <table class="teo-tabla teo-numeros">
    <caption>Tabla de nodos del ejemplo de Chapra</caption>
    <thead>
      <tr><th scope="col">nodo</th><th scope="col">xᵢ</th><th scope="col">f(xᵢ)</th><th scope="col">regla</th><th scope="col">peso</th><th scope="col">peso · f(xᵢ)</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">x₀</th><td>0</td><td>0.200000</td><td>1/3</td><td>1</td><td>0.200000</td></tr>
      <tr><th scope="row">x₁</th><td>0.16</td><td>1.296919</td><td>1/3</td><td>4</td><td>5.187676</td></tr>
      <tr><th scope="row">x₂</th><td>0.32</td><td>1.743393</td><td>1/3</td><td>1</td><td>1.743393</td></tr>
      <tr><th scope="row">x₂</th><td>0.32</td><td>1.743393</td><td>3/8</td><td>1</td><td>1.743393</td></tr>
      <tr><th scope="row">x₃</th><td>0.48</td><td>3.186015</td><td>3/8</td><td>3</td><td>9.558044</td></tr>
      <tr><th scope="row">x₄</th><td>0.64</td><td>3.181929</td><td>3/8</td><td>3</td><td>9.545787</td></tr>
      <tr><th scope="row">x₅</th><td>0.8</td><td>0.232000</td><td>3/8</td><td>1</td><td>0.232000</td></tr>
    </tbody>
  </table>
  </div>
  <div class="teo-scroll">
  <table class="teo-tabla teo-numeros">
    <caption>Resultado por regla</caption>
    <thead>
      <tr><th scope="col">regla</th><th scope="col">de</th><th scope="col">a</th><th scope="col">corchete</th><th scope="col">factor</th><th scope="col">integral</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">1/3</th><td>0</td><td>0.32</td><td>7.131069</td><td>h/3 = 0.053333</td><td>0.3803237</td></tr>
      <tr><th scope="row">3/8</th><td>0.32</td><td>0.8</td><td>21.079224</td><td>3h/8 = 0.06</td><td>1.2647535</td></tr>
    </tbody>
    <tfoot>
      <tr><th scope="row" colspan="5">Total</th><td>1.6450772</td></tr>
    </tfoot>
  </table>
  </div>
  <p>El valor exacto es 1.640533, así que el error real es de unos 4.5 × 10⁻³ (0.28 %). El libro imprime 1.264754 para
  la parte 3/8, una millonésima más que el valor de aquí (diferencia de redondeo); el total, 1.645077, coincide. Con n = 3 (una sola cúbica, ejercicio
  «Docente · Chapra: grado 5 en [0, 0.8], n = 3») se obtiene 1.519170, bastante peor: un polinomio de grado 5
  necesita más tramos.</p>
</section>

<section aria-labelledby="teo-ejemplo">
  <h3 id="teo-ejemplo">Ejemplo resuelto a mano</h3>
  <p>Calcula ∫₁² (1/x) dx con n = 3. Aquí h = (2 − 1)/3 = 1/3 y 3h/8 = 1/8. Es el ejercicio
  «Práctica · ∫1/x de 1 a 2, n = 3 (caso simple)» del desplegable de ejemplos.</p>
  <div class="teo-scroll">
  <table class="teo-tabla teo-numeros">
    <caption>Tabla de nodos del ejemplo</caption>
    <thead>
      <tr><th scope="col">i</th><th scope="col">xᵢ</th><th scope="col">f(xᵢ) = 1/xᵢ</th><th scope="col">peso</th><th scope="col">peso · f(xᵢ)</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">0</th><td>1</td><td>1</td><td>1</td><td>1</td></tr>
      <tr><th scope="row">1</th><td>4/3 ≈ 1.3333</td><td>3/4 = 0.75</td><td>3</td><td>2.25</td></tr>
      <tr><th scope="row">2</th><td>5/3 ≈ 1.6667</td><td>3/5 = 0.6</td><td>3</td><td>1.8</td></tr>
      <tr><th scope="row">3</th><td>2</td><td>1/2 = 0.5</td><td>1</td><td>0.5</td></tr>
    </tbody>
    <tfoot>
      <tr><th scope="row" colspan="4">Suma del corchete S</th><td>5.55</td></tr>
    </tfoot>
  </table>
  </div>
  <p>I ≈ (3h/8) · S = (1/8) · 5.55 = <strong>0.69375</strong>.</p>
  <p>El valor exacto es ln 2 = 0.693147…, así que el error real es de unos 6.0 × 10⁻⁴. La cota teórica lo
  confirma: con f⁽⁴⁾(x) = 24/x⁵, que en [1, 2] vale a lo sumo 24, se tiene
  |E| ≤ (3/80)·h⁵·24 = (3/80)·(1/243)·24 ≈ 3.7 × 10⁻³, y 6.0 × 10⁻⁴ está por debajo.</p>
  <p class="teo-nota">Con n = 6 hay dos tramos: x₃ deja de ser el extremo y pasa a pesar 2. Ese caso da
  0.69319535 (ejercicio «Práctica · ∫1/x de 1 a 2 = ln 2, n = 6»).</p>
</section>

<section aria-labelledby="teo-error">
  <h3 id="teo-error">Error de truncamiento</h3>
  <p>Al reemplazar f por la cúbica se comete un error. Para la regla simple, con ξ en algún punto de [a, b]:</p>
  ${ERROR_SIMPLE}
  <p>Al sumar los n/3 tramos y usar n·h = b − a, el error de la regla compuesta es:</p>
  ${ERROR_COMPUESTO}
  <ul>
    <li>El error es de <strong>orden h⁴</strong>: si se divide h entre 2 (n al doble), el error baja unas 16 veces.</li>
    <li>Depende de la <strong>cuarta derivada</strong>. Si f es un polinomio de grado ≤ 3, f⁽⁴⁾ = 0 y la regla es
    <strong>exacta</strong>.</li>
    <li>Al combinar con la regla 1/3 el error total es la suma de los de cada parte, y sigue siendo de orden h⁴.</li>
    <li>Una cota práctica, con el máximo de |f⁽⁴⁾| en [a, b]:</li>
  </ul>
  ${COTA}
  <p>Si f⁽⁴⁾ no está acotada en el intervalo (por ejemplo √x cerca de 0), la cota no vale y la regla converge más
  lento.</p>
</section>

<section aria-labelledby="teo-comparacion">
  <h3 id="teo-comparacion">Comparación con Trapecio y Simpson 1/3</h3>
  <div class="teo-scroll">
  <table class="teo-tabla">
    <caption>Reglas con h = (b − a)/n</caption>
    <thead>
      <tr><th scope="col"></th><th scope="col">Trapecio</th><th scope="col">Simpson 1/3</th><th scope="col">Simpson 3/8</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Puntos por tramo</th><td>2</td><td>3</td><td>4</td></tr>
      <tr><th scope="row">Subintervalos por tramo</th><td>1</td><td>2</td><td>3</td></tr>
      <tr><th scope="row">Polinomio por tramo</th><td>recta (grado 1)</td><td>parábola (grado 2)</td><td>cúbica (grado 3)</td></tr>
      <tr><th scope="row">Condición sobre n</th><td>ninguna</td><td>n par</td><td>n múltiplo de 3; si no, se combina con la 1/3 (n = 5 o más, salvo 4)</td></tr>
      <tr><th scope="row">Exacta hasta grado</th><td>1</td><td>3</td><td>3</td></tr>
      <tr><th scope="row">Error simple</th><td>−(b − a)³/12 · f″(ξ)</td><td>−(b − a)⁵/2880 · f⁽⁴⁾(ξ)</td><td>−(b − a)⁵/6480 · f⁽⁴⁾(ξ)</td></tr>
      <tr><th scope="row">Error compuesto</th><td>−(b − a)/12 · h² · f″(ξ)</td><td>−(b − a)/180 · h⁴ · f⁽⁴⁾(ξ)</td><td>−(b − a)/80 · h⁴ · f⁽⁴⁾(ξ)</td></tr>
      <tr><th scope="row">Orden del error</th><td>h²</td><td>h⁴</td><td>h⁴</td></tr>
    </tbody>
  </table>
  </div>
  <ul>
    <li><strong>Mismo orden.</strong> Con el mismo h, la 1/3 y la 3/8 son de orden h⁴: duplicar n baja el error unas 16 veces en las dos.</li>
    <li><strong>Más exacta por tramo.</strong> Sobre un mismo intervalo [a, b], la regla simple 3/8 comete un error 2.25 veces
    menor que la 1/3 (6480 contra 2880 en el denominador), pero usa un punto más: 4 en lugar de 3.</li>
    <li><strong>Con el mismo h, la compuesta 1/3 gana.</strong> Cada tramo 3/8 es más largo (3h contra 2h) y la
    constante por unidad de longitud es 1/80 contra 1/180. Por eso, si n es par, la 1/3 es la opción por defecto.</li>
    <li><strong>Cuándo conviene la 3/8.</strong> Cuando n es múltiplo de 3 y sobre todo si es impar (3, 9, 15, …), donde la 1/3 no se
    puede usar, y combinada con ella para cualquier n impar desde 5.</li>
  </ul>
  <p class="campo-ayuda">En esta tabla n cuenta subintervalos de ancho h, como en las fórmulas. El método «Simpson»
  del aplicativo sigue el material del docente, que además usa el punto medio de cada subintervalo, y por eso su n
  no coincide con el de «Simpson 1/3»: con n par, «Simpson» con n da lo mismo que «Simpson 1/3» con 2n (n = 4 o más).</p>
</section>

<section aria-labelledby="teo-conclusiones">
  <h3 id="teo-conclusiones">Ventajas, desventajas y conclusiones</h3>
  <h4>Ventajas</h4>
  <ul>
    <li>Con la misma malla es mucho más exacta que el Trapecio: error de orden h⁴ en lugar de h², y exacta hasta cúbicas.</li>
    <li>Cubre los n que Simpson 1/3 no admite: sola, con n = 3, 6, 9, …, y combinada con la 1/3, con cualquier n de 5 en adelante
    (salvo 4).</li>
    <li>Los pesos son enteros pequeños (1, 3, 3, 2, 3, 3, …, 1), así que el corchete se arma y se revisa a mano.</li>
  </ul>
  <h4>Desventajas</h4>
  <ul>
    <li>Exige distancias h iguales y, sola, un n múltiplo de 3; con otro n hay que combinarla con la 1/3.</li>
    <li>Con el mismo h su error es unas 2.25 veces el de Simpson 1/3 (80 contra 180 en el denominador) y gasta un punto más por
    tramo sin ganar orden.</li>
    <li>Pide f suave: con f⁽⁴⁾ no acotada converge lento.</li>
  </ul>
  <h4>Para cerrar la exposición</h4>
  <ul>
    <li>La idea en una frase: una cúbica por cada tres subintervalos, integrada exactamente, que deja los pesos 1, 3, 3, 2, 3, 3, …, 3, 3, 1 y el factor 3h/8.</li>
    <li>Con un n que no es múltiplo de 3 se combina con la regla 1/3, cada una con su corchete y su factor.</li>
    <li>Se puede verificar en vivo: con cualquier cúbica (ejemplos «exacto») el resultado coincide con la primitiva, y duplicar n baja el error unas 16 veces.</li>
  </ul>
</section>
`;

// --------------------------------------------------- ajuste por minimos cuadrados

const sig = mo("∑");
const yi = sub(mi("y"), i);
const xiTeo = nodo(i);
const suma2 = (t) => fila(sig, sup(t, mn("2")));
const msqrt = (t) => `<msqrt>${t}</msqrt>`;
const logTeo = (t) => fila(mi("log"), t);

const MC_PIEZAS = mat(
  fila(mi("N"), mo("="), n, sig, xiTeo, yi, mo("−"), sig, xiTeo, sig, yi),
  fila(sub(mi("D"), x), mo("="), n, suma2(xiTeo), mo("−"), sup(paren(sig, xiTeo), mn("2"))),
  fila(sub(mi("D"), mi("y")), mo("="), n, suma2(yi), mo("−"), sup(paren(sig, yi), mn("2"))),
);

const MC_FORMULAS = mat(
  fila(mi("m"), mo("="), frac(mi("N"), sub(mi("D"), x))),
  fila(mi("b"), mo("="), frac(fila(sig, yi, mo("−"), mi("m"), sig, xiTeo), n)),
  fila(mi("r"), mo("="), frac(mi("N"), msqrt(fila(sub(mi("D"), x), sub(mi("D"), mi("y")))))),
);

const MC_NORMALES = mat(
  fila(mi("m"), suma2(xiTeo), mo("+"), mi("b"), sig, xiTeo, mo("="), sig, xiTeo, yi),
  fila(mi("m"), sig, xiTeo, mo("+"), n, mi("b"), mo("="), sig, yi),
);

const MC_DOCENTE = mat(
  fila(mi("m"), mo("="), frac(fila(mn("5"), mo("·"), mn("44.95"), mo("−"), mn("10"), mo("·"), mn("20.1")),
    fila(mn("5"), mo("·"), mn("22.5"), mo("−"), sup(mn("10"), mn("2")))), mo("="), frac(mn("23.75"), mn("12.5")), mo("="), mn("1.90")),
  fila(mi("b"), mo("="), frac(fila(mn("20.1"), mo("−"), mn("1.9"), mo("·"), mn("10")), mn("5")), mo("="), mn("0.22")),
  fila(mi("r"), mo("="), frac(mn("23.75"), msqrt(fila(mn("12.5"), mo("·"), mn("45.34")))), mo("≈"), mn("0.9976")),
);

const MC_MODELOS = mat(
  fila(mtext("potencial:"), separa, mi("y"), mo("="), mi("b"), sup(x, mi("m")), mo("⇒"), separa,
    logTeo(mi("y")), mo("="), mi("m"), logTeo(x), mo("+"), logTeo(mi("b"))),
  fila(mtext("exponencial:"), separa, mi("y"), mo("="), mi("b"), sup(mi("e"), fila(mi("m"), x)), mo("⇒"), separa,
    logTeo(mi("y")), mo("="), paren(mi("m"), logTeo(mi("e"))), x, mo("+"), logTeo(mi("b"))),
  fila(mtext("logarítmica:"), separa, mi("y"), mo("="), mi("m"), logTeo(x), mo("+"), mi("b")),
);

const MINIMOS_CUADRADOS = `
<section aria-labelledby="teo-mc-definicion">
  <h3 id="teo-mc-definicion">Qué resuelve</h3>
  <p>Cuando se miden datos (xᵢ, yᵢ) con error, no existe una recta que pase por todos los puntos. El
  <strong>ajuste por mínimos cuadrados</strong> busca la recta y = m x + b que <em>mejor</em> los representa: la que
  hace mínima la suma de los cuadrados de los residuos dᵢ = m xᵢ + b − yᵢ, es decir, de las distancias verticales
  entre cada dato y la recta.</p>
  <p>Hay que hallar dos números, m (la pendiente) y b (la ordenada al origen). Al derivar la suma de cuadrados
  respecto de m y de b e igualar a cero salen las dos ecuaciones normales:</p>
  ${MC_NORMALES}
</section>

<section aria-labelledby="teo-mc-formulas">
  <h3 id="teo-mc-formulas">Fórmulas</h3>
  <p>Resolviendo las dos ecuaciones normales, con n datos y las sumas de la tabla:</p>
  ${MC_PIEZAS}
  ${MC_FORMULAS}
  <p>La tabla del docente tiene una columna para cada suma: xᵢ, yᵢ, xᵢyᵢ, xᵢ², yᵢ² y el error (m xᵢ + b − yᵢ)².
  La fila <strong>Total</strong> da las sumas que entran en las fórmulas, y el total de la columna de error es la suma
  de cuadrados mínima.</p>
</section>

<section aria-labelledby="teo-mc-r">
  <h3 id="teo-mc-r">Cómo leer r</h3>
  <p>El coeficiente de correlación r mide qué tan alineados están los datos y siempre queda entre −1 y 1:</p>
  <ul>
    <li><strong>r = 1</strong>: correlación perfecta y directa (todos los puntos sobre una recta que sube).</li>
    <li><strong>r = −1</strong>: correlación perfecta e inversa (sobre una recta que baja).</li>
    <li><strong>r = 0</strong>: no hay correlación: los datos no siguen ninguna recta.</li>
  </ul>
  <p>El signo de r es el de la pendiente m. Cuanto más cerca de ±1, mejor describe la recta a los datos.
  Si todas las y son iguales, r no está definida (el aplicativo lo avisa).</p>
</section>

<section aria-labelledby="teo-mc-modelos">
  <h3 id="teo-mc-modelos">Modelos que no son rectas</h3>
  <p>El potencial, el exponencial y el logarítmico se <strong>linealizan</strong> con logaritmos en base 10 y
  se ajusta una recta a los datos transformados; después se deshace la transformación para hallar m y b:</p>
  ${MC_MODELOS}
  <ul>
    <li><strong>Potencial:</strong> la pendiente de la recta es m y su ordenada es log b, así que b = 10 elevado a la ordenada.</li>
    <li><strong>Exponencial:</strong> la pendiente de la recta es m·log e, así que m = pendiente / log e; y b = 10 elevado a la ordenada.</li>
    <li><strong>Logarítmica:</strong> solo se transforma x; m y b son los de la recta.</li>
  </ul>
  <p class="teo-nota"><strong>Condición:</strong> el log solo existe para positivos. El potencial pide x &gt; 0 e y &gt; 0,
  el exponencial y &gt; 0 y el logarítmico x &gt; 0. En estos modelos la tabla muestra los datos transformados, y r y la suma
  de cuadrados se miden sobre la recta ajustada a ellos.</p>
</section>

<section aria-labelledby="teo-mc-pasos">
  <h3 id="teo-mc-pasos">Pasos</h3>
  <ol>
    <li>Armar la tabla con xᵢ, yᵢ, xᵢyᵢ, xᵢ² e yᵢ² (y, si el modelo lo pide, transformar los datos antes).</li>
    <li>Sumar cada columna: la fila Total.</li>
    <li>Calcular m con N y Dₓ, y después b.</li>
    <li>Calcular r con N, Dₓ y D<sub>y</sub> para juzgar el ajuste.</li>
    <li>Escribir la ecuación y evaluarla en el x que se pida.</li>
  </ol>
</section>

<section aria-labelledby="teo-mc-ejemplo">
  <h3 id="teo-mc-ejemplo">Ejemplo del docente</h3>
  <p>Con los puntos (1, 2), (1.5, 3.2), (2, 4.1), (2.5, 4.9) y (3, 5.9), la fila Total da n = 5, Σx = 10, Σy = 20.1,
  Σxy = 44.95, Σx² = 22.5 y Σy² = 89.87:</p>
  ${MC_DOCENTE}
  <p>La recta es y = 1.9x + 0.22 y los errores (m xᵢ + b − yᵢ)² son 0.0144, 0.0169, 0.0064, 0.0049 y 0.0004, que suman
  0.0430. Se puede cargar con el ejercicio «Docente · cinco puntos, recta y correlación» y comparar con la tabla.</p>
</section>
`;

const TEORIAS = { "simpson-38": SIMPSON_38, "minimos-cuadrados": MINIMOS_CUADRADOS };

// HTML de la explicacion del metodo, o null si todavia no la tiene.
export function teoriaPara(slug) {
  return TEORIAS[slug] ?? null;
}
