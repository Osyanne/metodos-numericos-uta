// Cada ejercicio del desplegable se carga y se resuelve por la interfaz, como
// lo haria el usuario: un preset con un nombre de campo mal escrito o un dato
// que el nucleo rechaza no lo ve ninguna otra prueba, y aparece recien en la
// demostracion.
//
// Los que traen `esperado` se comparan ademas contra su valor. Esos valores
// salen de formulas cerradas o de la regla aplicada a mano (ver presets.js),
// nunca de haber corrido el aplicativo.
import { test, expect } from "@playwright/test";
import { PRESETS } from "../../web/presets.js";
import { esperarDesplegable } from "./desplegable.js";

function leerRuta(objeto, ruta) {
  return ruta.split(".").reduce(
    (actual, clave) => (actual == null ? undefined : actual[clave]),
    objeto,
  );
}

test("todos los presets tienen un id unico y un metodo que existe", async ({ page }) => {
  await page.goto("/");
  const metodos = await esperarDesplegable(page);
  const slugs = new Set(metodos.map(m => m.slug));
  const ids = PRESETS.map(p => p.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const preset of PRESETS) {
    expect(slugs, `${preset.id} apunta a ${preset.metodo}`).toContain(preset.metodo);
  }
});

// Pedido para la entrega: cada metodo ofrece al menos ocho ejercicios en el
// desplegable. Se mira la lista de la API, asi que un metodo nuevo sin
// ejercicios hace fallar esta prueba en vez de pasar desapercibido.
const MINIMO_POR_METODO = 8;

test(`cada metodo tiene al menos ${MINIMO_POR_METODO} ejercicios de ejemplo`, async ({ page }) => {
  await page.goto("/");
  const metodos = await esperarDesplegable(page);
  for (const metodo of metodos) {
    const cantidad = PRESETS.filter(p => p.metodo === metodo.slug).length;
    expect(cantidad, `${metodo.slug} tiene ${cantidad}`).toBeGreaterThanOrEqual(MINIMO_POR_METODO);
  }
});

for (const preset of PRESETS) {
  test(`preset ${preset.id} se resuelve desde la interfaz`, async ({ page }) => {
    await page.goto("/");
    await esperarDesplegable(page);
    await page.locator("#metodo").selectOption(preset.metodo);
    await page.locator("#preset").selectOption(preset.id);

    const recibida = page.waitForResponse(`**/${preset.metodo}/solve`);
    await page.locator("#resolver").click();
    const respuesta = await recibida;
    expect(respuesta.status(), await respuesta.text()).toBe(200);
    const resultado = await respuesta.json();
    await expect(page.locator("#aviso")).toBeHidden();

    for (const { ruta, valor, tol } of preset.esperado ?? []) {
      const obtenido = leerRuta(resultado, ruta);
      if (typeof valor === "number" && tol !== undefined) {
        expect(
          Math.abs(obtenido - valor),
          `${ruta}: se obtuvo ${obtenido}, se esperaba ${valor} ± ${tol}`,
        ).toBeLessThanOrEqual(tol);
      } else {
        expect(obtenido, ruta).toEqual(valor);
      }
    }
  });
}
