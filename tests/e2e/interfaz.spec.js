// La interfaz por tarjetas: tema, familias, tarjetas y formula. Lo que cada
// metodo calcula lo prueban metodos.spec.js y presets.spec.js; aca se prueba
// lo que la persona ve y toca.
import { test, expect } from "@playwright/test";
import { esperarDesplegable } from "./desplegable.js";

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
