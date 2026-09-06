import { test, expect } from "@playwright/test";

const casos = [
  ["newton-raphson", "newton-clasico", ["i", "xi", "f(xi)", "x(i+1)", "error"]],
  ["von-mises", "von-mises-docente", ["i", "xi", "f(xi)", "x(i+1)", "error"]],
  ["interpolacion-newton", "interpolacion-logaritmo", ["i", "x", "f(x)", "Diferencia dividida 1", "Diferencia dividida 2", "error"]],
  ["runge-kutta", "runge-kutta-escalar", ["i", "x", "y", "error"]],
];

async function cargar(page, metodo, preset) {
  await page.goto("/");
  await page.locator("#metodo").selectOption(metodo);
  await page.locator("#preset").selectOption(preset);
}

async function resolver(page, metodo) {
  const recibida = page.waitForResponse(`**/${metodo}/solve`);
  await page.locator("#resolver").click();
  const response = await recibida;
  expect(response.status()).toBe(200);
  await expect(page.locator("#tabla tbody tr").first()).toBeAttached();
  return response.json();
}

for (const [metodo, preset, columnas] of casos) {
  test(`${metodo}: preset completo, resolución real y columnas`, async ({ page }) => {
    await cargar(page, metodo, preset);
    const resultado = await resolver(page, metodo);
    expect(resultado.method).toBe(metodo);
    await page.locator("#ver-tabla").click();
    await expect(page.locator("#tabla th")).toHaveText(columnas);
    await expect(page.locator("#tabla tbody tr")).toHaveCount(resultado.iterations.length);
    await expect(page.locator("#aviso")).toBeHidden();
    const peticiones = [];
    page.on("request", request => {
      if (request.url().endsWith("/solve")) peticiones.push(request);
    });
    await page.locator("#decimales").fill("3");
    await expect(page.locator("#tabla tbody tr").first().locator("td").nth(1))
      .toHaveText(Object.values(resultado.iterations[0].values)[0].toFixed(3));
    expect(peticiones).toHaveLength(0);
  });
}

test("Runge-Kutta sistema: dos series y valor final del oscilador", async ({ page }) => {
  await cargar(page, "runge-kutta", "runge-kutta-sistema");
  const resultado = await resolver(page, "runge-kutta");
  await expect(page.locator("#leyenda .leyenda-item")).toHaveText(["y1", "y2"]);
  expect(resultado.iterations).toHaveLength(17);
  const ultima = resultado.iterations.at(-1).values;
  expect(ultima.y1).toBeCloseTo(Math.cos(1.6), 5);
  expect(ultima.y2).toBeCloseTo(-Math.sin(1.6), 5);
  await page.locator("#ver-tabla").click();
  await expect(page.locator("#tabla th")).toHaveText(["i", "x", "y1", "y2", "error"]);
});

// Estos casos exigen el contrato congelado al backend REAL. No se omiten ni
// sustituyen respuestas: deben quedar verdes al integrar el carril A.
test("@contrato-a Runge-Kutta completa la integración y no inventa error", async ({ page }) => {
  await cargar(page, "runge-kutta", "runge-kutta-sistema");
  const resultado = await resolver(page, "runge-kutta");
  expect.soft(resultado.stop_reason).toBe("integracion_completada");
  expect.soft(resultado.iterations.every(fila => fila.error === null)).toBe(true);
  expect.soft(resultado.notes.length).toBeGreaterThan(0);
  await expect.soft(page.locator("#resumen .estado-ok")).toHaveText("Integración completada");
  await page.locator("#ver-tabla").click();
  await expect(page.locator("#tabla .col-error")).toHaveText(Array(17).fill("—"));
});

test("@contrato-a Von Mises divergente explica la causa sin marcar una raíz", async ({ page }) => {
  await cargar(page, "von-mises", "von-mises-divergente");
  const resultado = await resolver(page, "von-mises");
  expect(resultado.stop_reason).toBe("divergio");
  expect.soft(resultado.result.raiz).toBeNull();
  expect.soft(resultado.plot.series.root).toBeNull();
  expect(resultado.notes.length).toBeGreaterThan(0);
  await expect(page.locator("#resumen .estado-mal")).toHaveText("El método diverge");
  await expect.soft(page.locator("#leyenda")).not.toContainText("raiz");
  const valorRaiz = page.locator("#resumen dt").filter({ hasText: /^raiz$/ }).locator("+ dd");
  await expect(valorRaiz).toHaveText("—");
});

test("cargar otro preset reemplaza todos los datos y limpia el resultado", async ({ page }) => {
  await cargar(page, "runge-kutta", "runge-kutta-sistema");
  await resolver(page, "runge-kutta");
  await page.locator("#iteraciones").fill("2");
  await page.locator("#tolerancia").fill("0.5");
  await page.locator("#criterio").selectOption("absoluto");
  await page.locator("#parar").check();
  await page.locator("#preset").selectOption("runge-kutta-escalar");
  await expect(page.locator("#tabla")).toBeEmpty();
  await expect(page.locator("#leyenda")).toBeEmpty();
  await expect(page.locator("#iteraciones")).toHaveValue("50");
  await expect(page.locator("#tolerancia")).toHaveValue("0.000001");
  await expect(page.locator("#criterio")).toHaveValue("relativo_porcentual");
  await expect(page.locator("#parar")).not.toBeChecked();
  const recibido = await resolver(page, "runge-kutta");
  expect(recibido.columns.map(c => c.key)).toEqual(["x", "y"]);
  expect(recibido.iterations).toHaveLength(6);
});
