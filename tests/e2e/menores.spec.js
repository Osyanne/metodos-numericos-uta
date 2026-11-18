// Menores de la interfaz: rendimiento del pintado, compatibilidad con
// navegadores viejos, contraste y movimiento reducido.
import { test, expect } from "@playwright/test";
import { esperarDesplegable, elegirMetodo } from "./desplegable.js";

const PLANO_SUELTO = `
  const caja = document.createElement("div");
  caja.style.cssText = "width:600px;height:300px";
  const canvas = document.createElement("canvas");
  caja.append(canvas);
  document.body.append(caja);
`;

// ----------------------------------------------------------- pintado

test("repintar lee cada color una sola vez por capa, no por elemento", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const lecturas = await page.evaluate(async (montar) => {
    const { Plano } = await import("/plano.js");
    const canvas = new Function(`${montar}; return canvas;`)();
    const p = new Plano(canvas);
    const n = 2000;
    const puntos = Array.from({ length: n }, (_, i) => ({ x: i / n, y: Math.sin(i / 50), etiqueta: `${i}` }));
    const rectangulos = Array.from({ length: n }, (_, i) => ({ x0: i / n, x1: (i + 1) / n, y: Math.cos(i / 50) }));
    p.mostrar([
      { tipo: "rectangulos", rectangulos, color: "--curva" },
      { tipo: "marcas", puntos, color: "--iteraciones" },
    ]);
    let n_lecturas = 0;
    const original = window.getComputedStyle;
    window.getComputedStyle = (...args) => { n_lecturas += 1; return original.apply(window, args); };
    try {
      p.repintar();
    } finally {
      window.getComputedStyle = original;
    }
    return n_lecturas;
  }, PLANO_SUELTO);
  expect(lecturas).toBeLessThan(30);
});

test("un pintado atenuado no reasigna el tamano del lienzo aparte si no cambio", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const r = await page.evaluate(async (montar) => {
    const { Plano } = await import("/plano.js");
    const canvas = new Function(`${montar}; return canvas;`)();
    const p = new Plano(canvas);
    p.mostrar([{ tipo: "curva", xs: [0, 1, 2], ys: [0, 1, 0] }, { tipo: "puntos", puntos: [{ x: 1, y: 1 }] }]);
    p.atenuar(true);
    // Cuenta las asignaciones de width/height sobre cualquier lienzo.
    const asignaciones = { width: 0, height: 0 };
    const descriptores = {};
    for (const lado of ["width", "height"]) {
      descriptores[lado] = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, lado);
      Object.defineProperty(HTMLCanvasElement.prototype, lado, {
        configurable: true,
        get() { return descriptores[lado].get.call(this); },
        set(v) { asignaciones[lado] += 1; descriptores[lado].set.call(this, v); },
      });
    }
    try {
      for (let i = 0; i < 5; i++) p.repintar();
    } finally {
      for (const lado of ["width", "height"]) Object.defineProperty(HTMLCanvasElement.prototype, lado, descriptores[lado]);
    }
    // Y el atenuado sigue pintando: el pixel de la curva no es transparente.
    const { data } = p.canvas.getContext("2d").getImageData(0, 0, p.canvas.width, p.canvas.height);
    const pintados = data.reduce((s, v, i) => s + (i % 4 === 3 && v > 0 ? 1 : 0), 0);
    return { ...asignaciones, pintados };
  }, PLANO_SUELTO);
  // La primera de las cinco puede dimensionar el lienzo aparte; las demas no.
  expect(r.width).toBeLessThanOrEqual(1);
  expect(r.height).toBeLessThanOrEqual(1);
  expect(r.pintados).toBeGreaterThan(100);
});

test("el pintado atenuado no deja rastro del cuadro anterior en el lienzo aparte", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const diferentes = await page.evaluate(async (montar) => {
    const { Plano } = await import("/plano.js");
    const armar = () => {
      const canvas = new Function(`${montar}; return canvas;`)();
      const p = new Plano(canvas);
      p.atenuar(true);
      return p;
    };
    const dibujar = (p, x) => {
      p.mostrar([{ tipo: "puntos", puntos: [{ x, y: x }], color: "--curva", radio: 8 }]);
      p.vista = { x0: -1, x1: 1, y0: -1, y1: 1 };
      p.repintar();
    };
    const viejo = armar();
    dibujar(viejo, -0.9);
    dibujar(viejo, 0.9);
    const limpio = armar();
    dibujar(limpio, 0.9);
    const a = viejo.canvas.getContext("2d").getImageData(0, 0, viejo.canvas.width, viejo.canvas.height).data;
    const b = limpio.canvas.getContext("2d").getImageData(0, 0, limpio.canvas.width, limpio.canvas.height).data;
    return a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);
  }, PLANO_SUELTO);
  expect(diferentes).toBe(0);
});

