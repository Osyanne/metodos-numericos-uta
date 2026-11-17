// Guardas del arrastre: lo que pasa cuando la aplicacion corta el gesto, el
// freno entre peticiones, y los remuestreos mientras se arrastra.
import { test, expect } from "@playwright/test";
import { esperarDesplegable, elegirMetodo } from "./desplegable.js";

async function resolver(page, slug, preset) {
  await page.goto("/");
  await esperarDesplegable(page);
  await elegirMetodo(page, slug);
  await page.locator("#preset").selectOption(preset);
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
}

const posicionAsa = (page, id) =>
  page.evaluate(async (id) => (await import("/app.js")).plano.posicionAsa(id), id);

async function dondeAsa(page, id) {
  await page.locator("#plano").scrollIntoViewIfNeeded();
  await expect.poll(() => posicionAsa(page, id)).not.toBeNull();
  const [px, py] = await posicionAsa(page, id);
  const caja = await page.locator("#plano").boundingBox();
  return [caja.x + px, caja.y + py];
}

const enLaUltima = /(\d+) de \1$/;
const esSolve = (r) => r.url().includes("/solve");
const esMuestra = (r) => r.url().endsWith("/api/plot/sample");

// ------------------------------------------------ remuestreo en el arrastre

test("durante un arrastre lento no se acumulan remuestreos: uno al soltar", async ({ page }) => {
  await resolver(page, "newton-raphson", "newton-clasico");
  // Cada respuesta tarda mas que la espera del remuestreo (150 ms).
  await page.route("**/api/methods/*/solve", async (ruta) => {
    await new Promise((r) => setTimeout(r, 260));
    await ruta.continue();
  });
  let muestras = 0;
  page.on("request", (r) => { if (esMuestra(r)) muestras += 1; });
  const [x, y] = await dondeAsa(page, "x0");
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(x - 8 * i, y);
    await page.waitForTimeout(220);
  }
  expect(muestras).toBe(0);
  await page.mouse.up();
  await expect(page.locator("#paso-rotulo")).toHaveText(enLaUltima);
  await expect.poll(() => muestras).toBe(1);
});

// ------------------------------------------------------------ freno

test("dos peticiones del arrastre salen separadas al menos 100 ms", async ({ page }) => {
  await resolver(page, "newton-raphson", "newton-clasico");
  const salidas = [];
  await page.route("**/api/methods/*/solve", (ruta) => {
    salidas.push(Date.now());
    return ruta.continue();
  });
  const [x, y] = await dondeAsa(page, "x0");
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(x - 2 * i, y);
    await page.waitForTimeout(15);
  }
  await page.mouse.up();
  await expect(page.locator("#paso-rotulo")).toHaveText(enLaUltima);
  expect(salidas.length).toBeGreaterThanOrEqual(3);
  for (let i = 1; i < salidas.length; i++) expect(salidas[i] - salidas[i - 1]).toBeGreaterThanOrEqual(85);
});

// ------------------------------------------- Resolver gana a la final

test("Resolver gana tambien a la respuesta final del arrastre en vuelo", async ({ page }) => {
  await resolver(page, "newton-raphson", "newton-clasico");
  const retenidas = [];
  let primera = true;
  await page.route("**/api/methods/*/solve", (ruta) => {
    if (primera) { primera = false; return ruta.continue(); }
    return retenidas.push(ruta);
  });
  const [x, y] = await dondeAsa(page, "x0");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 40, y, { steps: 6 });
  await page.mouse.up();
  // La primera respuesta paso; la que sigue (la final del arrastre) queda en vuelo.
  await expect.poll(() => retenidas.length).toBe(1);
  expect(retenidas[0].request().postDataJSON().params.x0).not.toBe(2);
  await page.route("**/api/methods/*/solve", (ruta) => ruta.continue());
  await page.locator("#campo-x0").fill("3");
  const respuesta = page.waitForResponse(esSolve);
  await page.locator("#resolver").click();
  await respuesta;
  await expect(page.locator("#paso-rotulo")).toHaveText(enLaUltima);
  const resumen = await page.locator("#resumen").textContent();
  await retenidas[0].continue();
  await page.waitForTimeout(400);
  await expect(page.locator("#campo-x0")).toHaveValue("3");
  expect(await page.locator("#resumen").textContent()).toBe(resumen);
  await expect(page.locator("#paso-siguiente")).toBeEnabled();
});

// ----------------------------------------------------- Decimales en vuelo

test("cambiar Decimales con la final en vuelo no deja la tabla a medias", async ({ page }) => {
  await resolver(page, "newton-raphson", "newton-clasico");
  let primera = true;
  const retenidas = [];
  await page.route("**/api/methods/*/solve", (ruta) => {
    if (primera) { primera = false; return ruta.continue(); }
    return retenidas.push(ruta);
  });
  const tablaAntes = await page.locator("#tabla").innerText();
  const [x, y] = await dondeAsa(page, "x0");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 60, y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => retenidas.length).toBe(1);
  // Hubo una respuesta en vivo: el resumen la muestra, la tabla espera a soltar.
  await page.locator("#decimales").fill("3");
  await page.locator("#decimales").dispatchEvent("input");
  expect(await page.locator("#tabla").innerText()).toBe(tablaAntes);
  // Al llegar la final, tabla y recorrido son del mismo resultado y de 3 decimales.
  await page.route("**/api/methods/*/solve", (ruta) => ruta.continue());
  await retenidas[0].continue();
  const ultima = page.locator("#tabla tbody tr").last().locator("td");
  await expect.poll(async () => (await ultima.allInnerTexts()).some((c) => /^-?\d+\.\d{3}$/.test(c.trim()))).toBe(true);
  // La ultima fila de la tabla (su iteracion i) es la ultima del recorrido.
  const n = (await ultima.first().innerText()).trim();
  await expect(page.locator("#paso-rotulo")).toHaveText(new RegExp(` ${n} de ${n}$`));
});

