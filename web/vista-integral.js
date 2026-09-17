// Vista previa de la integral definida, construida automaticamente a partir
// de los valores del formulario del metodo del Punto Medio.
//
// El signo de integral no se puede tipear en un teclado normal, y ademas es
// una notacion que combina simbolo, limites superior e inferior, integrando
// y "dx". Este modulo la arma sola con lo que hay en pantalla, y ademas
// ofrece una paleta con los simbolos matematicos mas dificiles de escribir
// (integral, pi, raiz cuadrada, potencias 2 y 3) que se insertan en la
// casilla activa donde este el cursor.
//
// Vive fuera de forms.js porque los formularios se dibujan genericos: no
// tienen que saber que un metodo puntual pinta arriba un preview de su
// notacion.

// Simbolos que ofrece la paleta. Cada uno lleva el texto que se inserta en
// la casilla y una etiqueta accesible. El signo de integral se inserta
// **fuera** de la expresion, envolviendola: no forma parte del integrando
// que el nucleo evalua, pero el docente lo usa para escribir la formula.
const SIMBOLOS = [
  { texto: "^",  etiqueta: "elevar a una potencia (potencia)" },
  { texto: "*",  etiqueta: "multiplicar" },
  { texto: "pi", etiqueta: "el numero pi" },
  { texto: "sqrt(", etiqueta: "raiz cuadrada, abre parentesis" },
  { texto: "exp(", etiqueta: "exponencial, abre parentesis" },
  { texto: "sin(", etiqueta: "seno, abre parentesis" },
  { texto: "cos(", etiqueta: "coseno, abre parentesis" },
  { texto: "ln(",  etiqueta: "logaritmo natural, abre parentesis" },
];


export function montarVistaIntegral(contenedor, formulario) {
  contenedor.innerHTML = "";
  contenedor.className = "vista-integral";

  const titulo = document.createElement("p");
  titulo.className = "vista-integral-titulo";
  titulo.textContent = "Integral que vas a resolver";
  contenedor.append(titulo);

  const formula = document.createElement("div");
  formula.className = "integral-formula";
  formula.setAttribute("aria-live", "polite");
  formula.setAttribute("aria-label", "Vista previa de la integral");
  contenedor.append(formula);

  // La paleta va debajo, chiquita: son atajos, no un teclado matematico
  // completo. La idea es que ∫ y sqrt esten a un clic, no obligar al alumno
  // a copiarlos de otra parte.
  const paleta = document.createElement("div");
  paleta.className = "paleta-simbolos";
  paleta.setAttribute("role", "toolbar");
  paleta.setAttribute("aria-label", "Simbolos matematicos");

  const ayuda = document.createElement("span");
  ayuda.className = "paleta-ayuda";
  ayuda.textContent = "Insertar en f(x):";
  paleta.append(ayuda);

  for (const simbolo of SIMBOLOS) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton-simbolo";
    boton.textContent = simbolo.texto;
    boton.setAttribute("aria-label", simbolo.etiqueta);
    boton.title = simbolo.etiqueta;
    boton.addEventListener("mousedown", (e) => e.preventDefault());
    boton.addEventListener("click", () => insertarEnFx(simbolo.texto));
    paleta.append(boton);
  }
  contenedor.append(paleta);

  const redibujar = () => actualizar(formula, formulario);
  redibujar();

  // Actualiza al vuelo cada vez que el alumno tipea en cualquier casilla del
  // formulario. Como el formulario se redibuja al elegir otro metodo, este
  // listener se pega al contenedor del formulario, no a las casillas.
  formulario.contenedor.addEventListener("input", redibujar);

  return { redibujar };
}


function insertarEnFx(texto) {
  const campo = document.querySelector('#campo-fx');
  if (!campo) return;
  // Con focus/setRangeText el texto entra donde esta el cursor y no al final,
  // que es como se comporta cualquier editor y evita perder lo escrito.
  campo.focus();
  const inicio = campo.selectionStart ?? campo.value.length;
  const fin = campo.selectionEnd ?? campo.value.length;
  campo.setRangeText(texto, inicio, fin, "end");
  campo.dispatchEvent(new Event("input", { bubbles: true }));
}


function actualizar(formula, formulario) {
  formula.innerHTML = "";

  const valores = leerSinFallar(formulario);
  const a = valores.a;
  const b = valores.b;
  const fx = valores.fx;

  // Simbolo integral gigante. Se usa el caracter unicode ∫ porque cualquier
  // fuente lo tiene: no hay que embeber ninguna, y el aplicativo tiene que
  // andar sin internet.
  const integral = document.createElement("span");
  integral.className = "integral-simbolo";
  integral.textContent = "∫";

  const limites = document.createElement("span");
  limites.className = "integral-limites";
  const sup = document.createElement("span");
  sup.className = "integral-superior";
  sup.textContent = formatearLimite(b);
  const inf = document.createElement("span");
  inf.className = "integral-inferior";
  inf.textContent = formatearLimite(a);
  limites.append(sup, inf);

  const integrando = document.createElement("span");
  integrando.className = "integral-integrando";
  integrando.textContent = fx ? envolverSiHaceFalta(fx) : "f(x)";

  const dx = document.createElement("span");
  dx.className = "integral-dx";
  dx.textContent = "dx";

  formula.append(integral, limites, integrando, dx);
}


// Los limites se muestran con hasta cuatro decimales para que un −1.5 se lea
// bonito, pero un valor sin escribir todavia queda como "?" en vez de "NaN".
function formatearLimite(valor) {
  if (valor === null || valor === undefined || valor === "") return "?";
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return String(valor);
  // Numero pequeno o entero: sin decimales.
  if (Number.isInteger(numero)) return String(numero);
  return Number.parseFloat(numero.toFixed(4)).toString();
}


// Si el integrando ya viene entre parentesis, no los duplicamos. Si tiene
// signos +/− fuera de parentesis, los agregamos para que la formula se lea
// como una unica integral y no dos terminos sueltos multiplicados por dx.
function envolverSiHaceFalta(texto) {
  const limpio = texto.trim();
  if (!limpio) return "f(x)";
  if (limpio.startsWith("(") && limpio.endsWith(")")) return limpio;
  if (/[+\-]/.test(limpio.slice(1))) return `(${limpio})`;
  return limpio;
}


// Lee los valores de forma tolerante: para el preview no queremos que un
// campo vacio tumbe la vista, solo mostrar los que si estan.
function leerSinFallar(formulario) {
  const salida = {};
  for (const campo of formulario.campos) {
    const nombre = campo.definicion.name;
    try {
      const valor = campo.leer();
      if (valor !== null && valor !== undefined && valor !== "") {
        salida[nombre] = valor;
      }
    } catch { /* campo incompleto: no aparece en el preview */ }
  }
  return salida;
}
