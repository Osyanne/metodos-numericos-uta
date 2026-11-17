// El sitio de GitHub Pages hace lo mismo que el aplicativo local, pero con el
// nucleo de Python corriendo en el navegador. Se carga una sola vez (bajar
// Pyodide tarda) y sobre esa pagina se recorre todo lo que usa la interfaz.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PRESETS } from "../../web/presets.js";
import { elegirMetodo, SELECTOR_METODOS } from "../e2e/desplegable.js";

test.describe.configure({ mode: "serial" });

let page;
let catalogo;
const errores = [];
const descargados = [];
const PILA_PDF = /pillow|fonttools|micropip|fpdf2/i;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on("pageerror", e => errores.push(e.message));
  page.on("console", m => { if (m.type() === "error") errores.push(m.text()); });
  page.on("request", r => descargados.push(r.url()));
  await page.goto("./");
  await expect(page.locator("#puente-aviso")).toBeVisible();
  await expect(page.locator(SELECTOR_METODOS).first()).toBeAttached({ timeout: 240_000 });
  await expect(page.locator("#puente-aviso")).toHaveCount(0, { timeout: 240_000 });
  // La interfaz tiene que ofrecer todo lo que da la API, sea cuantos sean.
  catalogo = (await pedir("api/methods")).cuerpo;
  await expect(page.locator(SELECTOR_METODOS)).toHaveCount(catalogo.length);
});

test.afterAll(async () => {
  await page?.close();
});

