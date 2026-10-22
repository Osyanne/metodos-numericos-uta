// Arrastrar en el plano los datos del problema: el campo del formulario, el
// resultado y el recorrido siguen al asa, con el puntero real.
import { test, expect } from "@playwright/test";
import { esperarDesplegable, elegirMetodo } from "./desplegable.js";

async function resolver(page, slug, preset) {
  await page.goto("/");
  await esperarDesplegable(page);
  await elegirMetodo(page, slug);
  await page.locator("#preset").selectOption(preset);
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
}

const posicionAsa = (page, id) =>
  page.evaluate(async (id) => (await import("/app.js")).plano.posicionAsa(id), id);

// Coordenadas de pagina del asa `id` del plano de la aplicacion.
async function dondeAsa(page, id) {
  await page.locator("#plano").scrollIntoViewIfNeeded();
  await expect.poll(() => posicionAsa(page, id)).not.toBeNull();
  const [px, py] = await posicionAsa(page, id);
  const caja = await page.locator("#plano").boundingBox();
  return [caja.x + px, caja.y + py];
}

async function arrastrarAsa(page, id, dx, dy, { soltar = true, pasos = 10 } = {}) {
  const [x, y] = await dondeAsa(page, id);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: pasos });
  if (soltar) await page.mouse.up();
}

// El rotulo del recorrido queda en la ultima fila del resultado nuevo.
const enLaUltima = /(\d+) de \1$/;

