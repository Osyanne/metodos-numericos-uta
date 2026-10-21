// Recorrido de las iteraciones: la unica pieza que sabe en que fila (k) esta
// el usuario y la que lleva el temporizador de reproduccion.
//
// No dibuja nada fuera de su barra. El plano, la tabla, la franja y la formula
// se enteran por `alCambiar(k, porUsuario)` y no se conocen entre si. `k` es la
// posicion de la fila (0..N-1); lo que se rotula es `fila.n`, como la tabla.
// `porUsuario` es false solo al cargar un resultado nuevo: ahi la animacion de
// entrada del plano tiene que seguir. Al ocultar se avisa con k = null.

import { ICONOS } from "./iconos.js";

// Entre pasos: 8 s repartidos entre las filas, acotado para que ni se arrastre
// con pocas filas ni se vuelva ilegible con muchas.
const intervaloPara = (N) => Math.min(800, Math.max(120, 8000 / N));

export function montarRecorrido({ raiz, alCambiar }) {
  const $ = (sel) => raiz.querySelector(sel);
  const deslizador = $("#paso");
  const rotulo = $("#paso-rotulo");
  const reproducir = $("#paso-reproducir");
  // Se silencia mientras corre la reproduccion: leer cada fila en voz alta
  // la volveria ininteligible.
  const franja = document.getElementById("fila-actual");

  let filas = [];
  let nombre = "";
  let k = 0;
  let temporizador = null;

  const rotularReproducir = (corriendo) => {
    const icono = document.createElement("span");
    icono.dataset.icono = corriendo ? "player-pause" : "player-play";
    icono.innerHTML = ICONOS[icono.dataset.icono];
    reproducir.replaceChildren(icono);
    reproducir.setAttribute("aria-label", corriendo ? "Pausar" : "Reproducir");
    franja?.setAttribute("aria-live", corriendo ? "off" : "polite");
  };

  const detener = () => {
    clearInterval(temporizador);
    temporizador = null;
    rotularReproducir(false);
  };

  const mover = (destino, porUsuario) => {
    k = Math.max(0, Math.min(filas.length - 1, destino));
    const texto = `${nombre} ${filas[k].n} de ${filas.at(-1).n}`;
    deslizador.value = k;
    rotulo.textContent = texto;
    deslizador.setAttribute("aria-valuetext", texto);
    alCambiar(k, porUsuario);
  };

  // Un control del usuario: detiene la reproduccion y mueve.
  const ir = (destino) => {
    if (!filas.length) return;
    detener();
    mover(destino, true);
  };

  const alternar = () => {
    if (temporizador !== null) return detener();
    if (!filas.length) return;
    // Desde el final, vuelve a empezar.
    if (k >= filas.length - 1) mover(0, true);
    rotularReproducir(true);
    temporizador = setInterval(() => {
      mover(k + 1, true);
      if (k >= filas.length - 1) detener();
    }, intervaloPara(filas.length));
  };

  $("#paso-primero").addEventListener("click", () => ir(0));
  $("#paso-anterior").addEventListener("click", () => ir(k - 1));
  reproducir.addEventListener("click", alternar);
  $("#paso-siguiente").addEventListener("click", () => ir(k + 1));
  $("#paso-ultimo").addEventListener("click", () => ir(filas.length - 1));
  deslizador.addEventListener("input", () => ir(Number(deslizador.value)));

  rotularReproducir(false);

  return {
    // Un resultado nuevo deja k en la ultima fila. Con una sola fila no hay
    // nada que recorrer: la barra no aparece.
    cargar(nuevas, rotuloPaso) {
      detener();
      filas = nuevas;
      nombre = rotuloPaso;
      deslizador.max = Math.max(0, filas.length - 1);
      raiz.hidden = filas.length < 2;
      if (filas.length) mover(filas.length - 1, false);
    },
    ir,
    ocultar() {
      detener();
      raiz.hidden = true;
      filas = [];
      alCambiar(null, false);
    },
    get k() {
      return k;
    },
    // Hay un resultado cargado (la barra puede estar oculta si solo tiene una fila).
    get activo() {
      return filas.length > 0;
    },
  };
}
