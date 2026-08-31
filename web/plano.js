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

    this._conectar();
    this._ajustarTamano();
    new ResizeObserver(() => this._ajustarTamano()).observe(canvas.parentElement);
  }

  // ---------------------------------------------------------------- datos

  // capas: [{tipo, nombre, xs, ys, puntos, color}]
  // resample: {expression, variables, domain} o null
  mostrar(capas, resample = null, etiquetas = {}) {
    this.capas = capas.map((c, i) => ({ color: COLORES[i % COLORES.length], ...c }));
    this.resample = resample;
    this.etiquetas = { x: "x", y: "y", ...etiquetas };
    this.encuadrar();
  }

  limpiar() {
    this.capas = [];
    this.resample = null;
    this._pintar();
  }

  // Encuadra la vista sobre todo lo que hay, con un margen del 10 %.
  encuadrar() {
    const xs = [];
    const ys = [];
    for (const capa of this.capas) {
      for (const x of capa.xs ?? []) if (Number.isFinite(x)) xs.push(x);
      for (const y of capa.ys ?? []) if (Number.isFinite(y)) ys.push(y);
      for (const p of capa.puntos ?? []) {
        if (Number.isFinite(p.x)) xs.push(p.x);
        if (Number.isFinite(p.y)) ys.push(p.y);
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

    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const [mx, my] = this._posicion(e);
      const [wx, wy] = this._aMundo(mx, my);
      const factor = this._factorZoom(e);
      const v = this.vista;

      const anchoNuevo = (v.x1 - v.x0) * factor;
      const altoNuevo = (v.y1 - v.y0) * factor;
      const fueraDeRango = (n) => n < ANCHO_MINIMO || n > ANCHO_MAXIMO;
      if (fueraDeRango(anchoNuevo) || fueraDeRango(altoNuevo)) return;

      // El zoom se centra en el cursor, no en el origen.
      this.vista = {
        x0: wx + (v.x0 - wx) * factor,
        x1: wx + (v.x1 - wx) * factor,
        y0: wy + (v.y0 - wy) * factor,
        y1: wy + (v.y1 - wy) * factor,
      };
      this._pintar();
      this._pedirRemuestreo();
    }, { passive: false });

    let arrastrando = null;
    c.addEventListener("pointerdown", (e) => {
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

    c.addEventListener("dblclick", () => this.reiniciarVista());
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
  _pedirRemuestreo() {
    if (!this.resample || !this.alMuestrear) return;
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(async () => {
      const v = this.vista;
      const ancho = v.x1 - v.x0;
      const puntos = await this.alMuestrear({
        expression: this.resample.expression,
        variables: this.resample.variables ?? ["x"],
        x_min: v.x0 - ancho * 0.5,
        x_max: v.x1 + ancho * 0.5,
        points: 600,
      });
      if (!puntos) return;
      const curva = this.capas.find((c) => c.tipo === "curva");
      if (curva) {
        curva.xs = puntos.x;
        curva.ys = puntos.y;
        this._pintar();
      }
    }, ESPERA_REMUESTREO);
  }

  // ---------------------------------------------------- dibujo

  _ajustarTamano() {
    const dpr = window.devicePixelRatio || 1;
    const caja = this.canvas.parentElement.getBoundingClientRect();
    this.ancho = Math.max(320, Math.floor(caja.width));
    this.alto = Math.max(260, Math.floor(caja.height));
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

    let dibujando = false;
    for (let i = 0; i < capa.xs.length; i++) {
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
    for (const p of capa.puntos) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const [px, py] = this._aPantalla(p.x, p.y);
      ctx.beginPath();
      ctx.arc(px, py, capa.radio ?? 4, 0, Math.PI * 2);
      ctx.fill();
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
    for (const p of capa.puntos) {
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

  return { capas: [], resample: null };
}
