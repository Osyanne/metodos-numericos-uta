// Plano cartesiano interactivo sobre Canvas.
//
// No es una imagen: tiene ejes, cuadricula, zoom con la rueda y paneo
// arrastrando, como GeoGebra. Al cambiar la vista, las curvas que vienen de una
// expresion se recalculan pidiendole puntos nuevos al nucleo; las que son
// puntos discretos (una solucion de EDO, una curva de convergencia) solo se
// reescalan, porque no hay mas resolucion que obtener sin volver a resolver.

const COLORES = [
  "--serie-1", "--serie-2", "--serie-3", "--serie-4", "--serie-5", "--serie-6",
];

const MARGEN = { izq: 56, der: 16, arriba: 16, abajo: 34 };
const ESPERA_REMUESTREO = 150;

// Zoom proporcional a cuanto giro la rueda, no un salto fijo por evento.
// Un mouse manda un evento por muesca, con deltaY cerca de 100; un trackpad
// manda decenas de eventos por gesto, con deltaY de 3 o 4. Con un factor fijo
// el trackpad multiplicaba el zoom una vez por evento y se volvia inmanejable.
const SENSIBILIDAD = 0.0012;   // exp(100 * 0.0012) = 1.13 por muesca de mouse
const FACTOR_MAX = 1.15;       // tope por evento, para que nada pegue un salto
const ANCHO_MINIMO = 1e-9;     // mas cerca, los flotantes dejan de distinguir
const ANCHO_MAXIMO = 1e12;

// Duracion de la animacion inicial del dibujo, en milisegundos. Un valor mas
// bajo se siente instantaneo; uno mas alto empieza a impacientar al usuario
// que ya vio el resultado y quiere mover el plano. Con 2000 ms la animacion
// se lee comoda: se ve caer cada iteracion o crecer cada rectangulo sin
// tener que pestanear, y sigue siendo cancelable con cualquier interaccion.
const DURACION_ANIMACION = 2000;

// Un clic mueve menos de UMBRAL_CLIC px entre bajar y soltar; un punto es
// elegible a menos de RADIO_ELEGIR px del puntero.
const UMBRAL_CLIC = 4;
const RADIO_ELEGIR = 12;

// Un asa se toma a menos de RADIO_ASA px (con el dedo, RADIO_ASA_TACTIL). Se
// dibuja con radio 6, y con 8 la que esta bajo el puntero o se arrastra.
const RADIO_ASA = 12;
const RADIO_ASA_TACTIL = 20;
// Opacidad de lo atenuado: la misma que lo tenue del recorrido.
const ALFA_TENUE = 0.25;

export class Plano {
  constructor(canvas, { alMuestrear, alElegir } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.alMuestrear = alMuestrear;
    this.alElegir = alElegir;

    this.capas = [];
    this.resample = null;
    this.vista = { x0: -5, x1: 5, y0: -5, y1: 5 };
    this.vistaInicial = { ...this.vista };
    this.cursor = null;
    // Fila elegida del recorrido (o null: se dibuja todo). Ver marcarPaso.
    this.paso = null;
    // Capa extra encima de todas, sin `aparece` (el termino de Lagrange). Ver ponerTermino.
    this.termino = null;
    // Datos del problema que se pueden arrastrar (ver ponerAsas) y el asa que
    // esta bajo el puntero o se arrastra, que se dibuja mas grande.
    this.asas = null;
    this.asaActiva = null;
    // Con true las capas se dibujan tenues: el ultimo dibujo valido mientras el
    // nucleo rechaza el valor que se esta arrastrando.
    this.atenuado = false;
    this.temporizador = null;
    this.versionMuestreo = 0;
    // Estado de la animacion en curso. `progreso` va de 0 a 1: al llegar a 1
    // el plano queda como si no hubiera animacion, y desde entonces cada
    // repintado dibuja las capas enteras. Cualquier interaccion la cancela.
    this.animacion = { rafId: null, inicio: 0, progreso: 1 };

    this._conectar();
    this._ajustarTamano();
    new ResizeObserver(() => this._ajustarTamano()).observe(canvas.parentElement);
  }

  // ---------------------------------------------------------------- datos

  // capas: [{tipo, nombre, xs, ys, puntos, color}]
  // resample: {expression, variables, domain} o null
  // opciones: { animar } — animar el trazado por defecto, salvo cuando el
  //           dibujo viene de un remuestreo (ahi ya se vio la animacion).
  //           { conservarVista } — ni encuadrar ni animar: el resultado nuevo
  //           de un dato que se esta arrastrando, sobre la vista que ya se mira.
  mostrar(capas, resample = null, etiquetas = {}, opciones = {}) {
    this._invalidarRemuestreo();
    this.paso = null;
    this.termino = null;
    this.capas = capas.map((c, i) => ({ color: COLORES[i % COLORES.length], ...c }));
    this.resample = resample;
    this.etiquetas = { x: "x", y: "y", ...etiquetas };
    if (opciones.conservarVista) {
      this._cancelarAnimacion();
      this._pintar();
      this._pedirRemuestreo();
      return;
    }
    this.encuadrar();
    if (opciones.animar !== false) this._iniciarAnimacion();
  }

  // capa: { tipo: "asas", asas: [{ id, x, y, eje: "x" | "xy", etiqueta }] } o
  // null. Va aparte de las capas: un resultado nuevo no la borra.
  ponerAsas(capa) {
    this.asas = capa;
    this._pintar();
  }

  atenuar(activo) {
    this.atenuado = activo;
    this._pintar();
  }

  // Donde esta dibujada el asa `id`, en pixeles CSS del lienzo, o null si no
  // existe o cae fuera del area. Un asa de eje x va sobre y = 0, o pegada al
  // borde de arriba o de abajo cuando el 0 no esta a la vista.
  posicionAsa(id) {
    const asa = this.asas?.asas.find((a) => a.id === id);
    if (!asa) return null;
    const v = this.vista;
    const y = asa.eje === "x" ? Math.min(Math.max(0, v.y0), v.y1) : asa.y;
    if (!Number.isFinite(asa.x) || !Number.isFinite(y)) return null;
    const [px, py] = this._aPantalla(asa.x, y);
    const a = this._area;
    // 1 px de holgura: un asa pegada al borde cae justo en el limite del area.
    if (px < a.izq - 1 || px > a.der + 1 || py < a.arriba - 1 || py > a.abajo + 1) return null;
    return [px, py];
  }

