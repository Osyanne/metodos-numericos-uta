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

// Entra al primer metodo por su tarjeta, como la persona.
async function abrirPrimero(page) {
  await page.locator("a.tarjeta-metodo").first().click();
  await expect(page.locator("#vista-metodo")).toBeVisible();
}

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
  // La app abre en la portada: una tarjeta por metodo, agrupadas por familia.
  await esperarDesplegable(page, { portada: true });
  await expect(page.locator("#portada")).toBeVisible();
  await page.waitForTimeout(500);
  await arriba(page);
  await page.screenshot({ path: `${DESTINO}06-portada.png` });
  await abrirPrimero(page);

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

// Simpson 3/8 con n = 5 (1/3 en los dos primeros subintervalos y 3/8 en el
// resto) y su pestana Teoria, que se lee sin resolver.
test("capturas de Simpson 3/8", async ({ page }) => {
  await page.goto("/");
  await esperarDesplegable(page);
  await elegirMetodo(page, "simpson-38");
  await page.locator("#preset").selectOption("simpson-38-chapra-n5");
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
  await dibujoTerminado(page);
  await arriba(page);
  await page.screenshot({ path: `${DESTINO}07-simpson-38.png` });

  await page.locator("#ver-teoria").click();
  await expect(page.locator("#panel-teoria")).toBeVisible();
  // La pestana vive en la tarjeta de abajo: se lleva su borde superior al
  // borde de la ventana para que la captura empiece en la barra de pestanas.
  await page.locator("#tarjeta-plano").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 8));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${DESTINO}08-teoria-simpson-38.png` });
});