test.describe("arrastre", () => {
  test("Newton-Raphson: x₀ cambia campo y resultado mientras se arrastra", async ({ page }) => {
    await resolver(page, "newton-raphson", "newton-clasico");
    const resumen = await page.locator("#resumen").textContent();
    await arrastrarAsa(page, "x0", -60, 0, { soltar: false });
    await expect(page.locator("#campo-x0")).not.toHaveValue("2");
    await expect.poll(() => page.locator("#resumen").textContent()).not.toBe(resumen);
    await page.mouse.up();
    await expect(page.locator("#paso-rotulo")).toHaveText(enLaUltima);
    await expect(page.locator("#paso-siguiente")).toBeEnabled();
  });

  test("Lagrange: mover un punto cambia su y y el polinomio", async ({ page }) => {
    await resolver(page, "interpolacion-lagrange", "lagrange-docente");
    const y = page.getByLabel("y del punto 2");
    const antes = await y.inputValue();
    const resumen = await page.locator("#resumen").textContent();
    await arrastrarAsa(page, "p:1", 0, -40);
    await expect(y).not.toHaveValue(antes);
    await expect.poll(() => page.locator("#resumen").textContent()).not.toBe(resumen);
    await expect(page.locator("#paso-rotulo")).toHaveText(enLaUltima);
  });

  test("Trapecio: mover b cambia el intervalo y la integral", async ({ page }) => {
    await resolver(page, "trapecio", "trapecio-docente");
    const b = page.locator("#campo-b");
    const antes = await b.inputValue();
    const resumen = await page.locator("#resumen").textContent();
    await arrastrarAsa(page, "b", -40, 0);
    await expect(b).not.toHaveValue(antes);
    await expect.poll(() => page.locator("#resumen").textContent()).not.toBe(resumen);
    await expect(page.locator("#paso-rotulo")).toHaveText(enLaUltima);
  });

  test("Runge-Kutta: mover la condición inicial cambia x₀ e y₀", async ({ page }) => {
    await resolver(page, "runge-kutta", "runge-kutta-escalar");
    const x0 = page.locator("#campo-x0");
    const y0 = page.locator('[aria-labelledby="campo-y0-etiqueta"] input').first();
    const [x0Antes, y0Antes] = [await x0.inputValue(), await y0.inputValue()];
    await arrastrarAsa(page, "y0:0", 30, -30);
    await expect(x0).not.toHaveValue(x0Antes);
    await expect(y0).not.toHaveValue(y0Antes);
    await expect(page.locator("#paso-rotulo")).toHaveText(enLaUltima);
  });

  test("no hay asas antes de resolver ni al comparar", async ({ page }) => {
    await page.goto("/");
    await esperarDesplegable(page);
    expect(await posicionAsa(page, "x0")).toBeNull();
    await page.locator("#resolver").click();
    await expect(page.locator("#resumen .estado")).toBeVisible();
    await expect.poll(() => posicionAsa(page, "x0")).not.toBeNull();
    await page.locator("#comparar").click();
    await expect(page.locator("#comparacion table")).toBeVisible();
    expect(await posicionAsa(page, "x0")).toBeNull();
  });

  test("nunca hay más de una petición en vuelo y la última es el valor final", async ({ page }) => {
    await page.clock.install();
    await resolver(page, "newton-raphson", "newton-clasico");
    const retenidas = [];
    let maximo = 0;
    await page.route("**/api/methods/*/solve", (ruta) => {
      retenidas.push(ruta);
      maximo = Math.max(maximo, retenidas.filter((r) => !r.soltada).length);
    });
    const soltar = async (ruta) => { ruta.soltada = true; await ruta.continue(); };

    const [x, y] = await dondeAsa(page, "x0");
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(x - 4 * i, y);
      await page.clock.runFor(30);
    }
    await page.mouse.up();
    expect(retenidas.length).toBe(1);
    await soltar(retenidas[0]);
    await expect.poll(() => retenidas.length).toBe(2);
    await soltar(retenidas[1]);
    expect(maximo).toBe(1);
    const final = retenidas[1].request().postDataJSON();
    await expect(page.locator("#campo-x0")).toHaveValue(String(final.params.x0));
    await expect(page.locator("#paso-siguiente")).toBeEnabled();
  });

  test("un clic sin mover sobre un punto de Lagrange elige su fila y no resuelve", async ({ page }) => {
    await resolver(page, "interpolacion-lagrange", "lagrange-docente");
    const pedidos = [];
    page.on("request", (r) => { if (r.url().includes("/solve")) pedidos.push(r); });
    await page.mouse.click(...await dondeAsa(page, "p:1"));
    await expect(page.locator("#paso-rotulo")).toHaveText(/ 1 de /);
    expect(pedidos).toEqual([]);
  });

  test("Resolver con la petición del arrastre en vuelo gana y no deja nada apagado", async ({ page }) => {
    await resolver(page, "newton-raphson", "newton-clasico");
    let retener = true;
    const retenidas = [];
    await page.route("**/api/methods/*/solve", (ruta) => (retener ? retenidas.push(ruta) : ruta.continue()));
    await arrastrarAsa(page, "x0", -60, 0);
    await expect.poll(() => retenidas.length).toBeGreaterThan(0);
    retener = false;
    await page.locator("#campo-x0").fill("3");
    const respuesta = page.waitForResponse((r) => r.url().includes("/solve"));
    await page.locator("#resolver").click();
    await respuesta;
    await expect(page.locator("#paso-rotulo")).toHaveText(enLaUltima);
    const resumen = await page.locator("#resumen").textContent();
    for (const ruta of retenidas) await ruta.continue();
    await page.waitForTimeout(500);
    await expect(page.locator("#campo-x0")).toHaveValue("3");
    expect(await page.locator("#resumen").textContent()).toBe(resumen);
    await expect(page.locator("#paso-siguiente")).toBeEnabled();
  });

  test("arrastrar usa lo que muestra el formulario aunque no se haya resuelto", async ({ page }) => {
    await resolver(page, "newton-raphson", "newton-clasico");
    await page.locator("#campo-fx").fill("x^3 - 2*x - 6");
    const pedido = page.waitForRequest((r) => r.url().includes("/solve"));
    await arrastrarAsa(page, "x0", -40, 0);
    expect((await pedido).postDataJSON().params.fx).toBe("x^3 - 2*x - 6");
  });

  test("soltar fuera del plano termina el arrastre igual que adentro", async ({ page }) => {
    await resolver(page, "newton-raphson", "newton-clasico");
    const [x, y] = await dondeAsa(page, "x0");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 30, y + 400, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator("#campo-x0")).not.toHaveValue("2");
    await expect(page.locator("#paso-rotulo")).toHaveText(enLaUltima);
    await expect(page.locator("#paso-siguiente")).toBeEnabled();
  });

  test("la ayuda del plano explica las asas y ya no dice franja", async ({ page }) => {
    await page.goto("/");
    const ayuda = page.locator("#plano-ayuda");
    await expect(ayuda).toContainText("arrástralos");
    await expect(ayuda).not.toContainText("franja");
  });

  // Trapecio del docente: llevar `a` 40 px mas alla de `b`, donde el nucleo
  // rechaza el intervalo. Devuelve donde quedo el puntero y donde empezo.
  async function aMasAllaDeB(page) {
    await resolver(page, "trapecio", "trapecio-docente");
    const [xa, ya] = await dondeAsa(page, "a");
    const [xb] = await dondeAsa(page, "b");
    await page.mouse.move(xa, ya);
    await page.mouse.down();
    await page.mouse.move(xb + 40, ya, { steps: 12 });
    return { xa, ya };
  }

  const atenuado = (page) => page.evaluate(async () => (await import("/app.js")).plano.atenuado);

  test("un valor rechazado se ve tenue sin soltar y se aclara al volver", async ({ page }) => {
    const { xa, ya } = await aMasAllaDeB(page);
    await expect(page.locator("#aviso-arrastre")).toBeVisible();
    await expect(page.locator("#aviso-arrastre")).not.toBeEmpty();
    await expect(page.locator("#aviso")).toBeHidden();
    expect(await atenuado(page)).toBe(true);
    await page.mouse.move(xa, ya, { steps: 12 });
    await expect(page.locator("#aviso-arrastre")).toBeHidden();
    await expect.poll(() => atenuado(page)).toBe(false);
    await page.mouse.up();
  });

  test("soltar en un valor rechazado vuelve al último válido y avisa una vez", async ({ page }) => {
    await aMasAllaDeB(page);
    await expect(page.locator("#aviso-arrastre")).toBeVisible();
    const b = Number(await page.locator("#campo-b").inputValue());
    await page.mouse.up();
    const aviso = page.locator("#aviso");
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveText(/^Con a = \S+ no se pudo resolver: .+\. Se volvió a a = \S+\.$/);
    expect(Number(await page.locator("#campo-a").inputValue())).toBeLessThan(b);
    await expect(page.locator("#aviso-arrastre")).toBeHidden();
    await expect(page.locator("#paso-siguiente")).toBeEnabled();
    expect(await atenuado(page)).toBe(false);
  });

  test("el aviso del arrastre no se anuncia en cada cambio", async ({ page }) => {
    await page.goto("/");
    const aviso = page.locator("#aviso-arrastre");
    await expect(aviso).not.toHaveAttribute("role", /.*/);
    await expect(aviso).not.toHaveAttribute("aria-live", /.*/);
  });
});
