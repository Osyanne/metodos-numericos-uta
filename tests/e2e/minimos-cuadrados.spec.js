// Ajuste por minimos cuadrados de punta a punta: el ejercicio del docente
// por la interfaz real, sus cuatro modelos, la grafica y el arrastre.
import { test, expect } from "@playwright/test";
import { esperarDesplegable, elegirMetodo } from "./desplegable.js";

async function abrir(page, preset) {
  await page.goto("/");
  await esperarDesplegable(page);
  await elegirMetodo(page, "minimos-cuadrados");
  if (preset) await page.locator("#preset").selectOption(preset);
}

async function resolver(page) {
  const recibida = page.waitForResponse("**/minimos-cuadrados/solve");
  await page.locator("#resolver").click();
  const respuesta = await recibida;
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  await expect(page.locator("#resumen .estado")).toBeVisible();
  return respuesta.json();
}

const resultadoDe = (page, clave) =>
  page.locator("#resumen dl.resultado dt", { hasText: new RegExp(`^${clave}$`) })
    .locator("xpath=following-sibling::dd[1]");

test("el ejercicio del docente: m, b, r, la tabla y su fila Total", async ({ page }) => {
  await abrir(page, "ajuste-docente");
  const cuerpo = await resolver(page);
  expect(cuerpo.result.m).toBeCloseTo(1.9, 12);
  expect(cuerpo.result.b).toBeCloseTo(0.22, 12);
  expect(cuerpo.result.r).toBeCloseTo(0.9976, 4);

  // La ecuacion va primero y en grande; m, b y r con los decimales del ejercicio.
  await expect(page.locator("#resumen .estado-ok")).toHaveText("Ajuste calculado");
  await expect(page.locator("#resumen dt.principal")).toHaveText("ecuacion");
  await expect(page.locator("#resumen dd.principal")).toHaveText("y = 1.9x + 0.22");
  await expect(resultadoDe(page, "m")).toHaveText("1.9000");
  await expect(resultadoDe(page, "b")).toHaveText("0.2200");
  await expect(resultadoDe(page, "r")).toHaveText("0.9976");
  await expect(resultadoDe(page, "suma_residuos")).toHaveText("0.0430");
  await expect(resultadoDe(page, "n")).toHaveText("5");
  // Los totales viven en la tabla: el resumen no los repite como objeto.
  await expect(page.locator("#resumen")).not.toContainText("[object Object]");
  await expect(page.locator("#resumen dt", { hasText: /^totales$/ })).toHaveCount(0);

  await page.locator("#ver-tabla").click();
  await expect(page.locator("#tabla th")).toHaveText(
    ["i", "x_i", "y_i", "x_i*y_i", "x_i^2", "y_i^2", "error"],
  );
  const filas = page.locator("#tabla tbody tr");
  await expect(filas).toHaveCount(5);
  await expect(filas.nth(1).locator("td")).toHaveText(
    ["2", "1.5000", "3.2000", "4.8000", "2.2500", "10.2400", "0.0169"],
  );
  await expect(page.locator("#tabla tfoot tr td")).toHaveText(
    ["Total", "10.0000", "20.1000", "44.9500", "22.5000", "89.8700", "0.0430"],
  );
  await expect(page.locator("#tabla .col-error")).toHaveText(
    ["0.0144", "0.0169", "0.0064", "0.0049", "0.0004", "0.0430"],
  );

  // Cambiar los decimales reformatea sin volver a pedir nada, totales incluidos.
  await page.locator("#decimales").fill("2");
  await expect(page.locator("#tabla tfoot tr td")).toHaveText(
    ["Total", "10.00", "20.10", "44.95", "22.50", "89.87", "0.04"],
  );
});

test("la grafica muestra los puntos y la curva ajustada, rotulados como tales", async ({ page }) => {
  await abrir(page, "ajuste-docente");
  const cuerpo = await resolver(page);
  expect(cuerpo.plot.kind).toBe("ajuste");
  await expect(page.locator("#leyenda .leyenda-item")).toHaveText(["ajuste", "datos"]);
});

test("la ficha de la familia y el modelo se eligen de una lista", async ({ page }) => {
  await abrir(page);
  await expect(page.locator("body")).toHaveAttribute("data-familia", "ajuste");
  await expect(page.locator('#familia input[value="ajuste"]')).toBeChecked();

  const modelo = page.locator("select#campo-modelo");
  await expect(modelo).toHaveValue("lineal");
  expect(await modelo.locator("option").allTextContents())
    .toEqual(["lineal", "potencial", "exponencial", "logaritmica"]);
  await expect(page.locator("label[for='campo-modelo'] .campo-opcional")).toHaveText("opcional");
});

test("cada modelo cambia la formula, las columnas y la nota de la transformacion", async ({ page }) => {
  await abrir(page, "ajuste-potencial-pendulo");
  await expect(page.locator("select#campo-modelo")).toHaveValue("potencial");
  await expect(page.locator("#formula math")).toHaveAttribute("data-formula", "minimos-cuadrados-potencial");
  await resolver(page);
  await expect(page.locator("#resumen .notas")).toContainText("log en base 10");
  await page.locator("#ver-tabla").click();
  await expect(page.locator("#tabla th")).toHaveText(
    ["i", "log x_i", "log y_i", "log x_i*log y_i", "(log x_i)^2", "(log y_i)^2", "error"],
  );
  await expect(resultadoDe(page, "pendiente_lineal")).toHaveText("0.5009");

  await page.locator("select#campo-modelo").selectOption("lineal");
  await expect(page.locator("#formula math")).toHaveAttribute("data-formula", "minimos-cuadrados");
});

