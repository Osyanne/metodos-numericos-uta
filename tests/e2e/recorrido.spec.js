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

// Un ejercicio por método más las variantes con su propia sustitución; `k` es
// cuántos pasos se avanza desde la fila 0 (Interpolación de Newton adelante y
// atrás se miran en k = 2, donde la diferencia no está en la fila elegida).
const EJERCICIOS = [
  ["newton-raphson", "newton-clasico", 1],
  ["von-mises", "von-mises-docente", 1],
  ["interpolacion-newton", "interpolacion-newton-docente", 0],
  ["interpolacion-newton", "interpolacion-newton-adelante", 2],
  ["interpolacion-newton", "interpolacion-newton-atras", 2],
  ["interpolacion-lagrange", "lagrange-docente", 1],
  ["punto-medio", "punto-medio-docente", 0],
  ["trapecio", "trapecio-docente", 1],
  ["simpson", "simpson-docente", 1],
  ["runge-kutta", "runge-kutta-escalar", 1],
  ["runge-kutta", "runge-kutta-heun", 1],
  ["runge-kutta", "runge-kutta-sistema", 1],
];

async function irAlPaso(page, k) {
  await page.locator("#paso-primero").click();
  for (let i = 0; i < k; i++) await page.locator("#paso-siguiente").click();
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

  // ---- fórmula con los números de la iteración elegida

  test("Von Mises sustituye f′(x₀) en la iteración elegida", async ({ page }) => {
    await resolver(page);
    await page.locator("#paso-primero").click();
    const s = page.locator('#formula-datos math[data-sustitucion="von-mises"]');
    await expect(page.locator("#formula-datos")).toContainText("En la iteración 0:");
    await expect(s).toContainText("(−1.36787944)");
    await expect(s).toContainText("0.36787944");
    await page.locator("#paso-siguiente").click();
    await expect(page.locator("#formula-datos")).toContainText("En la iteración 1:");
    await expect(s).toContainText("1.26894142");
  });

  test("cada método muestra su sustitución con resultado", async ({ page }) => {
    for (const [slug, preset, k] of EJERCICIOS) {
      await resolver(page, slug, preset);
      await irAlPaso(page, k);
      const s = page.locator(`#formula-datos math[data-sustitucion="${slug}"]`);
      await expect(s, preset).toBeVisible();
      // Una clave mal escrita deja "—" en lugar del número.
      await expect(s, preset).not.toContainText("—");
    }
  });

  test("Runge-Kutta muestra la condición inicial en la fila 0 y los k después", async ({ page }) => {
    await resolver(page, "runge-kutta", "runge-kutta-escalar");
    const s = page.locator('#formula-datos math[data-sustitucion="runge-kutta"]');
    await page.locator("#paso-primero").click();
    await expect(s).toContainText("condición inicial");
    await page.locator("#paso-siguiente").click();
    await expect(s).not.toContainText("condición inicial");
    await expect(s).toContainText("0.100000"); // h
    await expect(s).toContainText("1.100000"); // k2
    await expect(s).toContainText("1.210500"); // k4
    // La y es la de la fila 0 (1.000000); la de la fila 1 es el resultado.
    await expect(s).not.toContainText("1.110342");
    await expect(page.locator("#formula-datos")).toContainText("En el paso 1:");
  });

  test("Runge-Kutta de orden 2 usa h/2 y solo k₁ y k₂", async ({ page }) => {
    await resolver(page, "runge-kutta", "runge-kutta-heun");
    await irAlPaso(page, 1);
    const s = page.locator('#formula-datos math[data-sustitucion="runge-kutta"]');
    await expect(s).toContainText("0.1000002"); // h/2
    await expect(s).toContainText("1.100000"); // k2
    await expect(s).not.toContainText("1.105000"); // la y de la fila 1
    await expect(s.locator("mtr")).toHaveCount(2);
  });

  test("en un sistema cada componente lleva su índice y el paso", async ({ page }) => {
    await resolver(page, "runge-kutta", "runge-kutta-sistema");
    await irAlPaso(page, 1);
    const s = page.locator('#formula-datos math[data-sustitucion="runge-kutta"]');
    await expect(s).toContainText("y1,1=");
    await expect(s).toContainText("y2,1=");
  });

  test("un número negativo va entre paréntesis con el signo pegado", async ({ page }) => {
    await resolver(page);
    await page.locator("#paso-primero").click();
    // El signo y la cifra forman su propio grupo, no una resta entre paréntesis.
    const signo = page.locator(
      '#formula-datos math[data-sustitucion="von-mises"] mrow',
      { hasText: /^−1\.36787944$/ },
    );
    await expect(signo.first()).toBeVisible();
  });

  test("Interpolación de Newton hacia adelante explica a₂ desde la fila 0", async ({ page }) => {
    await resolver(page, "interpolacion-newton", "interpolacion-newton-adelante");
    await irAlPaso(page, 2);
    const s = page.locator('#formula-datos math[data-sustitucion="interpolacion-newton"]');
    const texto = (await s.textContent()).replace(/\s+/g, "");
    expect(texto).toContain("Δ");
    expect(texto).toContain("2!");
    expect(texto).toContain("(2.00000000−1.00000000)"); // x de las filas 1 y 0
    // Δ²y₀ sale de la fila 0 (2), no el coeficiente ya dividido (1).
    expect(texto).not.toMatch(/^a2=[\d.]+$/);
    expect(texto).not.toContain("=1.00000000");
  });

  test("Interpolación de Newton hacia atrás usa ∇ᵏ de la fila elegida", async ({ page }) => {
    await resolver(page, "interpolacion-newton", "interpolacion-newton-atras");
    await irAlPaso(page, 2);
    const s = page.locator('#formula-datos math[data-sustitucion="interpolacion-newton"]');
    const texto = (await s.textContent()).replace(/\s+/g, "");
    expect(texto).toContain("∇");
    expect(texto).toContain("4.00000000"); // ∇²y de la fila 2
    expect(texto).toContain("(1.00000000−0.00000000)");
  });

  test("Interpolación de Newton con divididas sigue mostrando a_k", async ({ page }) => {
    await resolver(page, "interpolacion-newton", "interpolacion-newton-docente");
    await irAlPaso(page, 1);
    const s = page.locator('#formula-datos math[data-sustitucion="interpolacion-newton"]');
    const texto = (await s.textContent()).replace(/\s+/g, "");
    expect(texto).toBe("a1=(−2.00000000)");
  });

  test("mover Decimales parado en k reescribe la franja y la sustitución", async ({ page }) => {
    await resolver(page);
    await page.locator("#paso-primero").click();
    await page.locator("#paso-siguiente").click();
    const s = page.locator('#formula-datos math[data-sustitucion="von-mises"]');
    await expect(s).toContainText("1.26894142");
    await page.locator("#decimales").fill("3");
    await expect(s).toContainText("1.269");
    await expect(s).not.toContainText("1.26894");
    await expect(page.locator("#fila-actual")).toContainText("1.269");
    await expect(page.locator("#paso")).toHaveValue("1");
  });

  test("sin recorrido no hay sustitución", async ({ page }) => {
    await resolver(page);
    await expect(page.locator("#formula-datos")).toBeVisible();
    await elegirMetodo(page, "newton-raphson");
    await expect(page.locator("#formula-datos")).toBeHidden();
    await expect(page.locator("#formula-datos")).toBeEmpty();
  });

  test("un método que diverge sustituye sin errores en la primera y la última fila", async ({ page }) => {
    const errores = [];
    page.on("pageerror", (e) => errores.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    await resolver(page, "von-mises", "von-mises-divergente");
    const s = page.locator('#formula-datos math[data-sustitucion="von-mises"]');
    await page.locator("#paso-primero").click();
    await expect(s).toBeVisible();
    await page.locator("#paso-ultimo").click();
    await expect(s).toBeVisible();
    expect(errores).toEqual([]);
  });

  test("a 375 px ninguna sustitución desborda su tarjeta", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const [slug, preset, k] of EJERCICIOS) {
      await resolver(page, slug, preset);
      await irAlPaso(page, k);
      const caja = page.locator("#formula-datos");
      await expect(caja.locator("math"), preset).toBeVisible();
      const sobra = await caja.evaluate((c) => c.scrollWidth - c.clientWidth);
      expect(sobra, preset).toBeLessThanOrEqual(0);
      const pagina = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(pagina, preset).toBeLessThanOrEqual(0);
    }
  });
});
