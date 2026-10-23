import { test, expect } from "@playwright/test";
import { elegirMetodo } from "./desplegable.js";

const esMuestra = (response) => response.url().endsWith("/api/plot/sample") && response.request().method() === "POST";

async function abrirPlano(page) {
  await page.goto("/");
  await elegirMetodo(page, "newton-raphson");
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
}

async function muestrearAl(page, accion) {
  const respuesta = page.waitForResponse(esMuestra);
  await accion();
  const r = await respuesta;
  expect(r.ok()).toBeTruthy();
  const datos = await r.json();
  expect(datos.x).toHaveLength(600);
  expect(datos.y.some(Number.isFinite)).toBeTruthy();
  return r.request().postDataJSON();
}

// Usa el Canvas y el módulo de producción. Solamente se retiene la entrega
// de respuestas reales para reproducir carreras sin depender de latencia.
async function prepararCarrera(page) {
  await page.goto("/");
  await page.evaluate(async () => {
    const { Plano } = await import("/plano.js");
    const caja = document.createElement("div");
    caja.style.cssText = "width:600px;height:300px";
    const canvas = document.createElement("canvas");
    caja.append(canvas);
    document.body.append(caja);
    window.entregas = [];
    window.solicitudes = [];
    window.planoPrueba = new Plano(canvas, {
      alMuestrear: async (peticion) => {
        window.solicitudes.push(peticion);
        const respuesta = await fetch("/api/plot/sample", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(peticion),
        });
        if (!respuesta.ok) throw new Error(`Muestreo real: ${respuesta.status}`);
        const puntos = await respuesta.json();
        return new Promise((resolve) => window.entregas.push({ puntos, resolver: () => resolve(puntos) }));
      },
    });
    window.planoPrueba.mostrar([{ tipo: "curva", xs: [0, 1], ys: [0, 1] }], { expression: "x^2", variables: ["x"] });
    window.moverPlano = () => canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, clientX: 200, clientY: 150, cancelable: true }));
  });
}

test("rueda y arrastre cambian la vista y remuestrean en el servidor real", async ({ page }) => {
  await abrirPlano(page);
  const canvas = page.locator("#plano");
  await canvas.scrollIntoViewIfNeeded();
  const caja = await canvas.boundingBox();
  const x = caja.x + caja.width / 2;
  const y = caja.y + caja.height / 2;
  await page.mouse.move(x, y);
  const zoom = await muestrearAl(page, () => page.mouse.wheel(0, -150));
  const paneo = await muestrearAl(page, async () => {
    await page.mouse.down();
    await page.mouse.move(x + 70, y + 25, { steps: 5 });
    await page.mouse.up();
  });
  expect(paneo.x_min).toBeLessThan(zoom.x_min);
  expect(paneo.x_max - paneo.x_min).toBeCloseTo(zoom.x_max - zoom.x_min, 8);
});

test("plano admite foco, flechas, zoom y reinicio con teclado", async ({ page }) => {
  await abrirPlano(page);
  const canvas = page.locator("#plano");
  await expect(canvas).toHaveAttribute("tabindex", "0");
  await canvas.focus();
  await expect(canvas).toBeFocused();
  const inicial = await muestrearAl(page, () => canvas.press("Home"));
  const mas = await muestrearAl(page, () => canvas.press("+"));
  expect(mas.x_max - mas.x_min).toBeLessThan(inicial.x_max - inicial.x_min);
  const derecha = await muestrearAl(page, () => canvas.press("ArrowRight"));
  expect(derecha.x_min).toBeGreaterThan(mas.x_min);
  const menos = await muestrearAl(page, () => canvas.press("-"));
  expect(menos.x_max - menos.x_min).toBeGreaterThan(derecha.x_max - derecha.x_min);
  const reinicio = await muestrearAl(page, () => canvas.press("Home"));
  expect(reinicio.x_min).toBeCloseTo(inicial.x_min, 8);
  expect(reinicio.x_max).toBeCloseTo(inicial.x_max, 8);
  await expect(canvas).toHaveAccessibleDescription(/flechas.*zoom/i);
});