// -------------------------------------------- el plano y los cortes del gesto

const asa = (id, x) => ({ tipo: "asas", asas: [{ id, x, y: 0, eje: "x", etiqueta: id }] });

test("limpiar suelta el asa tomada: la capa nueva no queda pegada al puntero viejo", async ({ page }) => {
  await resolver(page, "newton-raphson", "newton-clasico");
  const [x, y] = await dondeAsa(page, "x0");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 50, y, { steps: 5 });
  const r = await page.evaluate(async (capa) => {
    const { plano } = await import("/app.js");
    plano.limpiar();
    plano.ponerAsas(capa);
    return { x: plano.posicionAsa("x0")[0], esperado: plano._aPantalla(capa.asas[0].x, 0)[0] };
  }, asa("x0", 2));
  expect(Math.abs(r.x - r.esperado)).toBeLessThan(0.5);
  await page.mouse.up();
});

test("si las asas desaparecen entre pointerdown y el primer movimiento no hay error", async ({ page }) => {
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await resolver(page, "newton-raphson", "newton-clasico");
  const [x, y] = await dondeAsa(page, "x0");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.evaluate(async () => (await import("/app.js")).plano.limpiar());
  await page.mouse.move(x - 30, y, { steps: 4 });
  await page.mouse.up();
  expect(errores).toEqual([]);
  await expect(page.locator("#plano")).not.toHaveClass(/arrastrando/);
});

test("cambiar de metodo suelta los parametros: un asa tardia no resuelve con datos viejos", async ({ page }) => {
  await resolver(page, "newton-raphson", "newton-clasico");
  await elegirMetodo(page, "trapecio");
  const pedidos = [];
  page.on("request", (r) => { if (esSolve(r)) pedidos.push(r); });
  await page.evaluate(async () => {
    const { plano } = await import("/app.js");
    plano.alArrastrar("x0", 1, null, true);
  });
  await page.waitForTimeout(400);
  expect(pedidos).toEqual([]);
});

test("cambiar de ejercicio suelta los parametros: un asa tardia no resuelve con datos viejos", async ({ page }) => {
  await resolver(page, "newton-raphson", "newton-clasico");
  await page.locator("#preset").selectOption("newton-raiz-de-dos");
  const pedidos = [];
  page.on("request", (r) => { if (esSolve(r)) pedidos.push(r); });
  await page.evaluate(async () => {
    const { plano } = await import("/app.js");
    plano.alArrastrar("x0", 1, null, true);
  });
  await page.waitForTimeout(400);
  expect(pedidos).toEqual([]);
});

test("perder la captura del puntero cuenta como soltar", async ({ page }) => {
  await resolver(page, "newton-raphson", "newton-clasico");
  const [x, y] = await dondeAsa(page, "x0");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 50, y, { steps: 6 });
  await expect(page.locator("#plano")).toHaveClass(/arrastrando/);
  await page.locator("#plano").dispatchEvent("lostpointercapture", { pointerId: 1 });
  await expect(page.locator("#plano")).not.toHaveClass(/arrastrando/);
  await expect(page.locator("#paso-rotulo")).toHaveText(enLaUltima);
  await expect(page.locator("#paso-siguiente")).toBeEnabled();
  await page.mouse.up();
});

// ------------------------------------------------- escribir puntos

test("escribir puntos con otra cantidad de filas rehace la tabla y renumera", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { Formulario } = await import("/forms.js");
    const caja = document.createElement("div");
    document.body.append(caja);
    const f = new Formulario(caja);
    f.dibujar({ inputs: [{ name: "points", kind: "points", label: "Puntos", required: true, default: [[0, 1], [1, 3]] }] });
    const salida = [];
    for (const puntos of [[[0, 0], [1, 1], [2, 4], [3, 9]], [[5, 6]], [[1, 2], [3, 4]]]) {
      f.poner("points", puntos);
      salida.push({
        leidos: f.valores().points,
        filas: caja.querySelectorAll("tbody tr").length,
        etiqueta: [...caja.querySelectorAll("tbody tr")].pop().querySelector("input").getAttribute("aria-label"),
      });
    }
    return salida;
  });
  expect(r).toEqual([
    { leidos: [[0, 0], [1, 1], [2, 4], [3, 9]], filas: 4, etiqueta: "x del punto 4" },
    { leidos: [[5, 6]], filas: 1, etiqueta: "x del punto 1" },
    { leidos: [[1, 2], [3, 4]], filas: 2, etiqueta: "x del punto 2" },
  ]);
});
