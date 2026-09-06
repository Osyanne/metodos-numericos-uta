import { test, expect } from "@playwright/test";

const esMuestra = (response) => response.url().endsWith("/api/plot/sample") && response.request().method() === "POST";

async function abrirPlano(page) {
  await page.goto("/");
  await page.locator("#metodo").selectOption("newton-raphson");
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
  test(`los cuatro formularios y el canvas caben a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 740 });
    await page.goto("/");
    for (const metodo of ["newton-raphson", "von-mises", "interpolacion-newton", "runge-kutta"]) {
      await page.locator("#metodo").selectOption(metodo);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
      const medida = await page.locator("#plano").evaluate((canvas) => ({
        ancho: canvas.getBoundingClientRect().width,
        disponible: canvas.parentElement.clientWidth,
        right: canvas.getBoundingClientRect().right,
      }));
      expect(medida.ancho).toBeLessThanOrEqual(medida.disponible);
      expect(medida.right).toBeLessThanOrEqual(ancho);
    }
    await page.locator("#metodo").selectOption("newton-raphson");
    await page.locator("#resolver").click();
    await expect(page.locator("#resumen .estado")).toBeVisible();
    await page.locator("#ver-tabla").click();
    await expect(page.locator("#tabla table")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
  });
}
