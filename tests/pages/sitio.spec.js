// El sitio de GitHub Pages hace lo mismo que el aplicativo local, pero con el
// nucleo de Python corriendo en el navegador. Se carga una sola vez (bajar
// Pyodide tarda) y sobre esa pagina se recorre todo lo que usa la interfaz.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PRESETS } from "../../web/presets.js";

test.describe.configure({ mode: "serial" });

let page;
const errores = [];

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on("pageerror", e => errores.push(e.message));
  page.on("console", m => { if (m.type() === "error") errores.push(m.text()); });
  await page.goto("./");
  await expect(page.locator("#puente-aviso")).toBeVisible();
  await expect(page.locator("#metodo option")).toHaveCount(7, { timeout: 240_000 });
  await expect(page.locator("#puente-aviso")).toHaveCount(0);
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

test("cada ejercicio del desplegable se resuelve con Python en el navegador", async () => {
  for (const preset of PRESETS) {
    // Por la interfaz, como el usuario: si falla, aparece el aviso.
    await page.locator("#metodo").selectOption(preset.metodo);
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
  await page.locator("#metodo").selectOption("von-mises");
  await page.locator("#preset").selectOption("von-mises-docente");
  for (const [formato, inicio] of [["csv", "i,xi,fxi,xi_sig,error"], ["pdf", "%PDF-"]]) {
    const descarga = page.waitForEvent("download");
    await page.locator(`#exportar-${formato}`).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toBe(`von-mises.${formato}`);
    expect(readFileSync(await archivo.path()).toString("latin1")).toMatch(new RegExp(`^${inicio.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("no quedan errores en la consola", async () => {
  expect(errores).toEqual([]);
});
