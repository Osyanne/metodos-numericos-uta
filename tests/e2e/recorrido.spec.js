import { test, expect } from "@playwright/test";
import { esperarDesplegable, elegirMetodo } from "./desplegable.js";

// Von Mises con el ejercicio del docente: 13 filas, de la iteracion 0 a la 12.
async function resolver(page, slug = "von-mises", preset = "von-mises-docente") {
  await page.goto("/");
  await esperarDesplegable(page);
  await elegirMetodo(page, slug);
  await page.locator("#preset").selectOption(preset);
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
}

// Reloj falso detenido: sin esto sigue corriendo a velocidad real y una
// reproduccion vieja termina sola mientras la prueba espera.
async function relojDetenido(page) {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01"));
}

test.describe("recorrido", () => {
  test("al resolver queda en la última iteración", async ({ page }) => {
    await resolver(page);
    await expect(page.locator("#paso-rotulo")).toHaveText("iteración 12 de 12");
    await expect(page.locator("#fila-actual")).toContainText("1.30979958");
    await expect(page.locator("#paso")).toHaveAttribute("aria-valuetext", "iteración 12 de 12");
  });

  test("los botones mueven deslizador, tabla y franja juntos", async ({ page }) => {
    await resolver(page);
    await page.locator("#paso-primero").click();
    await expect(page.locator("#paso")).toHaveValue("0");
    await expect(page.locator('#tabla tr[aria-current="true"]')).toHaveAttribute("data-indice", "0");
    await expect(page.locator("#fila-actual")).toContainText("1.00000000");
    await page.locator("#paso-siguiente").click();
    await expect(page.locator("#paso-rotulo")).toHaveText("iteración 1 de 12");
    await page.locator("#paso-ultimo").click();
    await expect(page.locator("#paso")).toHaveValue("12");
    await page.locator("#paso-anterior").click();
    await expect(page.locator("#paso")).toHaveValue("11");
  });

  test("reproducir llega al final y se detiene", async ({ page }) => {
    await page.clock.install();
    await resolver(page);
    await page.locator("#paso-primero").click();
    await page.locator("#paso-reproducir").click();
    await expect(page.locator("#paso-reproducir")).toHaveAttribute("aria-label", "Pausar");
    await expect(page.locator("#fila-actual")).toHaveAttribute("aria-live", "off");
    await page.clock.runFor(20_000);
    await expect(page.locator("#paso")).toHaveValue("12");
    await expect(page.locator("#paso-reproducir")).toHaveAttribute("aria-label", "Reproducir");
    await expect(page.locator("#fila-actual")).toHaveAttribute("aria-live", "polite");
  });

  test("pausar detiene la reproducción y cualquier control también", async ({ page }) => {
    await page.clock.install();
    await resolver(page);
    await page.locator("#paso-primero").click();
    await page.locator("#paso-reproducir").click();
    await page.clock.runFor(1_300);
    await page.locator("#paso-reproducir").click();
    const k = await page.locator("#paso").inputValue();
    expect(Number(k)).toBeGreaterThan(0);
    await page.clock.runFor(5_000);
    await expect(page.locator("#paso")).toHaveValue(k);

    await page.locator("#paso-reproducir").click();
    await page.locator("#paso-primero").click();
    await page.clock.runFor(5_000);
    await expect(page.locator("#paso")).toHaveValue("0");
    await expect(page.locator("#paso-reproducir")).toHaveAttribute("aria-label", "Reproducir");
  });

  test("con el deslizador enfocado, las flechas e Inicio lo mueven", async ({ page }) => {
    await resolver(page);
    await page.locator("#paso").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#paso")).toHaveValue("11");
    await expect(page.locator("#paso-rotulo")).toHaveText("iteración 11 de 12");
    await page.keyboard.press("Home");
    await expect(page.locator("#paso")).toHaveValue("0");
    await expect(page.locator('#tabla tr[aria-current="true"]')).toHaveAttribute("data-indice", "0");
  });

  test("clic en una fila lleva el recorrido ahí", async ({ page }) => {
    await resolver(page);
    await page.locator("#ver-tabla").click();
    await page.locator('#tabla tr[data-indice="3"]').click();
    await expect(page.locator("#paso")).toHaveValue("3");
    await expect(page.locator('#tabla tr[aria-current="true"]')).toHaveAttribute("data-indice", "3");
    await expect(page.locator('#tabla tr[aria-current="true"]')).toHaveClass(/actual/);
  });

  test("clic en el plano elige la fila", async ({ page }) => {
    await page.goto("/");
    await esperarDesplegable(page);
    await elegirMetodo(page, "punto-medio");
    await page.locator("#campo-fx").fill("x^2");
    await page.locator("#campo-a").fill("0");
    await page.locator("#campo-b").fill("2");
    await page.locator("#campo-n").fill("4");
    await page.locator("#resolver").click();
    await expect(page.locator("#resumen .estado")).toBeVisible();
    await page.locator("#paso-primero").click();
    await expect(page.locator("#paso")).toHaveValue("0");

    const lienzo = page.locator("#plano");
    await lienzo.scrollIntoViewIfNeeded();
    const caja = await lienzo.boundingBox();
    // Margenes del area de dibujo: 56 px a la izquierda y 16 a la derecha.
    await page.mouse.click(
      caja.x + 56 + 0.6 * (caja.width - 72),
      caja.y + caja.height / 2,
    );
    await expect(page.locator("#paso")).toHaveValue("2");
  });

  test("Lagrange pide al núcleo el término de la fila", async ({ page }) => {
    await page.goto("/");
    await esperarDesplegable(page);
    await elegirMetodo(page, "interpolacion-lagrange");
    await page.locator("#preset").selectOption("lagrange-docente");
    const [respuesta] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/solve")),
      page.locator("#resolver").click(),
    ]);
    const fila0 = (await respuesta.json()).iterations[0];
    expect(typeof fila0.values.termino).toBe("string");

    const peticion = page.waitForRequest((r) =>
      r.url().endsWith("/api/plot/sample")
      && r.postDataJSON().expression === fila0.values.termino);
    await page.locator("#paso-primero").click();
    const cuerpo = (await peticion).postDataJSON();
    expect(cuerpo.variables).toEqual(["x"]);
    expect(cuerpo.points).toBe(200);
    expect(cuerpo.x_min).toBeLessThan(cuerpo.x_max);
  });

  test("se oculta al cambiar de método y vuelve con cada resultado", async ({ page }) => {
    await resolver(page);
    await expect(page.locator("#recorrido")).toBeVisible();
    await elegirMetodo(page, "newton-raphson");
    await expect(page.locator("#recorrido")).toBeHidden();
    await expect(page.locator("#fila-actual")).toBeEmpty();
    await page.locator("#preset").selectOption("newton-clasico");
    await page.locator("#resolver").click();
    await expect(page.locator("#recorrido")).toBeVisible();
    await page.locator("#preset").selectOption("newton-raiz-de-dos");
    await expect(page.locator("#recorrido")).toBeHidden();
  });

  test("a 375 px la barra cabe sin desplazamiento horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await resolver(page);
    await expect(page.locator("#recorrido")).toBeVisible();
    const r = await page.evaluate(() => {
      const barra = document.querySelector("#recorrido");
      const b = barra.getBoundingClientRect();
      return {
        pagina: document.documentElement.scrollWidth - window.innerWidth,
        derecha: b.right - window.innerWidth,
        izquierda: b.left,
        barra: barra.scrollWidth - barra.clientWidth,
      };
    });
    expect(r.pagina).toBeLessThanOrEqual(0);
    expect(r.derecha).toBeLessThanOrEqual(0);
    expect(r.izquierda).toBeGreaterThanOrEqual(0);
    expect(r.barra).toBeLessThanOrEqual(0);
  });

  test("cualquier control corta la animación de entrada", async ({ page }) => {
    await page.clock.install();
    await resolver(page);
    await page.clock.runFor(300); // a mitad de la animacion
    await page.locator("#paso-anterior").click();
    const antes = await page.locator("#plano").evaluate((c) => c.toDataURL());
    await page.clock.runFor(3_000);
    const despues = await page.locator("#plano").evaluate((c) => c.toDataURL());
    expect(despues).toBe(antes);
  });

  // ---- puntos de revision

  test("resolver de nuevo mientras reproduce detiene y vuelve a la última", async ({ page }) => {
    await relojDetenido(page);
    await resolver(page);
    await page.locator("#paso-primero").click();
    await page.locator("#paso-reproducir").click();
    await page.clock.runFor(1_300);
    await page.locator("#resolver").click();
    await expect(page.locator("#resolver")).toBeEnabled();
    // Antes de seguir el reloj: la reproduccion vieja ya no puede estar viva.
    await expect(page.locator("#paso-reproducir")).toHaveAttribute("aria-label", "Reproducir");
    await expect(page.locator("#paso")).toHaveValue("12");
    await page.clock.runFor(20_000);
    await expect(page.locator("#paso")).toHaveValue("12");
    await expect(page.locator("#paso-reproducir")).toHaveAttribute("aria-label", "Reproducir");
  });

  test("Resolver pausa la reproducción sin esperar la respuesta", async ({ page }) => {
    await relojDetenido(page);
    await resolver(page);
    await page.locator("#paso-primero").click();
    await page.locator("#paso-reproducir").click();
    await page.clock.runFor(1_300);
    let soltar;
    const retenida = new Promise((r) => { soltar = r; });
    await page.route("**/solve", async (ruta) => { await retenida; await ruta.continue(); });
    await page.locator("#resolver").click();
    await expect(page.locator("#resolver")).toBeDisabled();
    await expect(page.locator("#paso-reproducir")).toHaveAttribute("aria-label", "Reproducir");
    const k = await page.locator("#paso").inputValue();
    await page.clock.runFor(5_000);
    await expect(page.locator("#paso")).toHaveValue(k);
    soltar();
    await expect(page.locator("#resolver")).toBeEnabled();
    await expect(page.locator("#paso")).toHaveValue("12");
  });

  test("un paso repinta el plano una sola vez", async ({ page }) => {
    await page.addInitScript(() => {
      window.limpiados = 0;
      const original = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...a) {
        window.limpiados += 1;
        return original.apply(this, a);
      };
    });
    await page.clock.install();
    await resolver(page);
    await page.clock.runFor(2_500); // termina la animacion de entrada
    const antes = await page.evaluate(() => window.limpiados);
    await page.locator("#paso-anterior").click();
    await expect(page.locator("#paso")).toHaveValue("11");
    expect(await page.evaluate(() => window.limpiados) - antes).toBe(1);
  });

  test("solo los movimientos del usuario desplazan la tabla", async ({ page }) => {
    await page.addInitScript(() => {
      window.desplazos = 0;
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (...a) {
        window.desplazos += 1;
        return original.apply(this, a);
      };
    });
    await page.goto("/");
    await esperarDesplegable(page);
    await elegirMetodo(page, "punto-medio");
    await page.locator("#campo-fx").fill("x^2");
    await page.locator("#campo-a").fill("0");
    await page.locator("#campo-b").fill("2");
    await page.locator("#campo-n").fill("40");
    await page.locator("#ver-tabla").click();
    await page.locator("#resolver").click();
    await expect(page.locator("#resumen .estado")).toBeVisible();
    // Resolver y mover Decimales no son pasos del usuario.
    await page.locator("#decimales").scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => window.scrollY);
    await page.locator("#decimales").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#decimales-valor")).toHaveText("7");
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
    expect(await page.evaluate(() => window.desplazos)).toBe(0);
    // Un clic en una fila si lo es: la fila sigue a la vista.
    await page.locator('#tabla tr[data-indice="5"]').click();
    await expect(page.locator("#paso")).toHaveValue("5");
    expect(await page.evaluate(() => window.desplazos)).toBe(1);
  });

  test("cargar sin filas avisa que no hay paso", async ({ page }) => {
    await page.goto("/");
    const avisos = await page.evaluate(async () => {
      const { montarRecorrido } = await import("/recorrido.js");
      const avisos = [];
      const r = montarRecorrido({
        raiz: document.querySelector("#recorrido"),
        alCambiar: (k, porUsuario) => avisos.push([k, porUsuario]),
      });
      r.cargar([], "iteración");
      return avisos;
    });
    expect(avisos).toEqual([[null, false]]);
  });

  test("comparar mientras reproduce oculta la barra", async ({ page }) => {
    const errores = [];
    page.on("pageerror", (e) => errores.push(e.message));
    await page.clock.install();
    await resolver(page);
    await page.locator("#paso-primero").click();
    await page.locator("#paso-reproducir").click();
    await page.locator("#comparar").click();
    await expect(page.locator("#comparacion table")).toBeVisible();
    await expect(page.locator("#recorrido")).toBeHidden();
    await page.clock.runFor(10_000);
    expect(errores).toEqual([]);
  });

  test("un resultado de una fila no muestra la barra", async ({ page }) => {
    const errores = [];
    page.on("pageerror", (e) => errores.push(e.message));
    await page.goto("/");
    await esperarDesplegable(page);
    await elegirMetodo(page, "newton-raphson");
    await page.locator("#campo-fx").fill("x - 1");
    await page.locator("#campo-x0").fill("1");
    await page.locator("#resolver").click();
    await expect(page.locator("#resumen .estado")).toBeVisible();
    await expect(page.locator("#tabla tbody tr")).toHaveCount(1);
    await expect(page.locator("#recorrido")).toBeHidden();
    expect(errores).toEqual([]);
  });

  test("un método que diverge se recorre sin errores", async ({ page }) => {
    const errores = [];
    page.on("pageerror", (e) => errores.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    await resolver(page, "von-mises", "von-mises-divergente");
    await page.locator("#paso-primero").click();
    await expect(page.locator("#paso")).toHaveValue("0");
    await page.locator("#paso-ultimo").click();
    const ultimo = await page.locator("#paso").getAttribute("max");
    await expect(page.locator("#paso")).toHaveValue(ultimo);
    expect(errores).toEqual([]);
  });
});
