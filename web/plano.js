// Plano cartesiano interactivo sobre Canvas.
//
// No es una imagen: tiene ejes, cuadricula, zoom con la rueda y paneo
// arrastrando, como GeoGebra. Al cambiar la vista, las curvas que vienen de una
// expresion se recalculan pidiendole puntos nuevos al nucleo; las que son
// puntos discretos (una solucion de EDO, una curva de convergencia) solo se
// reescalan, porque no hay mas resolucion que obtener sin volver a resolver.

const COLORES = [
  "#0e6e63", "#b4531a", "#3b4e9e", "#7a3b7e", "#4a7c1f", "#9b372b",
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

export class Plano {
  constructor(canvas, { alMuestrear } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.alMuestrear = alMuestrear;

    this.capas = [];
    this.resample = null;
    this.vista = { x0: -5, x1: 5, y0: -5, y1: 5 };
    this.vistaInicial = { ...this.vista };
    this.cursor = null;
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
  mostrar(capas, resample = null, etiquetas = {}, opciones = {}) {
    this._invalidarRemuestreo();
    this.capas = capas.map((c, i) => ({ color: COLORES[i % COLORES.length], ...c }));
    this.resample = resample;
    this.etiquetas = { x: "x", y: "y", ...etiquetas };
    this.encuadrar();
    if (opciones.animar !== false) this._iniciarAnimacion();
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

  _cancelarAnimacion() {
    if (this.animacion.rafId != null) {
      cancelAnimationFrame(this.animacion.rafId);
      this.animacion.rafId = null;
    }
    this.animacion.progreso = 1;
  }

  limpiar() {
    this._invalidarRemuestreo();
    this.capas = [];
    this.resample = null;
    this.cursor = null;
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
      // Los rectangulos del Punto Medio tambien tienen que caber en el
      // encuadre inicial, o el usuario ve una vista vacia hasta hacer zoom.
      for (const r of capa.rectangulos ?? []) {
        if (Number.isFinite(r.x0)) xs.push(r.x0);
        if (Number.isFinite(r.x1)) xs.push(r.x1);
        if (Number.isFinite(r.y)) {
          ys.push(r.y);
          ys.push(0);
        }
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
      arrastrando = null;
      c.classList.remove("arrastrando");
      this._pedirRemuestreo();
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

  _color(nombre) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(nombre).trim() || "#888";
  }

  _pintar() {
    const { ctx } = this;
    if (!this.ancho) return;
    ctx.clearRect(0, 0, this.ancho, this.alto);
    this._ejes();
    // Los rectangulos se dibujan primero para que la curva y las marcas
    // queden encima, no tapadas por su relleno semitransparente.
    for (const capa of this.capas) {
      if (capa.tipo === "rectangulos") this._rectangulos(capa);
    }
    for (const capa of this.capas) {
      if (capa.tipo === "curva") this._curva(capa);
      else if (capa.tipo === "puntos") this._puntos(capa);
      else if (capa.tipo === "marcas") this._marcas(capa);
    }
    this._coordenadas();
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

    ctx.strokeStyle = capa.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();

    // Durante la animacion la curva se traza progresivamente de izquierda a
    // derecha: solo se dibujan los primeros `hasta` puntos. Con progreso 1
    // (fuera de animacion) se dibuja entera. Se usa Math.ceil para que el
    // primer frame de la animacion muestre al menos un punto y no un canvas
    // vacio, que se veria como un parpadeo.
    const total = capa.xs.length;
    const hasta = Math.max(2, Math.ceil(total * this.animacion.progreso));

    let dibujando = false;
    for (let i = 0; i < Math.min(total, hasta); i++) {
      const y = capa.ys[i];
      // Un null es un hueco del dominio: la linea se CORTA. Si se uniera,
      // 1/x saldria con una raya vertical falsa cruzando la asintota.
      if (y === null || y === undefined || !Number.isFinite(y)) {
        dibujando = false;
        continue;
      }
      const [px, py] = this._aPantalla(capa.xs[i], y);
      // Un salto enorme entre puntos vecinos tambien es una asintota.
      if (dibujando && Math.abs(py - this._ultimoY) > (a.abajo - a.arriba) * 4) {
        dibujando = false;
      }
      if (!dibujando) {
        ctx.moveTo(px, py);
        dibujando = true;
      } else {
        ctx.lineTo(px, py);
      }
      this._ultimoY = py;
    }
    ctx.stroke();
    ctx.restore();
  }

  _puntos(capa) {
    const { ctx } = this;
    const a = this._area;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.izq, a.arriba, a.der - a.izq, a.abajo - a.arriba);
    ctx.clip();
    ctx.fillStyle = capa.color;
    // Durante la animacion los puntos (raiz, dato, evaluado) aparecen en la
    // segunda mitad, con un pequeno "pop" que agranda el radio de 0 al final.
    // Antes del 50 % no se ven: primero se traza la curva.
    const t = Math.max(0, (this.animacion.progreso - 0.5) * 2);
    if (t <= 0) { ctx.restore(); return; }
    const factor = 1 - Math.pow(1 - t, 2);
    for (const p of capa.puntos) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const [px, py] = this._aPantalla(p.x, p.y);
      ctx.beginPath();
      ctx.arc(px, py, (capa.radio ?? 4) * factor, 0, Math.PI * 2);
      ctx.fill();
    }
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
    ctx.strokeStyle = capa.color;
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
      const alturaEfectiva = r.y * factor;
      const [px0, py0] = this._aPantalla(r.x0, 0);
      const [px1, py1] = this._aPantalla(r.x1, alturaEfectiva);
      const x = Math.min(px0, px1);
      const w = Math.abs(px1 - px0);
      const y = Math.min(py0, py1);
      const h = Math.abs(py1 - py0);
      ctx.fillStyle = capa.color;
      ctx.globalAlpha = r.y >= 0 ? 0.16 : 0.10;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }

  _marcas(capa) {
    const { ctx } = this;
    const a = this._area;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.izq, a.arriba, a.der - a.izq, a.abajo - a.arriba);
    ctx.clip();
    ctx.font = "10px ui-monospace, Consolas, monospace";
    // Las marcas (iteraciones de Newton-Raphson, puntos medios del Punto
    // Medio) aparecen una por una: primero i=1, despues i=2, etc. Es el
    // efecto que hace visible el "recorrido" del metodo, no solo el
    // resultado final.
    const total = capa.puntos.length;
    const hasta = Math.ceil(total * this.animacion.progreso);
    for (let i = 0; i < Math.min(total, hasta); i++) {
      const p = capa.puntos[i];
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const [px, py] = this._aPantalla(p.x, p.y);
      ctx.strokeStyle = capa.color;
      ctx.fillStyle = capa.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.stroke();
      if (p.etiqueta !== undefined) {
        ctx.fillText(p.etiqueta, px + 6, py - 6);
      }
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
export function capasDesdePlot(plot) {
  if (!plot) return { capas: [], resample: null };
  const s = plot.series ?? {};

  if (plot.kind === "funcion_raiz") {
    const capas = [{ tipo: "curva", nombre: "f(x)", xs: s.curve.x, ys: s.curve.y }];
    if (s.iterates?.length) {
      capas.push({
        tipo: "marcas",
        nombre: "iteraciones",
        color: "#b4531a",
        puntos: s.iterates.map((it) => ({ x: it.x, y: it.y, etiqueta: it.n })),
      });
    }
    if (s.root) {
      capas.push({
        tipo: "puntos", nombre: "raiz", color: "#9b372b",
        radio: 5, puntos: [{ x: s.root.x, y: s.root.y }],
      });
    }
    return { capas, resample: plot.resample ?? null };
  }

  if (plot.kind === "interpolacion") {
    const capas = [{ tipo: "curva", nombre: "polinomio", xs: s.curve.x, ys: s.curve.y }];
    capas.push({
      tipo: "puntos", nombre: "datos", color: "#3b4e9e",
      puntos: (s.points ?? []).map(([x, y]) => ({ x, y })),
    });
    if (s.evaluated) {
      capas.push({
        tipo: "puntos", nombre: "evaluado", color: "#9b372b",
        radio: 5, puntos: [s.evaluated],
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
    }));
    for (const c of s.exact?.components ?? []) {
      capas.push({ tipo: "curva", nombre: `${c.name} exacta`, xs: s.exact.x, ys: c.y });
    }
    return { capas, resample: null };
  }

  if (plot.kind === "integracion") {
    // El Punto Medio pinta rectangulos + la curva superpuesta. Las marcas
    // van sobre el punto medio de cada rectangulo, a la altura f(m_i), para
    // que se lea de que valor sale cada barra.
    const capas = [
      {
        tipo: "rectangulos",
        nombre: "rectangulos",
        color: "#0e6e63",
        rectangulos: s.rectangles ?? [],
      },
      {
        tipo: "curva",
        nombre: "f(x)",
        xs: s.curve?.x ?? [],
        ys: s.curve?.y ?? [],
      },
    ];
    const marcas = (s.rectangles ?? []).map((r, i) => ({
      x: (r.x0 + r.x1) / 2,
      y: r.y,
      etiqueta: String(i + 1),
    }));
    if (marcas.length) {
      capas.push({
        tipo: "marcas",
        nombre: "puntos medios",
        color: "#b4531a",
        puntos: marcas,
      });
    }
    return { capas, resample: plot.resample ?? null };
  }

  return { capas: [], resample: null };
}