async function pedir(ruta, cuerpo) {
  return page.evaluate(async ([ruta, cuerpo]) => {
    const r = await fetch(ruta, cuerpo === undefined ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    return { status: r.status, cuerpo: await r.json() };
  }, [ruta, cuerpo]);
}

function leerRuta(objeto, ruta) {
  return ruta.split(".").reduce((a, k) => (a == null ? undefined : a[k]), objeto);
}

test("la interfaz se pinta antes de que Python este listo y Resolver espera", async ({ browser }) => {
  // Se frena todo lo que sale a jsDelivr (Pyodide) hasta soltarlo.
  let soltar;
  const frenado = new Promise(r => { soltar = r; });
  const p = await browser.newPage();
  await p.route("https://cdn.jsdelivr.net/**", async route => {
    await frenado;
    await route.continue();
  });
  try {
    await p.goto("./", { waitUntil: "domcontentloaded" });
    await expect(p.locator(SELECTOR_METODOS)).toHaveCount(catalogo.length);
    await expect(p.locator("#puente-aviso")).toBeVisible();
    await expect(p.locator("#preset option").first()).toBeAttached();
    await expect(p.locator("#formulario input").first()).toBeVisible();
    await p.locator("#resolver").click();
    await p.waitForTimeout(500);
    await expect(p.locator("#resumen")).toBeEmpty();
    soltar();
    await expect(p.locator("#resumen")).not.toBeEmpty({ timeout: 240_000 });
    await expect(p.locator("#puente-aviso")).toHaveCount(0);
  } finally {
    soltar();
    await p.close();
  }
});

test("cada ejercicio del desplegable se resuelve con Python en el navegador", async () => {
  for (const preset of PRESETS) {
    // Por la interfaz, como el usuario: si falla, aparece el aviso.
    await elegirMetodo(page, preset.metodo);
    await page.locator("#preset").selectOption(preset.id);
    await page.locator("#resolver").click();
    await expect(page.locator("#resumen")).not.toBeEmpty();
    await expect.soft(page.locator("#aviso"), preset.id).toBeHidden();

    const { status, cuerpo } = await pedir(
      `api/methods/${preset.metodo}/solve`,
      { params: preset.params, ...preset.config },
    );
    expect.soft(status, preset.id).toBe(200);
    for (const { ruta, valor, tol } of preset.esperado ?? []) {
      const obtenido = leerRuta(cuerpo, ruta);
      if (typeof valor === "number" && tol !== undefined) {
        expect.soft(Math.abs(obtenido - valor), `${preset.id} ${ruta} = ${obtenido}`)
          .toBeLessThanOrEqual(tol);
      } else {
        expect.soft(obtenido, `${preset.id} ${ruta}`).toEqual(valor);
      }
    }
  }
});

test("resolver no descarga pillow ni fpdf2: solo el PDF los necesita", async () => {
  expect(descargados.filter(u => PILA_PDF.test(u))).toEqual([]);
});

test("ningun archivo de Pyodide ni codigo.zip se baja dos veces", async () => {
  // Los adelantos del HTML y del puente tienen que ser los mismos pedidos que
  // despues hace Pyodide; si no coinciden, el navegador baja todo por duplicado.
  // El lock lo vuelve a pedir Pyodide con otras opciones (son 24 KB); el
  // catalogo lo pide a proposito la prueba.
  const repetidos = descargados.filter((u, i) =>
    descargados.indexOf(u) !== i && !/pyodide-lock|catalogo\.json/.test(u));
  expect(repetidos).toEqual([]);
  expect(descargados.filter(u => /codigo\.zip/.test(u))).toHaveLength(1);
});

test("el zoom remuestrea en Python y corta la curva donde no esta definida", async () => {
  const { status, cuerpo } = await pedir("api/plot/sample", {
    expression: "1/x", x_min: -1, x_max: 1, points: 5,
  });
  expect(status).toBe(200);
  expect(cuerpo).toEqual({ x: [-1, -0.5, 0, 0.5, 1], y: [-1, -2, null, 2, 1] });
});

test("los errores llegan con el mismo codigo y mensaje que en local", async () => {
  const sinDerivada = await pedir("api/methods/newton-raphson/solve", {
    params: { fx: "x^2 - 4", x0: 0 },
  });
  expect(sinDerivada.status).toBe(422);
  expect(sinDerivada.cuerpo.detail).toMatch(/derivada se anula/);

  const inexistente = await pedir("api/methods/no-existe");
  expect(inexistente.status).toBe(404);

  const invalido = await pedir("api/methods/von-mises/solve", { params: {}, decimals: 99 });
  expect(invalido.status).toBe(422);
});

test("exporta CSV y PDF desde los botones", async () => {
  await elegirMetodo(page, "von-mises");
  await page.locator("#preset").selectOption("von-mises-docente");
  for (const [formato, inicio] of [["csv", "i,xi,fxi,xi_sig,error"], ["pdf", "%PDF-"], ["pdf", "%PDF-"]]) {
    // El CSV no necesita la pila de PDF; el primer PDF la baja y el segundo la reusa.
    const antes = descargados.filter(u => PILA_PDF.test(u)).length;
    const descarga = page.waitForEvent("download");
    await page.locator(`#exportar-${formato}`).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toBe(`von-mises.${formato}`);
    expect(readFileSync(await archivo.path()).toString("latin1")).toMatch(new RegExp(`^${inicio.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("arrastrar x₀ de Newton-Raphson recalcula con Python en el navegador", async () => {
  await elegirMetodo(page, "newton-raphson");
  await page.locator("#preset").selectOption("newton-clasico");
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
  const resumen = await page.locator("#resumen").textContent();
  const posicion = () => page.evaluate(async () =>
    (await import(new URL("app.js", location.href))).plano.posicionAsa("x0"));
  await page.locator("#plano").scrollIntoViewIfNeeded();
  await expect.poll(posicion).not.toBeNull();
  const [px, py] = await posicion();
  const caja = await page.locator("#plano").boundingBox();
  await page.mouse.move(caja.x + px, caja.y + py);
  await page.mouse.down();
  await page.mouse.move(caja.x + px - 60, caja.y + py, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator("#campo-x0")).not.toHaveValue("2");
  await expect.poll(() => page.locator("#resumen").textContent()).not.toBe(resumen);
  await expect(page.locator("#paso-siguiente")).toBeEnabled();
});

test("tras la segunda visita el sitio funciona sin red, desde el service worker", async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const sinAviso = () => expect(p.locator("#puente-aviso")).toHaveCount(0, { timeout: 240_000 });
  try {
    // Primera visita: instala el service worker y guarda lo que alcance.
    await p.goto("./", { waitUntil: "domcontentloaded" });
    await expect(p.locator("#puente-aviso")).toBeVisible();
    await sinAviso();
    await p.evaluate(() => navigator.serviceWorker.ready);
    // Segunda: ya controlada, completa lo que la primera pidio antes de que
    // el service worker tomara el control.
    await p.reload({ waitUntil: "domcontentloaded" });
    await sinAviso();
    expect(await p.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await ctx.setOffline(true);
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(p.locator(SELECTOR_METODOS)).toHaveCount(catalogo.length);
    await sinAviso();
    await p.locator("#resolver").click();
    await expect(p.locator("#resumen")).not.toBeEmpty({ timeout: 60_000 });
    await expect(p.locator("#aviso")).toBeHidden();
  } finally {
    await ctx.close();
  }
});

test("no quedan errores en la consola", async () => {
  expect(errores).toEqual([]);
});