  // El asa mas cercana a (px, py) dentro del radio de captura, o null.
  asaEn(px, py, tactil = false) {
    let mejor = null;
    let distMejor = tactil ? RADIO_ASA_TACTIL : RADIO_ASA;
    for (const asa of this.asas?.asas ?? []) {
      const pos = this.posicionAsa(asa.id);
      if (!pos) continue;
      const d = Math.hypot(pos[0] - px, pos[1] - py);
      if (d < distMejor) { distMejor = d; mejor = asa.id; }
    }
    return mejor;
  }

  // Dibuja hasta la fila k: lo que aparece antes va normal, lo de la fila k
  // resaltado y lo posterior tenue. null vuelve a dibujar todo como siempre.
  marcarPaso(k) {
    this.paso = k;
    this._pintar();
  }

  // Capa extra que se dibuja encima de las demas; null la quita.
  ponerTermino(capa) {
    this.termino = capa ? { color: "--iteraciones", ...capa } : null;
    this._pintar();
  }

  // Estado de dibujo del elemento i de una capa segun el paso. Una capa sin
  // `aparece` (o sin paso elegido) se dibuja siempre normal.
  _estado(capa, i) {
    const fila = capa.aparece?.[i];
    if (this.paso == null || fila == null) return "normal";
    return fila === this.paso ? "actual" : fila > this.paso ? "tenue" : "normal";
  }

