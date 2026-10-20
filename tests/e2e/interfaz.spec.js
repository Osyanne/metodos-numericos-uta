// La interfaz por tarjetas: tema, familias, tarjetas y formula. Lo que cada
// metodo calcula lo prueban metodos.spec.js y presets.spec.js; aca se prueba
// lo que la persona ve y toca.
import { test, expect } from "@playwright/test";
import { esperarDesplegable, elegirMetodo } from "./desplegable.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await esperarDesplegable(page);
});

// ------------------------------------------------------------------ tema

const lienzo = (page) => page.locator("#plano").evaluate((c) => c.toDataURL());

// El plano anima el trazado durante 2 s: se espera a que deje de cambiar.
async function lienzoQuieto(page) {
  await expect.poll(async () => {
    const a = await lienzo(page);
    await page.waitForTimeout(300);
    return a === await lienzo(page);
  }, { timeout: 10_000 }).toBe(true);
}

test("el tema alterna, se guarda y repinta el plano", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await esperarDesplegable(page);
  // Newton-Raphson es el metodo con el que arranca la pagina.
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
  await lienzoQuieto(page);
  const antes = await lienzo(page);

  await page.locator("#tema").click();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro");
  await expect.poll(() => lienzo(page)).not.toBe(antes);
  const fondo = await page.locator("#leyenda i").first()
    .evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(fondo).not.toBe("rgba(0, 0, 0, 0)");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro");
});

test("con el sistema en oscuro y sin elección, el primer clic pasa a claro", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-tema", /.+/);
  await page.locator("#tema").click();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "claro");
});

test("sin localStorage el tema igual alterna y no hay errores", async ({ page }) => {
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new Error("bloqueado"); },
  }));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.locator("#tema").click();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro");
  expect(errores).toEqual([]);
});

// ------------------------------------------------------------------ familias

// La ruta va ANTES del goto: si no, la pagina ya cargo la lista verdadera.
async function conMetodoX(page) {
  await page.route("**/api/methods", async (route) => {
    const r = await route.fetch();
    const m = await r.json();
    m.push({ ...m[0], slug: "metodo-x", name: "Metodo X", family: "xyz", orden: 99 });
    await route.fulfill({ response: r, json: m });
  });
  await page.goto("/");
}

test("familias en el orden de la API, solo sus chips, y recuerda el último", async ({ page }) => {
  const metodos = await esperarDesplegable(page);
  const familias = [...new Set(metodos.map((m) => m.family))];
  expect(await page.locator("#familia input").evaluateAll((es) => es.map((e) => e.value)))
    .toEqual(familias);
  await page.locator('#familia input[value="integracion"]').check();
  await expect(page.locator("#metodo label:visible"))
    .toHaveText(metodos.filter((m) => m.family === "integracion").map((m) => m.name));
  await page.locator('#metodo input[value="simpson"]').check();
  await page.locator('#familia input[value="raices"]').check();
  await expect(page.locator('#metodo input[value="newton-raphson"]')).toBeChecked();
  await page.locator('#familia input[value="integracion"]').check();
  await expect(page.locator('#metodo input[value="simpson"]')).toBeChecked();
  await expect(page.locator("body")).toHaveAttribute("data-familia", "integracion");
});

test("la flecha derecha cambia de familia", async ({ page }) => {
  const metodos = await esperarDesplegable(page);
  await page.locator("#familia input:checked").focus();
  await page.keyboard.press("ArrowRight");
  const segunda = [...new Set(metodos.map((m) => m.family))][1];
  await expect(page.locator(`#familia input[value="${segunda}"]`)).toBeChecked();
  await expect(page.locator(`#metodo label[data-familia="${segunda}"]`).first()).toBeVisible();
});

test("una familia desconocida va a Otros", async ({ page }) => {
  await conMetodoX(page);
  await page.locator('#familia input[value="otros"]').check();
  await expect(page.locator("#metodo label:visible")).toHaveText(["Metodo X"]);
});

// ------------------------------------------------------------------ tarjetas

test("la invitación se ve sin resultado y se va al resolver", async ({ page }) => {
  await expect(page.locator("#resumen-vacio")).toBeVisible();
  await elegirMetodo(page, "von-mises");
  await page.locator("#preset").selectOption("von-mises-docente");
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen-vacio")).toBeHidden();
  await elegirMetodo(page, "trapecio");
  await expect(page.locator("#resumen")).toBeEmpty();
  await expect(page.locator("#resumen-vacio")).toBeVisible();
});

test("los ajustes están plegados y su renglón sigue al ejercicio", async ({ page }) => {
  await expect(page.locator("#ajustes")).not.toHaveAttribute("open", "");
  await expect(page.locator("#ajustes-resumen")).toHaveText("tol 0.000001 · máx 50 · relativo %");
  await elegirMetodo(page, "runge-kutta");
  await page.locator("#preset").selectOption("runge-kutta-escalar");
  await expect(page.locator("#ajustes-resumen")).toContainText("sin parar");
});

test("en un celular no hay scroll horizontal y Datos va antes que Resultado", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await esperarDesplegable(page);
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const datos = await page.locator("#tarjeta-datos").boundingBox();
  const resultado = await page.locator("#tarjeta-resultado").boundingBox();
  expect(datos.y).toBeLessThan(resultado.y);
});
