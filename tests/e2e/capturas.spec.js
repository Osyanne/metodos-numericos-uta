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
import { esperarDesplegable, elegirMetodo } from "./desplegable.js";

const DESTINO = fileURLToPath(new URL("../../docs/capturas/", import.meta.url));

test.skip(!process.env.CAPTURAS, "solo a pedido: CAPTURAS=1");
test.use({ viewport: { width: 1280, height: 820 } });

// Resolver deja la pagina desplazada, y una captura que empieza a la mitad no
// sirve para explicar donde esta cada cosa.
async function arriba(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
}

// Al resolver, el plano se dibuja con una animacion de 2 s (DURACION_ANIMACION
// en web/plano.js). Una captura tomada antes muestra la curva a medio trazar.
async function dibujoTerminado(page) {
  await page.waitForTimeout(2300);
}

// Un punto del plano de la aplicacion en coordenadas de pagina: la raiz o un
// asa. Lo calcula el propio plano, asi no depende de donde quede el lienzo.
async function puntoDelPlano(page, cual) {
  const [px, py] = await page.evaluate(async (cual) => {
    const { plano } = await import("/app.js");
    if (cual !== "raiz") return plano.posicionAsa(cual);
    const raiz = plano.capas.find((c) => c.nombre === "raiz").puntos[0];
    return plano._aPantalla(raiz.x, raiz.y);
  }, cual);
  const caja = await page.locator("#plano").boundingBox();
  return [caja.x + px, caja.y + py];
}

test("capturas del manual", async ({ page }) => {
  await page.goto("/");
  await esperarDesplegable(page);

  // Un caso que se explica solo: el ejercicio resuelto del docente.
  await elegirMetodo(page, "von-mises");
  await page.locator("#preset").selectOption("von-mises-docente");
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();

  await dibujoTerminado(page);
  await arriba(page);
  await page.screenshot({ path: `${DESTINO}01-pantalla-principal.png` });

  await page.locator("#ver-tabla").click();
  await expect(page.locator("#tabla tbody tr").first()).toBeVisible();
  await arriba(page);
  await page.screenshot({ path: `${DESTINO}02-tabla-iteraciones.png` });

  // El plano con un sistema de dos EDO, que es donde se luce: dos series.
  await page.locator("#ver-plano").click();
  await elegirMetodo(page, "runge-kutta");
  await page.locator("#preset").selectOption("runge-kutta-sistema");
  await page.locator("#resolver").click();
  await expect(page.locator("#leyenda .leyenda-item").first()).toBeVisible();
  await dibujoTerminado(page);
  await arriba(page);
  await page.screenshot({ path: `${DESTINO}03-plano.png` });

  // El recorrido: Von Mises en la iteracion 1, con la barra, la franja de la
  // fila y la formula con los numeros a la vista.
  await elegirMetodo(page, "von-mises");
  await page.locator("#preset").selectOption("von-mises-docente");
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
  await page.locator("#paso-primero").click();
  await page.locator("#paso-siguiente").click();
  await expect(page.locator("#paso-rotulo")).toHaveText("iteración 1 de 12");
  await expect(page.locator("#formula-datos")).toContainText("En la iteración 1:");
  // La franja queda bajo el plano, mas abajo de lo que alcanza el viewport
  // comun; con esta altura entran la barra, el plano, la franja y la formula.
  await page.setViewportSize({ width: 1280, height: 1250 });
  await dibujoTerminado(page);
  await arriba(page);
  // Con la vista inicial todos los puntos caen casi sobre la raiz: se acerca
  // a ella para que se vean el elemento actual y los siguientes, atenuados.
  await page.mouse.move(...await puntoDelPlano(page, "raiz"));
  for (let i = 0; i < 16; i++) await page.mouse.wheel(0, -300);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DESTINO}04-recorrido.png` });

  // El arrastre: √2 con Newton-Raphson, con el asa x0 tomada y llevada de 1
  // hacia la izquierda, donde las tangentes se ven. Se fotografia con el boton
  // todavia apretado.
  await page.setViewportSize({ width: 1280, height: 820 });
  await elegirMetodo(page, "newton-raphson");
  await page.locator("#preset").selectOption("newton-raiz-de-dos");
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
  await dibujoTerminado(page);
  // Solo la tarjeta del plano: con la pagina arriba el eje queda bajo el borde.
  await page.locator("#plano").scrollIntoViewIfNeeded();
  const [x, y] = await puntoDelPlano(page, "x0");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 90, y, { steps: 10 });
  await expect(page.locator("#campo-x0")).not.toHaveValue("1");
  await page.waitForTimeout(600);
  await page.locator("#tarjeta-plano").screenshot({ path: `${DESTINO}05-arrastre.png` });
  await page.mouse.up();
});
