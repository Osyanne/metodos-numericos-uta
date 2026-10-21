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