test("un modelo con log y datos no positivos se explica sin dibujar nada", async ({ page }) => {
  await abrir(page, "ajuste-docente");
  await page.locator("select#campo-modelo").selectOption("potencial");
  await page.getByLabel("x del punto 1").fill("0");
  const recibida = page.waitForResponse("**/minimos-cuadrados/solve");
  await page.locator("#resolver").click();
  expect((await recibida).status()).toBe(422);
  await expect(page.locator("#aviso")).toContainText("x > 0");
  await expect(page.locator("#aviso")).toContainText("punto 1");
});

test("la sustitucion de la fila pone los numeros que dio el nucleo", async ({ page }) => {
  await abrir(page, "ajuste-docente");
  await resolver(page);
  const datos = page.locator('#formula-datos math[data-sustitucion="minimos-cuadrados"]');
  await expect(datos).toBeVisible();
  const texto = await datos.textContent();
  for (const numero of ["3.0000", "5.9000", "17.7000", "44.9500", "89.8700", "1.9000", "0.9976"]) {
    expect(texto).toContain(numero);
  }
});

test("arrastrar un punto del plano cambia su y y la recta", async ({ page }) => {
  await abrir(page, "ajuste-docente");
  await resolver(page);
  const y = page.getByLabel("y del punto 3");
  const antes = await y.inputValue();
  const ecuacion = await page.locator("#resumen dd.principal").textContent();

  await page.locator("#plano").scrollIntoViewIfNeeded();
  await expect.poll(() =>
    page.evaluate(async () => (await import("/app.js")).plano.posicionAsa("p:2"))).not.toBeNull();
  const [px, py] = await page.evaluate(async () => (await import("/app.js")).plano.posicionAsa("p:2"));
  const caja = await page.locator("#plano").boundingBox();
  await page.mouse.move(caja.x + px, caja.y + py);
  await page.mouse.down();
  await page.mouse.move(caja.x + px, caja.y + py - 40, { steps: 10 });
  await page.mouse.up();

  await expect(y).not.toHaveValue(antes);
  await expect.poll(() => page.locator("#resumen dd.principal").textContent()).not.toBe(ecuacion);
});

test("a 375 px no hay scroll horizontal con el resultado y la tabla del ajuste", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await abrir(page, "ajuste-exponencial-crecimiento");
  await resolver(page);
  await page.locator("#ver-tabla").click();
  await expect(page.locator("#tabla tfoot tr")).toBeVisible();
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

// Los colores de la familia, en claro y oscuro: el texto de la ficha marcada
// (color sobre su fondo) tiene que pasar el contraste AA de 4.5.
for (const tema of ["light", "dark"]) {
  test(`la familia Ajuste tiene contraste AA en tema ${tema}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema });
    await abrir(page);
    const razon = await page.evaluate(() => {
      const cara = document.querySelector('#familia input[value="ajuste"] + .cara');
      const estilo = getComputedStyle(cara);
      const luz = (css) => {
        const [r, g, b] = css.match(/[\d.]+/g).slice(0, 3).map((v) => {
          const c = Number(v) / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const [claro, oscuro] = [luz(estilo.color), luz(estilo.backgroundColor)].sort((p, q) => q - p);
      return (claro + 0.05) / (oscuro + 0.05);
    });
    expect(razon).toBeGreaterThanOrEqual(4.5);
  });
}

// ------------------------------------------------------------------ teoria

test("Teoria del ajuste: se lee sin resolver y trae el ejemplo del docente", async ({ page }) => {
  await abrir(page);
  await expect(page.locator("#ver-teoria")).toBeVisible();
  await page.locator("#ver-teoria").click();
  const teoria = page.locator("#panel-teoria");
  await expect(teoria).toBeVisible();
  await expect(teoria.getByRole("heading", { level: 3 })).toHaveText([
    "Qué resuelve", "Fórmulas", "Cómo leer r", "Modelos que no son rectas",
    "Pasos", "Ejemplo del docente",
  ]);
  await expect(teoria).toContainText("y = 1.9x + 0.22");
  await expect(teoria).toContainText("0.0430");
  await expect(teoria).toContainText("0.9976");
  expect(await teoria.locator("math").count()).toBeGreaterThanOrEqual(5);
});

for (const ancho of [320, 375]) {
  test(`la teoria del ajuste no desborda la pagina a ${ancho} px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 812 });
    await abrir(page);
    await page.locator("#ver-teoria").click();
    await expect(page.locator("#panel-teoria")).toBeVisible();
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

for (const tema of ["light", "dark"]) {
  test(`la teoria del ajuste es legible en tema ${tema} (contraste AA del texto)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema });
    await abrir(page);
    await page.locator("#ver-teoria").click();
    const peor = await page.evaluate(() => {
      const num = (c) => c.match(/[\d.]+/g).map(Number);
      const lum = ([r, g, b]) => {
        const l = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
      };
      const fondo = (el) => {
        for (let e = el; e; e = e.parentElement) {
          const v = num(getComputedStyle(e).backgroundColor);
          if (v.length < 4 || v[3] > 0.5) return v.slice(0, 3);
        }
        return [255, 255, 255];
      };
      let min = 21;
      for (const el of document.querySelectorAll("#panel-teoria p, #panel-teoria li, #panel-teoria h3, #panel-teoria h4")) {
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
