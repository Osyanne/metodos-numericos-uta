// La pestana "Teoria": aparece solo con los metodos que tienen explicacion, se
// lee antes de resolver y no estorba al plano, a la tabla ni al recorrido.
import { test, expect } from "@playwright/test";
import { elegirMetodo } from "./desplegable.js";

test("sin teoria, la pestana no aparece; con ella, si, antes de resolver", async ({ page }) => {
  await page.goto("/");
  await elegirMetodo(page, "trapecio");
  await expect(page.locator("#ver-teoria")).toBeHidden();
  await elegirMetodo(page, "simpson-38");
  await expect(page.locator("#ver-teoria")).toBeVisible();
  await expect(page.locator("#ver-teoria")).toHaveText("Teoría");
  await elegirMetodo(page, "simpson");
  await expect(page.locator("#ver-teoria")).toBeHidden();
});

test("Simpson 3/8: la teoria se lee sin resolver y tiene lo esencial", async ({ page }) => {
  await page.goto("/");
  await elegirMetodo(page, "simpson-38");
  await page.locator("#ver-teoria").click();
  await expect(page.locator("#panel-teoria")).toBeVisible();
  await expect(page.locator("#panel-plano")).toBeHidden();
  await expect(page.locator("#ver-teoria")).toHaveClass(/activa/);
  const teoria = page.locator("#panel-teoria");
  await expect(teoria.getByRole("heading", { level: 3 })).toHaveCount(10);
  await expect(teoria).toContainText("ancho por altura promedio");
  await expect(teoria).toContainText("6480");
  await expect(teoria).toContainText("1, 3, 3, 1");
  await expect(teoria).toContainText("1.645077");
  expect(await teoria.locator("math").count()).toBeGreaterThanOrEqual(8);
  // Dos graficas en linea con titulo y descripcion, y tablas con encabezados.
  await expect(teoria.locator("svg")).toHaveCount(2);
  for (const svg of await teoria.locator("svg").all()) {
    await expect(svg.locator("title")).toHaveCount(1);
    await expect(svg.locator("desc")).toHaveCount(1);
  }
  expect(await teoria.locator("table").count()).toBeGreaterThanOrEqual(4);
  expect(await teoria.locator("table:not(:has(th))").count()).toBe(0);
  // El recorrido de filas no se ofrece mientras se lee.
  await expect(page.locator("#recorrido")).toBeHidden();
});

test("la teoria no rompe Plano, Iteraciones ni el recorrido", async ({ page }) => {
  await page.goto("/");
  await elegirMetodo(page, "simpson-38");
  await page.locator("#preset").selectOption("simpson-38-chapra-n5");
  await page.locator("#ver-teoria").click();
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
  await page.locator("#ver-tabla").click();
  await expect(page.locator("#panel-tabla")).toBeVisible();
  await expect(page.locator("#panel-teoria")).toBeHidden();
  await expect(page.locator("#tabla tbody tr")).toHaveCount(7);
  await page.locator("#ver-plano").click();
  await expect(page.locator("#panel-plano")).toBeVisible();
  await expect(page.locator("#recorrido")).toBeVisible();
  await page.locator("#paso-primero").click();
  await page.locator("#paso-siguiente").click();
  await expect(page.locator("#paso-rotulo")).toContainText("1 de");
  await page.locator("#ver-teoria").click();
  await expect(page.locator("#recorrido")).toBeHidden();
  await page.locator("#ver-plano").click();
  await expect(page.locator("#recorrido")).toBeVisible();
});

test("al pasar a un metodo sin teoria desde la teoria se vuelve al plano", async ({ page }) => {
  await page.goto("/");
  await elegirMetodo(page, "simpson-38");
  await page.locator("#ver-teoria").click();
  await elegirMetodo(page, "trapecio");
  await expect(page.locator("#ver-teoria")).toBeHidden();
  await expect(page.locator("#panel-plano")).toBeVisible();
  await expect(page.locator("#panel-teoria")).toBeHidden();
  await expect(page.locator("#panel-teoria")).toBeEmpty();
});

for (const ancho of [375, 320]) {
  test(`la teoria no desborda a ${ancho} px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 740 });
    await page.goto("/");
    await elegirMetodo(page, "simpson-38");
    await page.locator("#ver-teoria").click();
    await expect(page.locator("#panel-teoria")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
  });
}

for (const tema of ["light", "dark"]) {
  test(`la teoria es legible en tema ${tema} (contraste AA del texto)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema });
    await page.goto("/");
    await elegirMetodo(page, "simpson-38");
    await page.locator("#ver-teoria").click();
    const peor = await page.evaluate(() => {
      const num = (c) => c.match(/[\d.]+/g).map(Number);
      const lum = ([r, g, b]) => {
        const l = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
      };
      const fondo = (el) => {
        for (let e = el; e; e = e.parentElement) {
          const c = getComputedStyle(e).backgroundColor;
          const v = num(c);
          if (v.length < 4 || v[3] > 0.5) return v.slice(0, 3);
        }
        return [255, 255, 255];
      };
      let min = 21;
      for (const el of document.querySelectorAll("#panel-teoria p, #panel-teoria li, #panel-teoria h3, #panel-teoria h4, #panel-teoria td, #panel-teoria th")) {
        if (!el.textContent.trim()) continue;
        const a = lum(num(getComputedStyle(el).color).slice(0, 3)) + 0.05;
        const b = lum(fondo(el)) + 0.05;
        min = Math.min(min, Math.max(a, b) / Math.min(a, b));
      }
      return min;
    });
    expect(peor).toBeGreaterThanOrEqual(4.5);
  });
}