  // Halo que rodea el punto de la fila actual sin tocarlo: 4 px mas que el
  // radio del punto.
  _anillo(px, py, radio) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = this._color("--iteraciones");
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, radio + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Arranca la animacion de entrada: `progreso` sube de 0 a 1 a lo largo de
  // DURACION_ANIMACION. En cada frame se llama _pintar(), que lee el
  // progreso y dibuja solo la porcion correspondiente de cada capa.
  _iniciarAnimacion() {
    this._cancelarAnimacion();
    this.animacion.progreso = 0;
    this.animacion.inicio = performance.now();
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - this.animacion.inicio) / DURACION_ANIMACION);
      // Ease-out cubico: arranca rapido y termina suave, se ve mas fluido que
      // el lineal y no da la sensacion de "cortarse" al llegar al final.
      this.animacion.progreso = 1 - Math.pow(1 - t, 3);
      this._pintar();
      if (t < 1) {
        this.animacion.rafId = requestAnimationFrame(paso);
      } else {
        this.animacion.rafId = null;
        this.animacion.progreso = 1;
      }
    };
    this.animacion.rafId = requestAnimationFrame(paso);
  }

  // Corta la animacion de entrada: la llama quien mueve el paso a mano.
  cortarAnimacion() {
    if (this.animacion.progreso >= 1) return;
    this._cancelarAnimacion();
    this._pintar();
  }

  _cancelarAnimacion() {
    if (this.animacion.rafId != null) {
      cancelAnimationFrame(this.animacion.rafId);
      this.animacion.rafId = null;
    }
    this.animacion.progreso = 1;
  }

  limpiar() {
    this._invalidarRemuestreo();
    this.paso = null;
    this.termino = null;
    this.capas = [];
    this.resample = null;
    this.cursor = null;
    this.asas = null;
    this.asaActiva = null;
    this.atenuado = false;
    this._pintar();
  }

  // Encuadra la vista sobre todo lo que hay, con un margen del 10 %.
  encuadrar() {
    this._invalidarRemuestreo();
    const xs = [];
    const ys = [];
    for (const capa of this.capas) {
      for (const x of capa.xs ?? []) if (Number.isFinite(x)) xs.push(x);
      for (const y of capa.ys ?? []) if (Number.isFinite(y)) ys.push(y);
      for (const p of capa.puntos ?? []) {
        if (Number.isFinite(p.x)) xs.push(p.x);
        if (Number.isFinite(p.y)) ys.push(p.y);
      }
      // Las aproximaciones de integracion tambien tienen que caber en el
      // encuadre inicial, o el usuario ve una vista vacia hasta hacer zoom.
      for (const r of capa.rectangulos ?? []) {
        if (Number.isFinite(r.x0)) xs.push(r.x0);
        if (Number.isFinite(r.x1)) xs.push(r.x1);
        if (Number.isFinite(r.y)) {
          ys.push(r.y);
          ys.push(0);
        }
      }
      for (const t of capa.trapecios ?? []) {
        if (Number.isFinite(t.x0)) xs.push(t.x0);
        if (Number.isFinite(t.x1)) xs.push(t.x1);
        if (Number.isFinite(t.y0)) ys.push(t.y0);
        if (Number.isFinite(t.y1)) ys.push(t.y1);
        ys.push(0);
      }
      // shortcut: encuadra por los tres puntos de cada arco; el vertice de un
      // arco muy curvo puede quedar un poco afuera. Si molesta, sumar el vertice.
      for (const p of capa.parabolas ?? []) {
        if (Number.isFinite(p.x0)) xs.push(p.x0);
        if (Number.isFinite(p.x1)) xs.push(p.x1);
        for (const y of [p.y0, p.ym, p.y1]) if (Number.isFinite(y)) ys.push(y);
        ys.push(0);
      }
    }
    if (!xs.length || !ys.length) {
      this.vista = { x0: -5, x1: 5, y0: -5, y1: 5 };
    } else {
      const [xmin, xmax] = [Math.min(...xs), Math.max(...xs)];
      const [ymin, ymax] = [Math.min(...ys), Math.max(...ys)];
      const mx = Math.max((xmax - xmin) * 0.1, 0.5);
      const my = Math.max((ymax - ymin) * 0.1, 0.5);
      this.vista = { x0: xmin - mx, x1: xmax + mx, y0: ymin - my, y1: ymax + my };
    }
    this.vistaInicial = { ...this.vista };
    this._pintar();
  }

  reiniciarVista() {
    this.vista = { ...this.vistaInicial };
    this._pintar();
    this._pedirRemuestreo();
  }

  // ---------------------------------------------------- coordenadas

  get _area() {
    return {
      izq: MARGEN.izq,
      der: this.ancho - MARGEN.der,
      arriba: MARGEN.arriba,
      abajo: this.alto - MARGEN.abajo,
    };
  }

  _aPantalla(x, y) {
    const a = this._area;
    const v = this.vista;
    return [
      a.izq + ((x - v.x0) / (v.x1 - v.x0)) * (a.der - a.izq),
      a.abajo - ((y - v.y0) / (v.y1 - v.y0)) * (a.abajo - a.arriba),
    ];
  }

  _aMundo(px, py) {
    const a = this._area;
    const v = this.vista;
    return [
      v.x0 + ((px - a.izq) / (a.der - a.izq)) * (v.x1 - v.x0),
      v.y0 + ((a.abajo - py) / (a.abajo - a.arriba)) * (v.y1 - v.y0),
    ];
  }

  // ---------------------------------------------------- interaccion

  // Fila del recorrido a la que pertenece lo que hay bajo (px, py), en pixeles
  // CSS del lienzo: primero el punto mas cercano a menos de RADIO_ELEGIR; si no
  // hay, el rectangulo, trapecio o parabola cuya franja [x0, x1] contiene el x.
  indiceEn(px, py) {
    let mejor = null;
    let distMejor = RADIO_ELEGIR;
    for (const capa of this.capas) {
      if (!capa.aparece) continue;
      // Puntos, marcas y los vertices de una curva con un punto por fila (EDO).
      const puntos = capa.tipo === "curva"
        ? capa.xs.map((x, i) => ({ x, y: capa.ys[i] }))
        : capa.tipo === "puntos" || capa.tipo === "marcas" ? capa.puntos : [];
      puntos.forEach((p, i) => {
        // Un valor que no es finito (metodo que diverge) no tiene lugar en el plano.
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        const [qx, qy] = this._aPantalla(p.x, p.y);
        const d = Math.hypot(qx - px, qy - py);
        if (d < distMejor) { distMejor = d; mejor = capa.aparece[i]; }
      });
    }
    if (mejor !== null) return mejor;
    const [wx] = this._aMundo(px, py);
    for (const capa of this.capas) {
      if (!capa.aparece) continue;
      const franjas = capa.rectangulos ?? capa.trapecios ?? capa.parabolas;
      const i = franjas?.findIndex((f) => wx >= Math.min(f.x0, f.x1) && wx <= Math.max(f.x0, f.x1));
      if (i >= 0) return capa.aparece[i];
    }
    return null;
  }

  _conectar() {
    const c = this.canvas;
    c.tabIndex = 0;
    c.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown + - Home");

    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      // Cualquier interaccion corta la animacion: si el usuario ya esta
      // moviendo el plano es porque ya vio suficiente y quiere manipularlo.
      this._cancelarAnimacion();
      const [mx, my] = this._posicion(e);
      const [wx, wy] = this._aMundo(mx, my);
      const factor = this._factorZoom(e);
      // El zoom se centra en el cursor, no en el origen.
      this._zoom(factor, wx, wy);
    }, { passive: false });

    c.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const v = this.vista;
      if (["+", "=", "-", "−"].includes(e.key)) {
        e.preventDefault();
        this._cancelarAnimacion();
        const factor = e.key === "+" || e.key === "=" ? 1 / FACTOR_MAX : FACTOR_MAX;
        this._zoom(factor, (v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2);
      } else if (e.key === "Home") {
        e.preventDefault();
        this._cancelarAnimacion();
        this.reiniciarVista();
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        this._cancelarAnimacion();
        const dx = (v.x1 - v.x0) * 0.1 * (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0);
        const dy = (v.y1 - v.y0) * 0.1 * (e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0);
        this.vista = { x0: v.x0 + dx, x1: v.x1 + dx, y0: v.y0 + dy, y1: v.y1 + dy };
        this.cursor = null;
        this._pintar();
        this._pedirRemuestreo();
      }
    });

    let arrastrando = null;
    c.addEventListener("pointerdown", (e) => {
      this._cancelarAnimacion();
      this._invalidarRemuestreo();
      c.focus({ preventScroll: true });
      arrastrando = { ...this._posicionObj(e), vista: { ...this.vista } };
      c.setPointerCapture(e.pointerId);
      c.classList.add("arrastrando");
    });

    c.addEventListener("pointermove", (e) => {
      const [px, py] = this._posicion(e);
      this.cursor = this._aMundo(px, py);
      if (arrastrando) {
        const a = this._area;
        const v = arrastrando.vista;
        const dx = ((px - arrastrando.x) / (a.der - a.izq)) * (v.x1 - v.x0);
        const dy = ((py - arrastrando.y) / (a.abajo - a.arriba)) * (v.y1 - v.y0);
        this.vista = {
          x0: v.x0 - dx, x1: v.x1 - dx,
          y0: v.y0 + dy, y1: v.y1 + dy,
        };
      }
      this._pintar();
    });

    const soltar = (e) => {
      if (!arrastrando) return;
      const inicio = arrastrando;
      arrastrando = null;
      c.classList.remove("arrastrando");
      this._pedirRemuestreo();
      // Un clic (casi sin mover) con un paso elegido pasa a ese elemento. Solo
      // el boton principal: el derecho abre el menu y el del medio hace scroll.
      if (e.type !== "pointerup" || e.button !== 0 || this.paso === null || !this.alElegir) return;
      const [px, py] = this._posicion(e);
      if (Math.hypot(px - inicio.x, py - inicio.y) >= UMBRAL_CLIC) return;
      const k = this.indiceEn(px, py);
      if (k !== null) this.alElegir(k);
    };
    c.addEventListener("pointerup", soltar);
    c.addEventListener("pointercancel", soltar);
    c.addEventListener("pointerleave", () => { this.cursor = null; this._pintar(); });

    c.addEventListener("dblclick", () => {
      this._cancelarAnimacion();
      this.reiniciarVista();
    });
  }

  _zoom(factor, wx, wy) {
    const v = this.vista;
    const fueraDeRango = (n) => !Number.isFinite(n) || n < ANCHO_MINIMO || n > ANCHO_MAXIMO;
    if (fueraDeRango((v.x1 - v.x0) * factor) || fueraDeRango((v.y1 - v.y0) * factor)) return;
    this.vista = {
      x0: wx + (v.x0 - wx) * factor,
      x1: wx + (v.x1 - wx) * factor,
      y0: wy + (v.y0 - wy) * factor,
      y1: wy + (v.y1 - wy) * factor,
    };
    this.cursor = null;
    this._pintar();
    this._pedirRemuestreo();
  }

  // deltaMode dice en que unidad viene deltaY: 0 pixeles, 1 lineas, 2 paginas.
  // Firefox suele mandar lineas donde Chrome manda pixeles, y sin normalizar
  // el mismo gesto zoomea muy distinto en cada navegador.
  _factorZoom(e) {
    const escala = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const factor = Math.exp(e.deltaY * escala * SENSIBILIDAD);
    return Math.min(FACTOR_MAX, Math.max(1 / FACTOR_MAX, factor));
  }

  _posicion(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  _posicionObj(e) {
    const [x, y] = this._posicion(e);
    return { x, y };
  }

  // Pide puntos nuevos para el rango visible, pero solo si la curva viene de
  // una expresion. Se espera a que el usuario deje de moverse, y se pide mas
  // ancho que lo visible para que un paneo chico no dispare otra peticion.
  _invalidarRemuestreo() {
    clearTimeout(this.temporizador);
    this.temporizador = null;
    this.versionMuestreo += 1;
  }

  _pedirRemuestreo() {
    // Se invalida al mover la vista, antes del debounce: una petición en vuelo
    // tampoco debe pintar durante la espera del siguiente muestreo.
    this._invalidarRemuestreo();
    if (!this.resample || !this.alMuestrear) return;
    const version = this.versionMuestreo;
    const curva = this.capas.find((c) => c.tipo === "curva");
    if (!curva) return;
    const v = { ...this.vista };
    const ancho = v.x1 - v.x0;
    const peticion = {
      expression: this.resample.expression,
      variables: this.resample.variables ?? ["x"],
      x_min: v.x0 - ancho * 0.5,
      x_max: v.x1 + ancho * 0.5,
      points: 600,
    };
    this.temporizador = setTimeout(async () => {
      this.temporizador = null;
      const puntos = await this.alMuestrear(peticion);
      if (!puntos || version !== this.versionMuestreo) return;
      curva.xs = puntos.x;
      curva.ys = puntos.y;
      this._pintar();
    }, ESPERA_REMUESTREO);
  }

  // ---------------------------------------------------- dibujo

  _ajustarTamano() {
    const dpr = window.devicePixelRatio || 1;
    const caja = this.canvas.parentElement;
    // clientWidth excluye el borde. El canvas debe caber también cuando el
    // panel tiene menos de 320 px disponibles o vuelve de una pestaña oculta.
    if (!caja.clientWidth || !caja.clientHeight) return;
    this.ancho = caja.clientWidth;
    this.alto = caja.clientHeight;
    this.canvas.width = this.ancho * dpr;
    this.canvas.height = this.alto * dpr;
    this.canvas.style.width = `${this.ancho}px`;
    this.canvas.style.height = `${this.alto}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._pintar();
  }

  // Vuelve a dibujar con los colores vigentes: al cambiar el tema cambian
  // las variables de CSS, no las capas.
  repintar() {
    this._pintar();
  }

  _color(nombre) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(nombre).trim() || "#888";
  }

  _pintar() {
    const { ctx } = this;
    if (!this.ancho) return;
    ctx.clearRect(0, 0, this.ancho, this.alto);
    this._ejes();
    this._conAlfa(this.atenuado ? ALFA_TENUE : 1, () => {
      // Las areas de integracion se dibujan primero para que la curva y las
      // marcas queden encima, no tapadas por su relleno semitransparente.
      for (const capa of this.capas) {
        if (capa.tipo === "rectangulos") this._rectangulos(capa);
        else if (capa.tipo === "trapecios") this._trapecios(capa);
        else if (capa.tipo === "parabolas") this._parabolas(capa);
      }
      for (const capa of this.capas) {
        if (capa.tipo === "curva") this._curva(capa);
        else if (capa.tipo === "segmentos") this._segmentos(capa);
        else if (capa.tipo === "puntos") this._puntos(capa);
        else if (capa.tipo === "marcas") this._marcas(capa);
      }
      if (this.termino) this._curva(this.termino);
    });
    this._asas();
    this._coordenadas();
  }

  // Dibuja con una opacidad comun. Cada capa fija su propio globalAlpha, asi
  // que con alfa < 1 se dibujan en un lienzo aparte que se compone una vez.
  _conAlfa(alfa, dibujar) {
    if (alfa === 1) {
      dibujar();
      return;
    }
    const aparte = (this._lienzoAparte ??= document.createElement("canvas"));
    aparte.width = this.canvas.width;
    aparte.height = this.canvas.height;
    const ctx = this.ctx;
    this.ctx = aparte.getContext("2d");
    this.ctx.setTransform(ctx.getTransform());
    try {
      dibujar();
    } finally {
      this.ctx = ctx;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alfa;
    ctx.drawImage(aparte, 0, 0);
    ctx.restore();
  }

  _asas() {
    if (!this.asas) return;
    const { ctx } = this;
    // --accent cambia con la familia en <body>: se lee del canvas, no de :root.
    const estilo = getComputedStyle(this.canvas);
    const color = (nombre) => estilo.getPropertyValue(nombre).trim() || "#888";
    ctx.save();
    ctx.font = "11px ui-monospace, Consolas, monospace";
    for (const asa of this.asas.asas) {
      const pos = this.posicionAsa(asa.id);
      if (!pos) continue;
      const [px, py] = pos;
      ctx.beginPath();
      ctx.arc(px, py, asa.id === this.asaActiva ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = color("--accent");
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color("--surface");
      ctx.stroke();
      ctx.fillStyle = color("--ink");
      ctx.fillText(asa.etiqueta, px + 8, py - 8);
    }
    ctx.restore();
  }

  // Escala "bonita": 1, 2 o 5 por decada, para que las marcas caigan en
  // numeros que una persona pueda leer.
  _paso(rango, objetivo) {
    const bruto = rango / objetivo;
    const magnitud = Math.pow(10, Math.floor(Math.log10(bruto)));
    const norm = bruto / magnitud;
    const paso = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return paso * magnitud;
  }

  _formatear(valor, paso) {
    const dec = Math.max(0, Math.min(8, -Math.floor(Math.log10(paso))));
    return Math.abs(valor) < paso / 1000 ? "0" : valor.toFixed(dec);
  }

  _ejes() {
    const { ctx } = this;
    const a = this._area;
    const v = this.vista;
    const tinta = this._color("--ink");
    const suave = this._color("--rule");
    const tenue = this._color("--ink-faint");

    ctx.save();
    ctx.beginPath();
    ctx.rect(a.izq, a.arriba, a.der - a.izq, a.abajo - a.arriba);
    ctx.clip();

    const pasoX = this._paso(v.x1 - v.x0, 8);
    const pasoY = this._paso(v.y1 - v.y0, 6);

    ctx.strokeStyle = suave;
    ctx.lineWidth = 1;
    ctx.font = "11px ui-monospace, Consolas, monospace";
    ctx.fillStyle = tenue;

    for (let x = Math.ceil(v.x0 / pasoX) * pasoX; x <= v.x1; x += pasoX) {
      const [px] = this._aPantalla(x, 0);
      ctx.beginPath();
      ctx.moveTo(px, a.arriba);
      ctx.lineTo(px, a.abajo);
      ctx.stroke();
    }
    for (let y = Math.ceil(v.y0 / pasoY) * pasoY; y <= v.y1; y += pasoY) {
      const [, py] = this._aPantalla(0, y);
      ctx.beginPath();
      ctx.moveTo(a.izq, py);
      ctx.lineTo(a.der, py);
      ctx.stroke();
    }

    // Los ejes se dibujan en su posicion real, y se pegan al borde cuando el
    // origen queda fuera de la vista, para no perder la referencia.
    ctx.strokeStyle = tinta;
    ctx.lineWidth = 1.5;
    const [, pyCero] = this._aPantalla(0, 0);
    const [pxCero] = this._aPantalla(0, 0);
    const ejeY = Math.min(Math.max(pyCero, a.arriba), a.abajo);
    const ejeX = Math.min(Math.max(pxCero, a.izq), a.der);
    ctx.beginPath();
    ctx.moveTo(a.izq, ejeY);
    ctx.lineTo(a.der, ejeY);
    ctx.moveTo(ejeX, a.arriba);
    ctx.lineTo(ejeX, a.abajo);
    ctx.stroke();
    ctx.restore();

    // Numeros, fuera del area recortada.
    ctx.fillStyle = tenue;
    ctx.font = "11px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let x = Math.ceil(v.x0 / pasoX) * pasoX; x <= v.x1; x += pasoX) {
      const [px] = this._aPantalla(x, 0);
      if (px < a.izq - 1 || px > a.der + 1) continue;
      ctx.fillText(this._formatear(x, pasoX), px, a.abajo + 6);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = Math.ceil(v.y0 / pasoY) * pasoY; y <= v.y1; y += pasoY) {
      const [, py] = this._aPantalla(0, y);
      if (py < a.arriba - 1 || py > a.abajo + 1) continue;
      ctx.fillText(this._formatear(y, pasoY), a.izq - 8, py);
    }
  }

  _curva(capa) {
    const { ctx } = this;
    const a = this._area;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.izq, a.arriba, a.der - a.izq, a.abajo - a.arriba);
    ctx.clip();

    ctx.strokeStyle = this._color(capa.color);
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    // La curva se revela por SEGMENTO, no por punto entero. Es especialmente
    // importante para Runge-Kutta: una EDO solo tiene un punto por paso y con
    // cinco pasos hay seis puntos. Revelar solo los primeros puntos convertia
    // dos segundos de animacion en cinco saltos visibles. El ultimo segmento
    // se interpola solo para pintar; los datos del resultado siguen siendo
    // exactamente los puntos discretos que calculo el metodo.
    const total = Math.min(capa.xs.length, capa.ys.length);
    const posicion = Math.max(
      0,
      Math.min(total - 1, (total - 1) * this.animacion.progreso),
    );
    const ultimoCompleto = Math.floor(posicion);
    const fraccion = posicion - ultimoCompleto;

    // Con paso elegido la polilinea se parte en `corte`, el ultimo punto que ya
    // aparecio: hasta ahi va normal, de ahi en adelante tenue.
    let corte = total - 1;
    if (capa.aparece && this.paso != null) {
      corte = -1;
      for (let i = 0; i < total; i++) if (capa.aparece[i] <= this.paso) corte = i;
    }

    let dibujando = false;
    let ultimoY = null;
    const trazar = (x, y) => {
      // Un null es un hueco del dominio: la linea se CORTA. Si se uniera,
      // 1/x saldria con una raya vertical falsa cruzando la asintota.
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        dibujando = false;
        ultimoY = null;
        return;
      }
      const [px, py] = this._aPantalla(x, y);
      // Un salto enorme entre puntos vecinos tambien es una asintota.
      if (dibujando && Math.abs(py - ultimoY) > (a.abajo - a.arriba) * 4) {
        dibujando = false;
      }
      if (!dibujando) {
        ctx.moveTo(px, py);
        dibujando = true;
      } else {
        ctx.lineTo(px, py);
      }
      ultimoY = py;
    };

    // El ultimo tramo crece de forma continua entre dos pasos. No se dibuja
    // si cruza una discontinuidad: en ese caso, como antes, queda un hueco.
    const crecer = () => {
      if (!(fraccion > 0 && ultimoCompleto < total - 1)) return;
      const x0 = capa.xs[ultimoCompleto];
      const y0 = capa.ys[ultimoCompleto];
      const x1 = capa.xs[ultimoCompleto + 1];
      const y1 = capa.ys[ultimoCompleto + 1];
      if ([x0, y0, x1, y1].every(Number.isFinite)) {
        const [, py0] = this._aPantalla(x0, y0);
        const [, py1] = this._aPantalla(x1, y1);
        if (Math.abs(py1 - py0) <= (a.abajo - a.arriba) * 4) {
          trazar(x0 + (x1 - x0) * fraccion, y0 + (y1 - y0) * fraccion);
        }
      }
    };

    // Un trazo con los puntos desde..hasta (incluidos). Si llega al ultimo
    // punto revelado, agrega el tramo que sigue creciendo.
    const trazo = (desde, hasta, alfa) => {
      dibujando = false;
      ultimoY = null;
      ctx.globalAlpha = alfa;
      ctx.beginPath();
      for (let i = Math.max(0, desde); i <= Math.min(hasta, ultimoCompleto); i++) {
        trazar(capa.xs[i], capa.ys[i]);
      }
      if (desde <= ultimoCompleto && hasta >= ultimoCompleto) crecer();
      ctx.stroke();
    };

    trazo(0, corte, 1);
    if (corte < total - 1) trazo(corte, total, 0.25);
    // Punto de la fila actual en curvas con un punto por fila (EDO).
    const actual = capa.aparece?.indexOf(this.paso) ?? -1;
    if (this.paso != null && actual >= 0 && actual <= ultimoCompleto
        && Number.isFinite(capa.xs[actual]) && Number.isFinite(capa.ys[actual])) {
      this._anillo(...this._aPantalla(capa.xs[actual], capa.ys[actual]), 4);
    }
    ctx.restore();
  }

  _puntos(capa) {
    const { ctx } = this;
    const a = this._area;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.izq, a.arriba, a.der - a.izq, a.abajo - a.arriba);
    ctx.clip();
    ctx.fillStyle = this._color(capa.color);
    // Durante la animacion los puntos (raiz, dato, evaluado) aparecen en la
    // segunda mitad, con un pequeno "pop" que agranda el radio de 0 al final.
    // Antes del 50 % no se ven: primero se traza la curva.
    const t = Math.max(0, (this.animacion.progreso - 0.5) * 2);
    if (t <= 0) { ctx.restore(); return; }
    const factor = 1 - Math.pow(1 - t, 2);
    capa.puntos.forEach((p, i) => {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      const estado = this._estado(capa, i);
      const [px, py] = this._aPantalla(p.x, p.y);
      ctx.globalAlpha = estado === "tenue" ? 0.25 : 1;
      ctx.beginPath();
      ctx.arc(px, py, (capa.radio ?? 4) * factor, 0, Math.PI * 2);
      ctx.fill();
      if (estado === "actual") this._anillo(px, py, capa.radio ?? 4);
    });
    ctx.restore();
  }

  _rectangulos(capa) {
    // Los rectangulos del metodo del Punto Medio: cada uno va de x0 a x1
    // y su altura es f(m_i). Se pintan con relleno semitransparente y borde
    // solido para que la curva de f se vea encima y quede claro cuanto sub-
    // o sobreestima cada barra el area real.
    //
    // Durante la animacion aparecen de izquierda a derecha: los primeros
    // `hasta` se ven completos, el siguiente entra "creciendo" en altura
    // desde el eje x hasta f(m_i) para que se note el trazado.
    const { ctx } = this;
    const a = this._area;
    if (!capa.rectangulos?.length) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.izq, a.arriba, a.der - a.izq, a.abajo - a.arriba);
    ctx.clip();
    ctx.strokeStyle = this._color(capa.color);
    ctx.lineWidth = 1;

    const total = capa.rectangulos.length;
    const posicion = total * this.animacion.progreso;
    const enteros = Math.floor(posicion);
    const fraccion = posicion - enteros;

    for (let i = 0; i < total; i++) {
      const r = capa.rectangulos[i];
      if (![r.x0, r.x1, r.y].every(Number.isFinite)) continue;
      if (i > enteros) break;
      const factor = i < enteros ? 1 : fraccion;
      if (factor <= 0) continue;
      const estado = this._estado(capa, i);
      const alfa = estado === "tenue" ? 0.25 : 1;
      const alturaEfectiva = r.y * factor;
      const [px0, py0] = this._aPantalla(r.x0, 0);
      const [px1, py1] = this._aPantalla(r.x1, alturaEfectiva);
      const x = Math.min(px0, px1);
      const w = Math.abs(px1 - px0);
      const y = Math.min(py0, py1);
      const h = Math.abs(py1 - py0);
      ctx.fillStyle = this._color(capa.color);
      ctx.globalAlpha = (r.y >= 0 ? 0.16 : 0.10) * alfa;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = alfa;
      ctx.lineWidth = estado === "actual" ? 2 : 1;
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }

  _trapecios(capa) {
    // La Regla del Trapecio aproxima f por la recta que une los dos extremos
    // de cada subintervalo. La figura sombreada tiene que ser un trapecio,
    // no un rectangulo: de otro modo la grafica estaria mostrando otro metodo.
    const { ctx } = this;
    const a = this._area;
    if (!capa.trapecios?.length) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.izq, a.arriba, a.der - a.izq, a.abajo - a.arriba);
    ctx.clip();
    ctx.strokeStyle = this._color(capa.color);
    ctx.lineWidth = 1;

    const total = capa.trapecios.length;
    const posicion = total * this.animacion.progreso;
    const enteros = Math.floor(posicion);
    const fraccion = posicion - enteros;

    for (let i = 0; i < total; i++) {
      const t = capa.trapecios[i];
      if (![t.x0, t.y0, t.x1, t.y1].every(Number.isFinite)) continue;
      if (i > enteros) break;
      const factor = i < enteros ? 1 : fraccion;
      if (factor <= 0) continue;
      const estado = this._estado(capa, i);
      const alfa = estado === "tenue" ? 0.25 : 1;
      const y0 = t.y0 * factor;
      const y1 = t.y1 * factor;
      const [px0, pyBase] = this._aPantalla(t.x0, 0);
      const [px1] = this._aPantalla(t.x1, 0);
      const [, py0] = this._aPantalla(t.x0, y0);
      const [, py1] = this._aPantalla(t.x1, y1);

      // Cuando el segmento cruza el eje x, se dibujan dos triangulos. Un solo
      // poligono se cruzaria a si mismo y Canvas rellenaria una region ambigua.
      const cruzaCero = y0 * y1 < 0;
      if (cruzaCero) {
        const proporcion = Math.abs(y0) / (Math.abs(y0) + Math.abs(y1));
        const pxCero = px0 + (px1 - px0) * proporcion;
        this._rellenarTrapecio([[px0, pyBase], [px0, py0], [pxCero, pyBase]], y0, alfa);
        this._rellenarTrapecio([[pxCero, pyBase], [px1, py1], [px1, pyBase]], y1, alfa);
      } else {
        this._rellenarTrapecio(
          [[px0, pyBase], [px0, py0], [px1, py1], [px1, pyBase]],
          y0 || y1,
          alfa,
        );
      }

      // El borde superior es la recta aproximante que define la regla.
      ctx.globalAlpha = alfa;
      ctx.lineWidth = estado === "actual" ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(px0, pyBase);
      ctx.lineTo(px0, py0);
      ctx.lineTo(px1, py1);
      ctx.lineTo(px1, pyBase);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  _parabolas(capa) {
    // Simpson aproxima f por la parabola que pasa por los extremos y el punto
    // medio de cada subintervalo. Se sombrea el area entre ese arco y el eje,
    // apareciendo de izquierda a derecha como los trapecios.
    const { ctx } = this;
    const a = this._area;
    if (!capa.parabolas?.length) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.izq, a.arriba, a.der - a.izq, a.abajo - a.arriba);
    ctx.clip();
    ctx.strokeStyle = this._color(capa.color);
    ctx.fillStyle = this._color(capa.color);
    ctx.lineWidth = 1;

    const total = capa.parabolas.length;
    const posicion = total * this.animacion.progreso;
    const enteros = Math.floor(posicion);
    const fraccion = posicion - enteros;
    const [, pyBase] = this._aPantalla(0, 0);

    for (let i = 0; i < total; i++) {
      if (i > enteros) break;
      const factor = i < enteros ? 1 : fraccion;
      if (factor <= 0) continue;
      const p = capa.parabolas[i];
      const estado = this._estado(capa, i);
      const alfa = estado === "tenue" ? 0.25 : 1;
      if (![p.x0, p.y0, p.xm, p.ym, p.x1, p.y1].every(Number.isFinite)) continue;
      const [px0, py0] = this._aPantalla(p.x0, p.y0 * factor);
      const [pxm, pym] = this._aPantalla(p.xm, p.ym * factor);
      const [px1, py1] = this._aPantalla(p.x1, p.y1 * factor);

      // El arco es exactamente una Bezier cuadratica: con xm en el medio, el
      // control 2*m - (inicio + fin)/2 la hace pasar por los tres puntos. El
      // navegador la traza nitida a cualquier zoom, sin muestrearla.
      const region = new Path2D();
      region.moveTo(px0, pyBase);
      region.lineTo(px0, py0);
      region.quadraticCurveTo(2 * pxm - (px0 + px1) / 2, 2 * pym - (py0 + py1) / 2, px1, py1);
      region.lineTo(px1, pyBase);
      region.closePath();

      // Arriba del eje el relleno es mas intenso que abajo, como en los
      // trapecios. Recortar por semiplano evita partir la region a mano
      // cuando el arco cruza el eje.
      for (const [y, alto, relleno] of [
        [a.arriba, pyBase - a.arriba, 0.16 * alfa],
        [pyBase, a.abajo - pyBase, 0.10 * alfa],
      ]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(a.izq, y, a.der - a.izq, alto);
        ctx.clip();
        ctx.globalAlpha = relleno;
        ctx.fill(region);
        ctx.restore();
      }
      ctx.globalAlpha = alfa;
      ctx.lineWidth = estado === "actual" ? 2 : 1;
      ctx.stroke(region);
    }
    ctx.restore();
  }

  _rellenarTrapecio(puntos, altura, alfa = 1) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(...puntos[0]);
    for (const punto of puntos.slice(1)) ctx.lineTo(...punto);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.globalAlpha = (altura >= 0 ? 0.16 : 0.10) * alfa;
    ctx.fill();
  }

  _marcas(capa) {
    const { ctx } = this;
    const a = this._area;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.izq, a.arriba, a.der - a.izq, a.abajo - a.arriba);
    ctx.clip();
    ctx.font = "10px ui-monospace, Consolas, monospace";
    // Las marcas (iteraciones de Newton-Raphson, puntos medios y puntos de
    // particion de las reglas de integracion) aparecen una por una: primero
    // i=1, despues i=2, etc. Es el
    // efecto que hace visible el "recorrido" del metodo, no solo el
    // resultado final.
    const total = capa.puntos.length;
    const hasta = Math.ceil(total * this.animacion.progreso);
    for (let i = 0; i < Math.min(total, hasta); i++) {
      const p = capa.puntos[i];
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const estado = this._estado(capa, i);
      const [px, py] = this._aPantalla(p.x, p.y);
      ctx.globalAlpha = estado === "tenue" ? 0.25 : 1;
      ctx.strokeStyle = this._color(capa.color);
      ctx.fillStyle = this._color(capa.color);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.stroke();
      if (p.etiqueta !== undefined) {
        ctx.fillText(p.etiqueta, px + 6, py - 6);
      }
      if (estado === "actual") this._anillo(px, py, 3);
    }
    ctx.restore();
  }

  // Segmentos sueltos (la tangente de cada iteracion): de (x0, y0) a (x1, y1).
  _segmentos(capa) {
    const { ctx } = this;
    const a = this._area;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.izq, a.arriba, a.der - a.izq, a.abajo - a.arriba);
    ctx.clip();
    ctx.strokeStyle = this._color(capa.color);
    // Aparecen uno por uno durante la animacion inicial, como las marcas.
    const total = capa.segmentos.length;
    const hasta = Math.ceil(total * this.animacion.progreso);
    for (let i = 0; i < Math.min(total, hasta); i++) {
      const s = capa.segmentos[i];
      if (![s.x0, s.y0, s.x1, s.y1].every(Number.isFinite)) continue;
      const estado = this._estado(capa, i);
      ctx.globalAlpha = estado === "tenue" ? 0.25 : 1;
      ctx.lineWidth = estado === "actual" ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(...this._aPantalla(s.x0, s.y0));
      ctx.lineTo(...this._aPantalla(s.x1, s.y1));
      ctx.stroke();
    }
    ctx.restore();
  }

  _coordenadas() {
    if (!this.cursor) return;
    const { ctx } = this;
    const a = this._area;
    const texto = `x = ${this.cursor[0].toPrecision(6)}   y = ${this.cursor[1].toPrecision(6)}`;
    ctx.font = "11px ui-monospace, Consolas, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    const ancho = ctx.measureText(texto).width + 12;
    ctx.fillStyle = this._color("--surface");
    ctx.globalAlpha = 0.9;
    ctx.fillRect(a.der - ancho, a.arriba + 2, ancho, 18);
    ctx.globalAlpha = 1;
    ctx.fillStyle = this._color("--ink-faint");
    ctx.fillText(texto, a.der - 6, a.arriba + 6);
  }
}

// Traduce un plot del contrato a las capas que este plano sabe dibujar.
// Con `filas` (las iteraciones del resultado) cada capa dice en que fila
// aparece cada uno de sus elementos (`aparece`); sin ellas se dibuja todo.
export function capasDesdePlot(plot, filas = []) {
  if (!plot) return { capas: [], resample: null };
  const s = plot.series ?? {};
  const N = filas.length;
  // aparece(cantidad, fila): fila(i) = fila en que aparece el elemento i.
  const aparece = (cantidad, fila = (i) => i) =>
    (N ? { aparece: Array.from({ length: cantidad }, (_, i) => fila(i)) } : {});

  if (plot.kind === "funcion_raiz") {
    const capas = [{ tipo: "curva", nombre: "f(x)", color: "--curva", xs: s.curve.x, ys: s.curve.y }];
    if (s.iterates?.length) {
      // Un segmento por fila, de (xi, f(xi)) a (xi_sig, 0): la tangente en
      // Newton-Raphson, la paralela a la primera en Von Mises.
      const segmentos = [];
      const filaDe = [];
      filas.forEach((f, i) => {
        const { xi, fxi, xi_sig: sig } = f.values ?? {};
        if (!Number.isFinite(sig)) return;
        segmentos.push({ x0: xi, y0: fxi, x1: sig, y1: 0 });
        filaDe.push(i);
      });
      if (segmentos.length) {
        capas.push({
          // Sin `nombre`: no entra en la leyenda, el punto de cada fila ya la explica.
          tipo: "segmentos", color: "--iteraciones",
          segmentos, ...aparece(segmentos.length, (i) => filaDe[i]),
        });
      }
      capas.push({
        tipo: "marcas",
        nombre: "iteraciones",
        color: "--iteraciones",
        puntos: s.iterates.map((it) => ({ x: it.x, y: it.y, etiqueta: it.n })),
        ...aparece(s.iterates.length),
      });
    }
    if (s.root) {
      capas.push({
        tipo: "puntos", nombre: "raiz", color: "--raiz",
        radio: 5, puntos: [{ x: s.root.x, y: s.root.y }],
        ...aparece(1, () => N - 1),
      });
    }
    return { capas, resample: plot.resample ?? null };
  }

  if (plot.kind === "interpolacion") {
    const capas = [{ tipo: "curva", nombre: "polinomio", color: "--curva", xs: s.curve.x, ys: s.curve.y }];
    capas.push({
      tipo: "puntos", nombre: "datos", color: "--datos",
      puntos: (s.points ?? []).map(([x, y]) => ({ x, y })),
      ...aparece((s.points ?? []).length),
    });
    if (s.evaluated) {
      capas.push({
        tipo: "puntos", nombre: "evaluado", color: "--raiz",
        radio: 5, puntos: [s.evaluated],
        ...aparece(1, () => N - 1),
      });
    }
    return { capas, resample: plot.resample ?? null };
  }

  if (plot.kind === "convergencia") {
    return {
      capas: [{ tipo: "curva", nombre: "error", xs: s.n, ys: s.error }],
      resample: null,
    };
  }

  if (plot.kind === "solucion_edo") {
    const capas = (s.solution?.components ?? []).map((c) => ({
      tipo: "curva", nombre: c.name, xs: s.solution.x, ys: c.y,
      ...aparece(s.solution.x.length),
    }));
    for (const c of s.exact?.components ?? []) {
      capas.push({ tipo: "curva", nombre: `${c.name} exacta`, xs: s.exact.x, ys: c.y });
    }
    return { capas, resample: null };
  }

  if (plot.kind === "integracion") {
    // Punto Medio pinta rectangulos, Trapecio las rectas entre puntos de
    // particion y Simpson los arcos de parabola. La curva real va encima.
    const capas = [];
    if ((s.rectangles ?? []).length) {
      capas.push({
        tipo: "rectangulos",
        nombre: "rectangulos",
        color: "--area",
        rectangulos: s.rectangles ?? [],
        ...aparece(s.rectangles.length),
      });
    }
    if ((s.trapezoids ?? []).length) {
      capas.push({
        tipo: "trapecios",
        nombre: "trapecios",
        color: "--area",
        trapecios: s.trapezoids ?? [],
        // el trapecio j termina en la fila j+1
        ...aparece(s.trapezoids.length, (i) => i + 1),
      });
    }
    if ((s.parabolas ?? []).length) {
      capas.push({
        tipo: "parabolas",
        nombre: "parabolas",
        color: "--area",
        parabolas: s.parabolas,
        // la parabola j termina en la fila 2j+2
        ...aparece(s.parabolas.length, (i) => 2 * i + 2),
      });
    }
    capas.push({
      tipo: "curva",
      nombre: "f(x)",
      color: "--curva",
      xs: s.curve?.x ?? [],
      ys: s.curve?.y ?? [],
    });
    const marcas = (s.rectangles ?? []).map((r, i) => ({
      x: (r.x0 + r.x1) / 2,
      y: r.y,
      etiqueta: String(i + 1),
    }));
    if (marcas.length) {
      capas.push({
        tipo: "marcas",
        nombre: "puntos medios",
        color: "--iteraciones",
        puntos: marcas,
        ...aparece(marcas.length),
      });
    }
    const trapecios = s.trapezoids ?? [];
    const puntosParticion = [];
    if (trapecios.length) {
      const primero = trapecios[0];
      puntosParticion.push({ x: primero.x0, y: primero.y0, etiqueta: "x0" });
      for (let i = 0; i < trapecios.length; i++) {
        const t = trapecios[i];
        puntosParticion.push({ x: t.x1, y: t.y1, etiqueta: `x${i + 1}` });
      }
      capas.push({
        tipo: "marcas",
        nombre: "puntos de particion",
        color: "--iteraciones",
        puntos: puntosParticion,
        ...aparece(puntosParticion.length),
      });
    }
    const parabolas = s.parabolas ?? [];
    if (parabolas.length) {
      // Mismos nombres que la columna "punto" de la tabla: x0, m1, x1, ...
      const puntos = [{ x: parabolas[0].x0, y: parabolas[0].y0, etiqueta: "x0" }];
      parabolas.forEach((p, i) => {
        puntos.push({ x: p.xm, y: p.ym, etiqueta: `m${i + 1}` });
        puntos.push({ x: p.x1, y: p.y1, etiqueta: `x${i + 1}` });
      });
      capas.push({
        tipo: "marcas",
        nombre: "puntos de Simpson",
        color: "--iteraciones",
        puntos,
        ...aparece(puntos.length),
      });
    }
    return { capas, resample: plot.resample ?? null };
  }

  return { capas: [], resample: null };
}
