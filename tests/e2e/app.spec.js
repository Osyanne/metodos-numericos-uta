import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#metodo option")).toHaveCount(4);
});

async function resolverNewton(page) {
  await page.locator("#metodo").selectOption("newton-raphson");
  await page.locator("#resolver").click();
  await expect(page.locator("#tabla tbody tr").first()).toBeAttached();
}

async function cambiarDecimales(page) {
  await page.locator("#decimales").fill("9");
}

test("cambiar método y decimales no resucita resultados ni leyenda", async ({ page }) => {
  await resolverNewton(page);
  await page.locator("#metodo").selectOption("runge-kutta");
  await cambiarDecimales(page);
  await expect(page.locator("#resumen")).toBeEmpty();
  await expect(page.locator("#tabla")).toBeEmpty();
  await expect(page.locator("#leyenda")).toBeEmpty();
});

// Se retiene una respuesta REAL para reproducir carreras de forma determinista.
async function retener(page, patron) {
  let entregar;
  let preparada;
  const lista = new Promise((resolve) => { preparada = resolve; });
  const liberada = new Promise((resolve) => { entregar = resolve; });
  await page.route(patron, async (route) => {
    const response = await route.fetch();
    preparada();
    await liberada;
    await route.fulfill({ response });
  }, { times: 1 });
  return { lista, entregar };
}

for (const volver of [false, true]) {
  test(`descarta resolución tardía${volver ? " incluso al volver al mismo método" : " al cambiar método"}`, async ({ page }) => {
    const retenida = await retener(page, "**/newton-raphson/solve");
    await page.locator("#resolver").click();
    await retenida.lista;
    await page.locator("#metodo").selectOption("runge-kutta");
    if (volver) await page.locator("#metodo").selectOption("newton-raphson");
    const recibida = page.waitForResponse("**/newton-raphson/solve");
    retenida.entregar();
    await recibida;
    await expect(page.locator("#resolver")).toBeEnabled();
    await cambiarDecimales(page);
    await expect(page.locator("#resumen")).toBeEmpty();
    await expect(page.locator("#tabla")).toBeEmpty();
  });
}

test("una resolución fallida no conserva un resultado reformateable", async ({ page }) => {
  await resolverNewton(page);
  await page.locator("#formulario input").first().fill("x +");
  await page.locator("#resolver").click();
  await expect(page.locator("#aviso")).toBeVisible();
  await cambiarDecimales(page);
  await expect(page.locator("#tabla")).toBeEmpty();
});

test("una comparación tardía no dibuja sobre otro método", async ({ page }) => {
  const retenida = await retener(page, "**/newton-raphson/solve");
  await page.locator("#comparar").click();
  await retenida.lista;
  await page.locator("#metodo").selectOption("runge-kutta");
  const recibida = page.waitForResponse("**/newton-raphson/solve");
  retenida.entregar();
  await recibida;
  await expect(page.locator("#comparar")).toBeEnabled();
  await expect(page.locator("#comparacion")).toBeEmpty();
  await expect(page.locator("#leyenda")).toBeEmpty();
});

test("integración completada se presenta en verde y errores null como raya", async ({ page }) => {
  await page.evaluate(async () => {
    const { dibujarResumen, dibujarTabla } = await import("/tabla.js");
    const resultado = {
      stop_reason: "integracion_completada", result: { pasos: 1 },
      columns: [{ key: "y", label: "y" }],
      iterations: [{ n: 0, values: { y: 1 }, error: null }],
    };
    dibujarResumen(document.querySelector("#resumen"), resultado, 6);
    dibujarTabla(document.querySelector("#tabla"), resultado, 6);
  });
  await expect(page.locator("#resumen .estado-ok")).toHaveText("Integracion completada");
  await expect(page.locator("#tabla .col-error")).toHaveText("—");
});

for (const formato of ["csv", "pdf"]) {
  test(`exporta ${formato.toUpperCase()} real y bloquea duplicados durante descarga`, async ({ page }) => {
    const retenida = await retener(page, `**/export/${formato}`);
    const boton = page.locator(`#exportar-${formato}`);
    await boton.click();
    await retenida.lista;
    await expect(boton).toBeDisabled();
    const descargada = page.waitForEvent("download");
    retenida.entregar();
    const descarga = await descargada;
    expect(descarga.suggestedFilename()).toBe(`newton-raphson.${formato}`);
    expect(await descarga.failure()).toBeNull();
    const contenido = await readFile(await descarga.path());
    if (formato === "pdf") expect(contenido.subarray(0, 5).toString()).toBe("%PDF-");
    else {
      expect(contenido.toString("utf8")).toContain("error");
      expect(contenido.toString("utf8")).toContain("2.100000");
    }
    await expect(boton).toBeEnabled();
  });
}

test("exportar conserva el detail de la API y recupera el botón", async ({ page }) => {
  await page.locator("#formulario input").first().fill("x +");
  const recibida = page.waitForResponse("**/export/csv");
  await page.locator("#exportar-csv").click();
  const response = await recibida;
  expect(response.status()).toBe(422);
  const { detail } = await response.json();
  await expect(page.locator("#aviso")).toHaveText(detail);
  await expect(page.locator("#exportar-csv")).toBeEnabled();
});

test("un fallo de red al exportar se informa y recupera el botón", async ({ page }) => {
  await page.route("**/export/pdf", (route) => route.abort("failed"));
  await page.locator("#exportar-pdf").click();
  await expect(page.locator("#aviso")).toBeVisible();
  await expect(page.locator("#exportar-pdf")).toBeEnabled();
});
