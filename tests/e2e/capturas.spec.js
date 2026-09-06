// Genera las capturas del manual de usuario contra el aplicativo real.
//
// No corre en la suite normal: un manual con capturas viejas es peor que uno
// sin capturas, y regenerarlas en cada corrida ensucia el diff sin motivo. Se
// piden a mano cuando la interfaz cambia:
//
//     CAPTURAS=1 npx playwright test capturas
//
// En Windows (PowerShell):  $env:CAPTURAS=1; npx playwright test capturas
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const DESTINO = fileURLToPath(new URL("../../docs/capturas/", import.meta.url));

test.skip(!process.env.CAPTURAS, "solo a pedido: CAPTURAS=1");
test.use({ viewport: { width: 1280, height: 820 } });

// Resolver deja la pagina desplazada, y una captura que empieza a la mitad no
// sirve para explicar donde esta cada cosa.
async function arriba(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
}

test("capturas del manual", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#metodo option")).toHaveCount(4);

  // Un caso que se explica solo: el ejercicio resuelto del docente.
  await page.locator("#metodo").selectOption("von-mises");
  await page.locator("#preset").selectOption("von-mises-docente");
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();

  await arriba(page);
  await page.screenshot({ path: `${DESTINO}01-pantalla-principal.png` });

  await page.locator("#ver-tabla").click();
  await expect(page.locator("#tabla tbody tr").first()).toBeVisible();
  await arriba(page);
  await page.screenshot({ path: `${DESTINO}02-tabla-iteraciones.png` });

  // El plano con un sistema de dos EDO, que es donde se luce: dos series.
  await page.locator("#ver-plano").click();
  await page.locator("#metodo").selectOption("runge-kutta");
  await page.locator("#preset").selectOption("runge-kutta-sistema");
  await page.locator("#resolver").click();
  await expect(page.locator("#leyenda .leyenda-item").first()).toBeVisible();
  await arriba(page);
  await page.screenshot({ path: `${DESTINO}03-plano.png` });
});