test("una curva discreta crece dentro del paso actual, sin saltar al siguiente", async ({ page }) => {
  await page.goto("/");
  const trazo = await page.evaluate(async () => {
    const { Plano } = await import("/plano.js");
    const caja = document.createElement("div");
    caja.style.cssText = "width:600px;height:300px";
    const canvas = document.createElement("canvas");
    caja.append(canvas);
    document.body.append(caja);
    const plano = new Plano(canvas);
    const lineas = [];
    plano.ctx = {
      save() {}, beginPath() {}, rect() {}, clip() {}, stroke() {}, restore() {},
      moveTo(x, y) { lineas.push(["move", x, y]); },
      lineTo(x, y) { lineas.push(["line", x, y]); },
    };
    plano.ancho = 600;
    plano.alto = 300;
    plano.vista = { x0: 0, x1: 1, y0: 0, y1: 1 };
    plano.animacion.progreso = 0.25;
    plano._curva({ color: "#000", xs: [0, 1], ys: [0, 1] });
    return {
      lineas,
      cuarto: plano._aPantalla(0.25, 0.25),
      final: plano._aPantalla(1, 1),
    };
  });

  const segmento = trazo.lineas.find(([tipo]) => tipo === "line");
  expect(segmento).toBeDefined();
  expect(segmento[1]).toBeCloseTo(trazo.cuarto[0]);
  expect(segmento[2]).toBeCloseTo(trazo.cuarto[1]);
  expect(segmento[1]).not.toBeCloseTo(trazo.final[0]);
});

for (const accion of ["limpiar", "mostrar"]) {
  test(`cancelar debounce al ${accion} impide muestrear datos de otra gráfica`, async ({ page }) => {
    await prepararCarrera(page);
    const errores = [];
    page.on("pageerror", (error) => errores.push(error.message));
    await page.clock.install();
    await page.evaluate((accion) => {
      window.moverPlano();
      if (accion === "limpiar") window.planoPrueba.limpiar();
      else window.planoPrueba.mostrar([{ tipo: "curva", xs: [0, 1], ys: [10, 11] }], { expression: "x+10" });
    }, accion);
    await page.clock.fastForward(250);
    expect(await page.evaluate(() => window.solicitudes)).toHaveLength(0);
    expect(errores).toEqual([]);
  });
}