// --------------------------------------------------- compatibilidad

test("sin MediaQueryList.addEventListener (Safari 13) la aplicacion arranca igual", async ({ page }) => {
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.addInitScript(() => {
    // Safari 13 solo conoce addListener/removeListener en MediaQueryList.
    Object.defineProperty(MediaQueryList.prototype, "addEventListener", { value: undefined, configurable: true });
  });
  await page.goto("/");
  await esperarDesplegable(page);
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
  expect(errores).toEqual([]);
});

test("un cambio del tema del sistema repinta tambien con addListener", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(MediaQueryList.prototype, "addEventListener", { value: undefined, configurable: true });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await esperarDesplegable(page);
  await expect(page.locator("#tema")).toHaveAttribute("aria-label", "Cambiar a tema oscuro");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("#tema")).toHaveAttribute("aria-label", "Cambiar a tema claro");
});

test("una familia con nombre heredado de Object no rompe el selector de metodos", async ({ page }) => {
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.route("**/api/methods", async (ruta) => {
    const respuesta = await ruta.fetch();
    const metodos = await respuesta.json();
    metodos[0] = { ...metodos[0], family: "constructor" };
    await ruta.fulfill({ response: respuesta, json: metodos });
  });
  await page.goto("/");
  await esperarDesplegable(page);
  expect(errores).toEqual([]);
  // Cae en "otros", como cualquier familia que la interfaz no conoce.
  await expect(page.locator('#metodo input[data-familia="otros"]')).toHaveCount(1);
  await expect(page.locator('#familia input[value="otros"]')).toHaveCount(1);
});

// ------------------------------------------------------------ contraste

const CONTRASTE_FAINT = async (page, tema) => {
  await page.emulateMedia({ colorScheme: tema });
  await page.goto("/");
  return page.evaluate(() => {
    const crudo = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const lum = (c) => {
      const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(rgb(a)) + 0.05, lum(rgb(b)) + 0.05];
      return Math.max(x, y) / Math.min(x, y);
    };
    const fondos = ["--paper", "--surface", "--surface-2", "--accent-bg", "--warn-bg", "--mal-bg", "--ok-bg",
      "--raices-bg", "--interpolacion-bg", "--integracion-bg", "--edo-bg", "--ajuste-bg", "--otros-bg"];
    const faint = crudo("--ink-faint");
    return fondos.map((f) => [f, ratio(faint, crudo(f))]);
  });
};

for (const tema of ["light", "dark"]) {
  test(`ink-faint tiene contraste AA sobre todos los fondos en tema ${tema}`, async ({ page }) => {
    const medidas = await CONTRASTE_FAINT(page, tema);
    for (const [fondo, razon] of medidas) expect(razon, `${fondo}`).toBeGreaterThanOrEqual(4.5);
  });
}

// ------------------------------------------------- movimiento reducido

test("con movimiento reducido el plano de Punto Medio aparece completo, sin animar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await esperarDesplegable(page);
  await elegirMetodo(page, "punto-medio");
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
  const r = await page.evaluate(async () => {
    const { plano } = await import("/app.js");
    return {
      progreso: plano.animacion.progreso,
      raf: plano.animacion.rafId,
      rectangulos: plano.capas.some((c) => c.tipo === "rectangulos" && c.rectangulos.length > 0),
    };
  });
  expect(r).toEqual({ progreso: 1, raf: null, rectangulos: true });
});

test("sin esa preferencia el plano de Punto Medio sigue animandose", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await esperarDesplegable(page);
  await elegirMetodo(page, "punto-medio");
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
  const progreso = await page.evaluate(async () => (await import("/app.js")).plano.animacion.progreso);
  expect(progreso).toBeLessThan(1);
});
