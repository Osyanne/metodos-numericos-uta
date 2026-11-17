// El plano de Simpson 3/8: una cubica por tramo de tres subintervalos, con sus
// cuatro nodos, y la preferencia de movimiento reducido.
import { test, expect } from "@playwright/test";

const CUBICAS = {
  kind: "integracion",
  series: {
    curve: { x: [0, 6], y: [0, 36] },
    cubicas: [
      { x0: 0, y0: 0, x1: 1, y1: 1, x2: 2, y2: 4, x3: 3, y3: 9 },
      { x0: 3, y0: 9, x1: 4, y1: 16, x2: 5, y2: 25, x3: 6, y3: 36 },
    ],
    nodes: [0, 1, 2, 3, 4, 5, 6].map((x) => ({ label: `x${x}`, x, y: x * x })),
    arc_rows: [3, 6],
  },
};

// Un plano suelto de 600 x 300 dentro de la pagina.
const PLANO_SUELTO = `
  const caja = document.createElement("div");
  caja.style.cssText = "width:600px;height:300px";
  const canvas = document.createElement("canvas");
  caja.append(canvas);
  document.body.append(caja);
`;

test("capasDesdePlot arma la capa de cubicas y los nodos con la fila en que aparecen", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async (plot) => {
    const { capasDesdePlot } = await import("/plano.js");
    const filas = Array.from({ length: 7 }, (_, i) => ({ n: i }));
    const { capas } = capasDesdePlot(plot, filas);
    const nodos = capas.find((c) => c.tipo === "marcas");
    return {
      cubicas: capas.find((c) => c.tipo === "cubicas").aparece,
      nodos: nodos.puntos.map((p) => p.etiqueta),
      cuando: nodos.aparece,
      sinFilas: capasDesdePlot(plot).capas.some((c) => c.aparece),
    };
  }, CUBICAS);
  // La cubica j termina en la fila 3j + 3; los siete nodos son las siete filas.
  expect(r.cubicas).toEqual([3, 6]);
  expect(r.nodos).toEqual(["x0", "x1", "x2", "x3", "x4", "x5", "x6"]);
  expect(r.cuando).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(r.sinFilas).toBe(false);
});

test("un clic sobre la franja de una cubica elige la fila donde termina", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async ({ plot, montar }) => {
    const { Plano, capasDesdePlot } = await import("/plano.js");
    const canvas = new Function(`${montar}; return canvas;`)();
    const p = new Plano(canvas);
    const filas = Array.from({ length: 7 }, (_, i) => ({ n: i }));
    p.mostrar(capasDesdePlot(plot, filas).capas, null, {}, { animar: false });
    // A media altura de la vista, lejos de todo nodo: x = 1.5 y x = 4.5.
    const y = (p.vista.y0 + p.vista.y1) / 2;
    return [1.5, 4.5].map((x) => p.indiceEn(...p._aPantalla(x, y)));
  }, { plot: CUBICAS, montar: PLANO_SUELTO });
  expect(r).toEqual([3, 6]);
});

test("el arco de la cubica pasa por los cuatro nodos (Bezier cubica exacta)", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async (montar) => {
    const { Plano } = await import("/plano.js");
    const canvas = new Function(`${montar}; return canvas;`)();
    const p = new Plano(canvas);
    p.mostrar([], null, {}, { animar: false });
    p.vista = { x0: -1, x1: 4, y0: -2, y1: 12 };
    // Se interceptan los trazos del contorno para leer la Bezier que se manda.
    const real = window.Path2D;
    const trazos = [];
    window.Path2D = class extends real {
      lineTo(...a) { trazos.push(["L", a]); super.lineTo(...a); }
      bezierCurveTo(...a) { trazos.push(["C", a]); super.bezierCurveTo(...a); }
    };
    p.animacion.progreso = 1;
    p._cubicas({
      color: "--area",
      cubicas: [{ x0: 0, y0: 0, x1: 1, y1: 1, x2: 2, y2: 4, x3: 3, y3: 9 }],
    });
    window.Path2D = real;
    const [px0, py0] = trazos.find(([t]) => t === "L")[1];
    const [c1x, c1y, c2x, c2y, px3, py3] = trazos.find(([t]) => t === "C")[1];
    const B = (t, e) => {
      const q = [[px0, py0], [c1x, c1y], [c2x, c2y], [px3, py3]].map((v) => v[e]);
      const u = 1 - t;
      return u ** 3 * q[0] + 3 * u * u * t * q[1] + 3 * u * t * t * q[2] + t ** 3 * q[3];
    };
    const [n1x, n1y] = p._aPantalla(1, 1);
    const [n2x, n2y] = p._aPantalla(2, 4);
    return {
      dx1: B(1 / 3, 0) - n1x, dy1: B(1 / 3, 1) - n1y,
      dx2: B(2 / 3, 0) - n2x, dy2: B(2 / 3, 1) - n2y,
      llamadas: trazos.length,
    };
  }, PLANO_SUELTO);
  expect(r.llamadas).toBeGreaterThan(0);
  for (const d of [r.dx1, r.dy1, r.dx2, r.dy2]) expect(Math.abs(d)).toBeLessThan(1e-9);
});

test("con movimiento reducido el plano aparece dibujado entero, sin animar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const r = await page.evaluate(async ({ plot, montar }) => {
    const { Plano, capasDesdePlot } = await import("/plano.js");
    const canvas = new Function(`${montar}; return canvas;`)();
    const p = new Plano(canvas);
    p.mostrar(capasDesdePlot(plot).capas);
    return { progreso: p.animacion.progreso, raf: p.animacion.rafId };
  }, { plot: CUBICAS, montar: PLANO_SUELTO });
  expect(r).toEqual({ progreso: 1, raf: null });
});

test("sin esa preferencia el plano sigue animándose", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await page.goto("/");
  const r = await page.evaluate(async ({ plot, montar }) => {
    const { Plano, capasDesdePlot } = await import("/plano.js");
    const canvas = new Function(`${montar}; return canvas;`)();
    const p = new Plano(canvas);
    p.mostrar(capasDesdePlot(plot).capas);
    return p.animacion.progreso < 1;
  }, { plot: CUBICAS, montar: PLANO_SUELTO });
  expect(r).toBe(true);
});

test("Simpson 3/8 resuelto desde la interfaz dibuja una cúbica por tramo y sus nodos", async ({ page }) => {
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.goto("/");
  const { elegirMetodo } = await import("./desplegable.js");
  await elegirMetodo(page, "simpson-38");
  await page.locator("#preset").selectOption("simpson-38-logaritmo");
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
  await expect(page.locator("#leyenda .leyenda-item")).toHaveText(["cúbicas (regla 3/8)", "f(x)", "nodos"]);
  const capas = await page.evaluate(async () => {
    const { plano } = await import("/app.js");
    return plano.capas.map((c) => [c.tipo, c.cubicas?.length ?? c.puntos?.length ?? null]);
  });
  // n = 6: dos tramos y siete nodos.
  expect(capas).toEqual([["cubicas", 2], ["curva", null], ["marcas", 7]]);
  expect(errores).toEqual([]);
});