test("un remuestreo tardío no reemplaza las capas de otro problema", async ({ page }) => {
  await prepararCarrera(page);
  await page.evaluate(() => window.moverPlano());
  await expect.poll(() => page.evaluate(() => window.entregas.length)).toBe(1);
  await page.evaluate(async () => {
    window.planoPrueba.limpiar();
    window.planoPrueba.mostrar([{ tipo: "curva", xs: [0, 1], ys: [10, 11] }], { expression: "x+10" });
    window.entregas[0].resolver();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(await page.evaluate(() => window.planoPrueba.capas[0].ys)).toEqual([10, 11]);
});

test("la respuesta más vieja no pisa el último zoom aunque llegue después", async ({ page }) => {
  await prepararCarrera(page);
  await page.evaluate(() => window.moverPlano());
  await expect.poll(() => page.evaluate(() => window.entregas.length)).toBe(1);
  await page.evaluate(() => window.moverPlano());
  await expect.poll(() => page.evaluate(() => window.entregas.length)).toBe(2);
  await page.evaluate(async () => {
    window.entregas[1].resolver();
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.entregas[0].resolver();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const { visibles, ultimos } = await page.evaluate(() => ({ visibles: window.planoPrueba.capas[0].xs, ultimos: window.entregas[1].puntos.x }));
  expect(visibles).toEqual(ultimos);
});

for (const ancho of [320, 360]) {
  test(`todos los formularios y el canvas caben a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 740 });
    await page.goto("/");
    for (const metodo of ["newton-raphson", "von-mises", "interpolacion-newton", "interpolacion-lagrange", "punto-medio", "trapecio", "simpson", "runge-kutta"]) {
      await elegirMetodo(page, metodo);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
      const medida = await page.locator("#plano").evaluate((canvas) => ({
        ancho: canvas.getBoundingClientRect().width,
        disponible: canvas.parentElement.clientWidth,
        right: canvas.getBoundingClientRect().right,
      }));
      expect(medida.ancho).toBeLessThanOrEqual(medida.disponible);
      expect(medida.right).toBeLessThanOrEqual(ancho);
    }
    await elegirMetodo(page, "newton-raphson");
    await page.locator("#resolver").click();
    await expect(page.locator("#resumen .estado")).toBeVisible();
    await page.locator("#ver-tabla").click();
    await expect(page.locator("#tabla table")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
  });
}

test("capasDesdePlot dice en qué fila aparece cada elemento", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { capasDesdePlot } = await import("/plano.js");
    const trap = { kind: "integracion", series: { curve: { x: [0, 1], y: [0, 1] },
      trapezoids: [{ x0: 0, y0: 0, x1: 1, y1: 1 }, { x0: 1, y0: 1, x1: 2, y1: 4 }] } };
    const filasTrap = [{ n: 0 }, { n: 1 }, { n: 2 }];
    const raiz = { kind: "funcion_raiz", series: { curve: { x: [0, 1], y: [0, 1] },
      iterates: [{ n: 0, x: 2, y: 3 }, { n: 1, x: 1.5, y: 0.5 }], root: { x: 1.4, y: 0 } } };
    const filasRaiz = [{ n: 0, values: { xi: 2, fxi: 3, xi_sig: 1.5 } },
                       { n: 1, values: { xi: 1.5, fxi: 0.5, xi_sig: 1.4 } }];
    const t = capasDesdePlot(trap, filasTrap).capas.find((c) => c.tipo === "trapecios");
    const s = capasDesdePlot(raiz, filasRaiz).capas;
    return {
      trapecios: t.aparece,
      segmentos: s.find((c) => c.tipo === "segmentos").aparece,
      raiz: s.find((c) => c.nombre === "raiz").aparece,
      sinFilas: capasDesdePlot(trap).capas.some((c) => c.aparece),
    };
  });
  expect(r).toEqual({ trapecios: [1, 2], segmentos: [0, 1], raiz: [1], sinFilas: false });
});

test("marcarPaso cambia el dibujo y null lo devuelve al completo", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { Plano, capasDesdePlot } = await import("/plano.js");
    const caja = document.createElement("div");
    caja.style.cssText = "width:600px;height:300px";
    const canvas = document.createElement("canvas");
    caja.append(canvas);
    document.body.append(caja);
    const raiz = { kind: "funcion_raiz", series: { curve: { x: [0, 1, 2, 3], y: [-1, 0, 3, 8] },
      iterates: [{ n: 0, x: 2, y: 3 }, { n: 1, x: 1.5, y: 0.5 }], root: { x: 1.4, y: 0 } } };
    const filas = [{ n: 0, values: { xi: 2, fxi: 3, xi_sig: 1.5 } },
                   { n: 1, values: { xi: 1.5, fxi: 0.5, xi_sig: 1.4 } }];
    const plano = new Plano(canvas);
    plano.mostrar(capasDesdePlot(raiz, filas).capas, null, {}, { animar: false });
    const completo = canvas.toDataURL();
    plano.marcarPaso(0);
    const enPaso0 = canvas.toDataURL();
    plano.marcarPaso(null);
    return { distinto: enPaso0 !== completo, igual: canvas.toDataURL() === completo, paso: plano.paso };
  });
  expect(r).toEqual({ distinto: true, igual: true, paso: null });
});

test("marcarPaso dibuja sin errores cada familia de gráfica", async ({ page }) => {
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { Plano, capasDesdePlot } = await import("/plano.js");
    const caja = document.createElement("div");
    caja.style.cssText = "width:600px;height:300px";
    const canvas = document.createElement("canvas");
    caja.append(canvas); document.body.append(caja);
    const plano = new Plano(canvas);
    const curve = { x: [0, 1, 2, 3], y: [0, 1, 4, 9] };
    const casos = [
      [{ kind: "integracion", series: { curve, rectangles: [{ x0: 0, x1: 1, y: 1 }, { x0: 1, x1: 2, y: 4 }] } }, 2],
      [{ kind: "integracion", series: { curve, trapezoids: [{ x0: 0, y0: -1, x1: 1, y1: 1 }, { x0: 1, y0: 1, x1: 2, y1: 4 }] } }, 3],
      [{ kind: "integracion", series: { curve, parabolas: [{ x0: 0, y0: 0, xm: 1, ym: 1, x1: 2, y1: 4 }] } }, 3],
      [{ kind: "interpolacion", series: { curve, points: [[0, 0], [1, 1]], evaluated: { x: 1, y: 1 } } }, 2],
      [{ kind: "solucion_edo", series: { solution: { x: [0, 1, 2], components: [{ name: "y", y: [1, 2, 3] }] } } }, 3],
      [{ kind: "funcion_raiz", series: { curve, iterates: [{ n: 0, x: 2, y: 3 }, { n: 1, x: NaN, y: NaN }], root: { x: 1, y: 0 } } }, 2],
    ];
    let n = 0;
    for (const [plot, N] of casos) {
      const filas = Array.from({ length: N }, (_, i) => ({ n: i, values: { xi: 2, fxi: 3, xi_sig: i ? NaN : 1.5 } }));
      plano.mostrar(capasDesdePlot(plot, filas).capas, null, {}, { animar: false });
      for (const k of [0, 1, N - 1, null]) { plano.marcarPaso(k); n++; }
    }
    return n;
  });
  expect(r).toBe(24);
  expect(errores).toEqual([]);
});

test("mostrar y limpiar descartan el paso elegido", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { Plano, capasDesdePlot } = await import("/plano.js");
    const caja = document.createElement("div");
    caja.style.cssText = "width:600px;height:300px";
    const canvas = document.createElement("canvas");
    caja.append(canvas);
    document.body.append(caja);
    const raiz = { kind: "funcion_raiz", series: { curve: { x: [0, 1, 2, 3], y: [-1, 0, 3, 8] },
      iterates: [{ n: 0, x: 2, y: 3 }, { n: 1, x: 1.5, y: 0.5 }], root: { x: 1.4, y: 0 } } };
    const filas = [{ n: 0, values: { xi: 2, fxi: 3, xi_sig: 1.5 } },
                   { n: 1, values: { xi: 1.5, fxi: 0.5, xi_sig: 1.4 } }];
    const plano = new Plano(canvas);
    const mostrar = () => plano.mostrar(capasDesdePlot(raiz, filas).capas, null, {}, { animar: false });
    mostrar();
    const completo = canvas.toDataURL();
    plano.marcarPaso(0);
    mostrar();
    const trasMostrar = { igual: canvas.toDataURL() === completo, paso: plano.paso };
    plano.marcarPaso(0);
    plano.limpiar();
    return { trasMostrar, trasLimpiar: plano.paso };
  });
  expect(r).toEqual({ trasMostrar: { igual: true, paso: null }, trasLimpiar: null });
});

test("indiceEn y el clic eligen la fila del elemento bajo el puntero", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { Plano } = await import("/plano.js");
    const caja = document.createElement("div");
    caja.style.cssText = "width:600px;height:300px";
    const canvas = document.createElement("canvas");
    canvas.id = "lienzoClic";
    caja.append(canvas);
    document.body.append(caja);
    window.elegidos = [];
    window.planoPrueba = new Plano(canvas, { alElegir: (k) => window.elegidos.push(k) });
    window.planoPrueba.mostrar([
      { tipo: "rectangulos", nombre: "r", rectangulos: [{ x0: 0, x1: 1, y: 1 }, { x0: 1, x1: 2, y: 2 }], aparece: [0, 1] },
      { tipo: "marcas", nombre: "m", puntos: [{ x: 0.5, y: 1 }, { x: 1.5, y: 2 }], aparece: [0, 1] },
    ], null, {}, { animar: false });
  });
  const indice = (p) => page.evaluate(([px, py]) => window.planoPrueba.indiceEn(px, py), p);
  const pantalla = (x, y) => page.evaluate(([x, y]) => window.planoPrueba._aPantalla(x, y), [x, y]);
  expect(await indice(await pantalla(1.5, 2))).toBe(1);   // sobre la marca
  expect(await indice(await pantalla(0.2, 0.1))).toBe(0); // dentro del rectangulo 0
  expect(await indice(await pantalla(5, 5))).toBeNull();  // lejos de todo

  const [px, py] = await pantalla(1.5, 2);
  await page.locator("#lienzoClic").scrollIntoViewIfNeeded();
  const caja = await page.locator("#lienzoClic").boundingBox();
  const x = caja.x + px, y = caja.y + py;
  // sin paso elegido el clic no elige nada
  await page.mouse.click(x, y);
  expect(await page.evaluate(() => window.elegidos)).toEqual([]);
  await page.evaluate(() => window.planoPrueba.marcarPaso(0));
  await page.mouse.click(x, y);
  expect(await page.evaluate(() => window.elegidos)).toEqual([1]);
  // un arrastre de 40 px no elige
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.elegidos)).toEqual([1]);
});

// Plano de prueba con un lienzo propio y los elegidos acumulados en window.
async function planoDePrueba(page, capas) {
  await page.goto("/");
  await page.evaluate(async (capas) => {
    const { Plano } = await import("/plano.js");
    const caja = document.createElement("div");
    caja.style.cssText = "width:600px;height:300px";
    const canvas = document.createElement("canvas");
    canvas.id = "lienzoClic";
    caja.append(canvas);
    document.body.append(caja);
    window.elegidos = [];
    window.planoPrueba = new Plano(canvas, { alElegir: (k) => window.elegidos.push(k) });
    window.planoPrueba.mostrar(capas, null, {}, { animar: false });
    window.planoPrueba.vista = { x0: -2, x1: 2, y0: -2, y1: 2 };
    window.planoPrueba.marcarPaso(0);
  }, capas);
}

test("indiceEn ignora los puntos que no son finitos", async ({ page }) => {
  // Las filas de un metodo que diverge llegan como null y no deben quedar
  // elegibles en el origen.
  await planoDePrueba(page, [
    { tipo: "marcas", nombre: "m", puntos: [{ x: null, y: null }, { x: 1, y: 1 }], aparece: [0, 1] },
  ]);
  const k = await page.evaluate(() => {
    const [px, py] = window.planoPrueba._aPantalla(0, 0);
    return window.planoPrueba.indiceEn(px, py);
  });
  expect(k).toBeNull();
});

test("solo el boton principal elige al hacer clic", async ({ page }) => {
  await planoDePrueba(page, [
    { tipo: "marcas", nombre: "m", puntos: [{ x: 1, y: 1 }], aparece: [0] },
  ]);
  const [px, py] = await page.evaluate(() => window.planoPrueba._aPantalla(1, 1));
  await page.locator("#lienzoClic").scrollIntoViewIfNeeded();
  const caja = await page.locator("#lienzoClic").boundingBox();
  await page.mouse.click(caja.x + px, caja.y + py, { button: "right" });
  expect(await page.evaluate(() => window.elegidos)).toEqual([]);
  await page.mouse.click(caja.x + px, caja.y + py);
  expect(await page.evaluate(() => window.elegidos)).toEqual([0]);
  // el del medio va al final: en Chromium deja el puntero en modo scroll
  await page.mouse.click(caja.x + px, caja.y + py, { button: "middle" });
  expect(await page.evaluate(() => window.elegidos)).toEqual([0]);
});

test("los vertices de una curva con aparece se pueden elegir", async ({ page }) => {
  await planoDePrueba(page, [
    { tipo: "curva", nombre: "y", xs: [-1, 0, 1], ys: [-1, 0, 1], aparece: [0, 1, 2] },
  ]);
  const r = await page.evaluate(() => {
    const p = window.planoPrueba;
    return [
      p.indiceEn(...p._aPantalla(1, 1)),
      p.indiceEn(...p._aPantalla(-1, -1)),
      p.indiceEn(...p._aPantalla(-1.8, 1.8)),
    ];
  });
  expect(r).toEqual([2, 0, null]);
});

test("cortarAnimacion termina la animacion y marcarPaso no la toca", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { Plano } = await import("/plano.js");
    const caja = document.createElement("div");
    caja.style.cssText = "width:600px;height:300px";
    const canvas = document.createElement("canvas");
    caja.append(canvas);
    document.body.append(caja);
    const plano = new Plano(canvas);
    plano.mostrar([{ tipo: "curva", nombre: "c", xs: [0, 1, 2], ys: [0, 1, 4], aparece: [0, 1, 2] }]);
    plano.marcarPaso(2);
    const sigue = plano.animacion.progreso < 1;
    plano.cortarAnimacion();
    return { sigue, corta: plano.animacion.progreso === 1 && plano.animacion.rafId === null };
  });
  expect(r).toEqual({ sigue: true, corta: true });
});

// ------------------------------------------------------------------ asas

// Plano de prueba de 600x300 con vista fija, dos asas (una de eje x en x = 2 y
// una libre en (5, 1)) y callbacks que anotan en window.
async function planoConAsas(page) {
  await page.goto("/");
  await page.evaluate(async () => {
    const { Plano } = await import("/plano.js");
    const caja = document.createElement("div");
    caja.style.cssText = "width:600px;height:300px";
    const canvas = document.createElement("canvas");
    canvas.id = "lienzoAsas";
    caja.append(canvas);
    document.body.prepend(caja);
    window.arrastres = [];
    window.elegidos = [];
    window.planoPrueba = new Plano(canvas, {
      alArrastrar: (...args) => window.arrastres.push(args),
      alElegir: (k) => window.elegidos.push(k),
    });
    const plano = window.planoPrueba;
    plano.mostrar([{ tipo: "curva", nombre: "c", xs: [0, 5, 10], ys: [-4, 3, -1] }], null, {}, { animar: false });
    plano.vista = { x0: 0, x1: 10, y0: -5, y1: 5 };
    plano.ponerAsas({ tipo: "asas", asas: [
      { id: "x0", x: 2, y: 0, eje: "x", etiqueta: "x₀" },
      { id: "p:0", x: 5, y: 1, eje: "xy", etiqueta: "P₀" },
    ] });
  });
}

const enPlano = (page, fn, arg) => page.evaluate(fn, arg);

test("asaEn encuentra el asa a 12 px, a 20 px con el dedo, y nada más lejos", async ({ page }) => {
  await planoConAsas(page);
  const r = await enPlano(page, () => {
    const p = window.planoPrueba;
    const [px, py] = p.posicionAsa("x0");
    return {
      encima: p.asaEn(px, py),
      a11: p.asaEn(px + 11, py),
      a15: p.asaEn(px + 15, py),
      a15tactil: p.asaEn(px + 15, py, true),
      a25tactil: p.asaEn(px + 25, py, true),
      otra: p.asaEn(...p.posicionAsa("p:0")),
    };
  });
  expect(r).toEqual({ encima: "x0", a11: "x0", a15: null, a15tactil: "x0", a25tactil: null, otra: "p:0" });
});

test("un asa de eje x va sobre y = 0 o pegada al borde si el 0 no se ve", async ({ page }) => {
  await planoConAsas(page);
  const r = await enPlano(page, () => {
    const p = window.planoPrueba;
    const y = (vista) => {
      p.vista = vista;
      return [p.posicionAsa("x0")[1], p._aPantalla(2, vista.y0 > 0 ? vista.y0 : vista.y1 < 0 ? vista.y1 : 0)[1]];
    };
    return {
      centro: y({ x0: 0, x1: 10, y0: -5, y1: 5 }),
      arriba: y({ x0: 0, x1: 10, y0: 1, y1: 9 }),
      abajo: y({ x0: 0, x1: 10, y0: -9, y1: -1 }),
      libre: (y({ x0: 0, x1: 10, y0: -5, y1: 5 }), p.posicionAsa("p:0")[1] === p._aPantalla(5, 1)[1]),
    };
  });
  for (const [dibujada, esperada] of [r.centro, r.arriba, r.abajo]) expect(dibujada).toBeCloseTo(esperada);
  expect(r.libre).toBe(true);
});

test("posicionAsa da null fuera de la vista, sin asas y tras limpiar", async ({ page }) => {
  await planoConAsas(page);
  const r = await enPlano(page, () => {
    const p = window.planoPrueba;
    const desconocida = p.posicionAsa("b");
    p.vista = { x0: 20, x1: 30, y0: -5, y1: 5 };
    const fuera = p.posicionAsa("x0");
    p.vista = { x0: 0, x1: 10, y0: -5, y1: 5 };
    p.limpiar();
    return { desconocida, fuera, limpio: p.posicionAsa("x0") };
  });
  expect(r).toEqual({ desconocida: null, fuera: null, limpio: null });
});

test("mostrar con conservarVista no encuadra ni anima", async ({ page }) => {
  await planoConAsas(page);
  const r = await enPlano(page, () => {
    const p = window.planoPrueba;
    const capas = [{ tipo: "curva", nombre: "c", xs: [100, 200], ys: [100, 300] }];
    p.mostrar(capas, null, {}, { conservarVista: true });
    const conservada = { ...p.vista, progreso: p.animacion.progreso, asas: p.posicionAsa("x0") !== null };
    p.mostrar(capas);
    return { conservada, encuadrada: p.vista.x0 > 50, anima: p.animacion.progreso < 1 };
  });
  expect(r.conservada).toEqual({ x0: 0, x1: 10, y0: -5, y1: 5, progreso: 1, asas: true });
  expect(r.encuadrada).toBe(true);
  expect(r.anima).toBe(true);
});

test("atenuar cambia el dibujo de las capas y se deshace", async ({ page }) => {
  await planoConAsas(page);
  const r = await enPlano(page, () => {
    const p = window.planoPrueba;
    const c = document.getElementById("lienzoAsas");
    p.repintar();
    const normal = c.toDataURL();
    p.atenuar(true);
    const tenue = c.toDataURL();
    p.atenuar(false);
    return { cambia: tenue !== normal, vuelve: c.toDataURL() === normal };
  });
  expect(r).toEqual({ cambia: true, vuelve: true });
});

// Coordenadas de pagina del asa `id` del plano de prueba.
async function dondeAsa(page, id) {
  const caja = await page.locator("#lienzoAsas").boundingBox();
  const [px, py] = await page.evaluate((id) => window.planoPrueba.posicionAsa(id), id);
  return [caja.x + px, caja.y + py];
}

async function arrastrar(page, [x, y], dx, dy) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

test("_redondearAsa deja el valor a la precision de un pixel, tambien con zoom extremo", async ({ page }) => {
  await planoConAsas(page);
  const r = await enPlano(page, () => {
    const p = window.planoPrueba;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    const caso = (valor, rango) => {
      const v = p._redondearAsa(valor, rango, 600);
      const paso = 10 ** Math.floor(Math.log10(rango / 600));
      input.value = String(v);
      return {
        finito: Number.isFinite(v),
        multiplo: Math.abs(v / paso - Math.round(v / paso)) < 1e-6,
        valido: input.validity.valid && input.value !== "",
      };
    };
    return {
      normal: p._redondearAsa(1.36729, 10, 600),
      sinRuido: p._redondearAsa(0.1 + 0.2, 10, 600),
      chico: caso(1.2345678912345e-7, 1e-6),
      grande: caso(123456789.123, 1e6),
    };
  });
  expect(r.normal).toBe(1.37);
  expect(r.sinRuido).toBe(0.3);
  expect(r.chico).toEqual({ finito: true, multiplo: true, valido: true });
  expect(r.grande).toEqual({ finito: true, multiplo: true, valido: true });
});

test("arrastrar un asa de eje x avisa cada valor y al soltar, sin mover la vista", async ({ page }) => {
  await planoConAsas(page);
  await arrastrar(page, await dondeAsa(page, "x0"), 60, 30);
  const r = await enPlano(page, () => ({
    arrastres: window.arrastres, elegidos: window.elegidos, vista: window.planoPrueba.vista,
  }));
  expect(r.vista).toEqual({ x0: 0, x1: 10, y0: -5, y1: 5 });
  expect(r.elegidos).toEqual([]);
  const ultima = r.arrastres.at(-1);
  expect(ultima[0]).toBe("x0");
  expect(ultima[1]).toBeCloseTo(2 + 60 * 10 / 528, 1);
  expect(ultima[2]).toBeNull();
  expect(ultima[3]).toBe(true);
  expect(r.arrastres.slice(0, -1).every((a) => a[3] === false && a[2] === null)).toBe(true);
  expect(r.arrastres.length).toBeGreaterThan(2);
});

test("un asa libre cambia tambien su y", async ({ page }) => {
  await planoConAsas(page);
  await arrastrar(page, await dondeAsa(page, "p:0"), 40, -50);
  const ultima = await enPlano(page, () => window.arrastres.at(-1));
  expect(ultima[0]).toBe("p:0");
  expect(ultima[1]).toBeGreaterThan(5.5);
  expect(ultima[2]).toBeGreaterThan(2);
  expect(ultima[3]).toBe(true);
});

test("el valor de un asa no sale de la vista", async ({ page }) => {
  await planoConAsas(page);
  await arrastrar(page, await dondeAsa(page, "x0"), 900, 0);
  const ultima = await enPlano(page, () => window.arrastres.at(-1));
  expect(ultima[1]).toBe(10);
});

test("pointercancel a mitad de arrastre cuenta como soltar", async ({ page }) => {
  await planoConAsas(page);
  const [x, y] = await dondeAsa(page, "x0");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 50, y, { steps: 5 });
  await page.locator("#lienzoAsas").dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true });
  await page.mouse.up();
  const r = await enPlano(page, () => window.arrastres);
  expect(r.at(-1)[3]).toBe(true);
  expect(r.filter((a) => a[3]).length).toBe(1);
});

test("un clic sin mover sobre un asa sigue eligiendo la fila del punto de abajo", async ({ page }) => {
  await planoConAsas(page);
  await enPlano(page, () => {
    const p = window.planoPrueba;
    p.capas.push({ tipo: "puntos", nombre: "datos", color: "--serie-2", puntos: [{ x: 5, y: 1 }], aparece: [1] });
    p.marcarPaso(0);
  });
  await page.mouse.click(...await dondeAsa(page, "p:0"));
  const r = await enPlano(page, () => ({ arrastres: window.arrastres, elegidos: window.elegidos }));
  expect(r).toEqual({ arrastres: [], elegidos: [1] });
});

test("arrastrar el fondo, lejos de las asas, sigue moviendo la vista", async ({ page }) => {
  await planoConAsas(page);
  const caja = await page.locator("#lienzoAsas").boundingBox();
  await arrastrar(page, [caja.x + 450, caja.y + 60], -80, 0);
  const r = await enPlano(page, () => ({ arrastres: window.arrastres, x0: window.planoPrueba.vista.x0 }));
  expect(r.arrastres).toEqual([]);
  expect(r.x0).toBeGreaterThan(0.5);
});

test("el cursor invita a tomar un asa solo cuando hay una debajo", async ({ page }) => {
  await planoConAsas(page);
  const lienzo = page.locator("#lienzoAsas");
  const [x, y] = await dondeAsa(page, "x0");
  await page.mouse.move(x, y);
  await expect(lienzo).toHaveClass(/sobre-asa/);
  expect(await enPlano(page, () => window.planoPrueba.asaActiva)).toBe("x0");
  await page.mouse.move(x + 200, y - 100);
  await expect(lienzo).not.toHaveClass(/sobre-asa/);
});

test("con marcas densas solo se rotula la de la fila actual", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { Plano } = await import("/plano.js");
    const caja = document.createElement("div");
    caja.style.cssText = "width:600px;height:300px";
    const canvas = document.createElement("canvas");
    caja.append(canvas);
    document.body.append(caja);
    const plano = new Plano(canvas);
    const rotulos = [];
    const fillText = plano.ctx.fillText.bind(plano.ctx);
    plano.ctx.fillText = (texto, ...xy) => {
      if (String(texto).startsWith("m")) rotulos.push(texto);
      return fillText(texto, ...xy);
    };
    const marcas = (n) => ({
      tipo: "marcas", nombre: "m",
      puntos: Array.from({ length: n }, (_, i) => ({ x: (i * 10) / n, y: 1, etiqueta: `m${i}` })),
      aparece: Array.from({ length: n }, (_, i) => i),
    });
    const rotular = (n, k) => {
      plano.mostrar([marcas(n)], null, {}, { animar: false });
      plano.marcarPaso(k);
      rotulos.length = 0;
      plano.repintar();
      return [...rotulos];
    };
    return { densas: rotular(200, 5), pocas: rotular(5, 2) };
  });
  expect(r.densas).toEqual(["m5"]);
  expect(r.pocas).toEqual(["m0", "m1", "m2", "m3", "m4"]);
});

test("un temblor vertical sobre un asa de eje x no avisa nada", async ({ page }) => {
  await planoConAsas(page);
  await arrastrar(page, await dondeAsa(page, "x0"), 0, 8);
  expect(await enPlano(page, () => window.arrastres)).toEqual([]);
});
