// La portada y la ruta por hash: una tarjeta por metodo (de la API), entrar
// por la tarjeta o por un enlace directo, atras y adelante, y que todo
// metodo tenga su guia (la pestana Teoria).
import { test, expect } from "@playwright/test";
import { esperarDesplegable, elegirMetodo } from "./desplegable.js";

const metodosDeLaApi = async (page) => (await page.request.get("/api/methods")).json();

test("la portada muestra una tarjeta por metodo de la API, con su nombre y su descripcion", async ({ page }) => {
  const metodos = await metodosDeLaApi(page);
  await page.goto("/");
  await expect(page.locator("#portada")).toBeVisible();
  await expect(page.locator("#vista-metodo")).toBeHidden();
  const tarjetas = page.locator("#rejilla a.tarjeta-metodo");
  await expect(tarjetas).toHaveCount(metodos.length);
  for (const m of metodos) {
    const tarjeta = page.locator(`#rejilla a[data-slug="${m.slug}"]`);
    await expect(tarjeta).toHaveAttribute("href", `#/metodo/${m.slug}`);
    await expect(tarjeta.locator("strong")).toHaveText(m.name);
    // La descripcion es la de la API, sin reescribir.
    await expect(tarjeta.locator(".tarjeta-descripcion")).toHaveText(m.description);
  }
  // Agrupadas por familia, cada grupo con su icono.
  const familias = [...new Set(metodos.map((m) => m.family))];
  await expect(page.locator("#rejilla .grupo")).toHaveCount(familias.length);
  for (const g of await page.locator("#rejilla .grupo").all()) {
    await expect(g.locator("h3 svg")).toHaveCount(1);
  }
  // La guia de uso: tres pasos.
  await expect(page.getByRole("heading", { name: "Cómo se usa" })).toBeVisible();
  await expect(page.locator(".como-pasos li")).toHaveCount(3);
  await expect(page.locator(".como")).toContainText(/arrastra/i);
  await expect(page.locator("#portada")).toContainText("Comparar métodos");
  await expect(page.locator("#portada")).toContainText("Exportar");
});

test("un metodo nuevo de la API aparece en la portada sin tocar nada", async ({ page }) => {
  await page.route("**/api/methods", async (ruta) => {
    const respuesta = await ruta.fetch();
    const lista = await respuesta.json();
    lista.push({
      slug: "metodo-de-prueba", name: "Metodo de prueba", family: "familia-nueva",
      description: "Una descripcion que viene de la API.", unit: "U9", inputs: [],
    });
    await ruta.fulfill({ response: respuesta, json: lista });
  });
  await page.goto("/");
  const tarjeta = page.locator('#rejilla a[data-slug="metodo-de-prueba"]');
  await expect(tarjeta).toContainText("Una descripcion que viene de la API.");
  await expect(tarjeta.locator("xpath=ancestor::section[contains(@class,'grupo')]"))
    .toHaveAttribute("data-familia", "otros");
});

test("abrir un metodo desde su tarjeta: ruta, titulo, chips y foco", async ({ page }) => {
  await page.goto("/");
  await page.locator('#rejilla a[data-slug="simpson-38"]').click();
  await expect(page).toHaveURL(/#\/metodo\/simpson-38$/);
  await expect(page.locator("#portada")).toBeHidden();
  await expect(page.locator("#vista-metodo")).toBeVisible();
  await expect(page.locator("#metodo-titulo")).toHaveText("Simpson 3/8");
  await expect(page.locator("#metodo-titulo")).toBeFocused();
  await expect(page.locator('#metodo input[value="simpson-38"]')).toBeChecked();
  await expect(page.locator('#familia input[value="integracion"]')).toBeChecked();
  await expect(page).toHaveTitle(/Simpson 3\/8/);
  // El formulario es el del metodo y resuelve.
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
});

test("un enlace directo a un metodo abre ese metodo", async ({ page }) => {
  await page.goto("/#/metodo/runge-kutta");
  await expect(page.locator("#vista-metodo")).toBeVisible();
  await expect(page.locator("#portada")).toBeHidden();
  await expect(page.locator("#metodo-titulo")).toHaveText("Runge-Kutta");
  await expect(page.locator('#metodo input[value="runge-kutta"]')).toBeChecked();
  await expect(page.locator("body")).toHaveAttribute("data-familia", "edo");
});

test("atras vuelve a la portada y adelante al metodo", async ({ page }) => {
  await page.goto("/");
  await page.locator('#rejilla a[data-slug="trapecio"]').click();
  await expect(page.locator("#metodo-titulo")).toHaveText("Método del Trapecio");
  await page.goBack();
  await expect(page.locator("#portada")).toBeVisible();
  await expect(page.locator("#vista-metodo")).toBeHidden();
  await expect(page.locator("#portada-titulo")).toBeFocused();
  await page.goForward();
  await expect(page.locator("#vista-metodo")).toBeVisible();
  await expect(page.locator("#metodo-titulo")).toHaveText("Método del Trapecio");
});

test("un slug desconocido cae en la portada", async ({ page }) => {
  await page.goto("/#/metodo/no-existe");
  await expect(page.locator("#portada")).toBeVisible();
  await expect(page.locator("#vista-metodo")).toBeHidden();
  await expect(page).toHaveURL(/#\/$/);
  // Otras rutas que no son de ningun metodo tambien.
  await page.goto("/#/cualquier-cosa");
  await expect(page.locator("#portada")).toBeVisible();
  await page.goto("/#/metodo/%E0%A4%A");
  await expect(page.locator("#portada")).toBeVisible();
});

test("el selector sigue funcionando y mantiene la ruta al dia", async ({ page }) => {
  await page.goto("/#/metodo/newton-raphson");
  await esperarDesplegable(page);
  await page.locator('#familia input[value="integracion"]').check();
  await expect(page.locator("#vista-metodo")).toBeVisible();
  const primero = await page.locator('#metodo input[data-familia="integracion"]').first().getAttribute("value");
  await expect(page).toHaveURL(new RegExp(`#/metodo/${primero}$`));
  await page.locator('#metodo input[value="trapecio"]').check();
  await expect(page).toHaveURL(/#\/metodo\/trapecio$/);
  await expect(page.locator("#metodo-titulo")).toHaveText("Método del Trapecio");
  // El foco se queda en el selector: elegir no lo manda al encabezado.
  await expect(page.locator('#metodo input[value="trapecio"]')).toBeFocused();
  // Atras recorre lo elegido.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`#/metodo/${primero}$`));
  await expect(page.locator(`#metodo input[value="${primero}"]`)).toBeChecked();
  await page.goBack();
  await expect(page.locator('#metodo input[value="newton-raphson"]')).toBeChecked();
});

test("el titulo de la cabecera vuelve a la portada y conserva tema y decimales", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await elegirMetodo(page, "punto-medio");
  await page.locator("#decimales").fill("9");
  await page.locator("#tema").click();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro");
  const inicio = page.getByRole("link", { name: /Métodos numéricos/ });
  await expect(inicio).toHaveAttribute("href", "#/");
  await inicio.click();
  await expect(page.locator("#portada")).toBeVisible();
  await expect(page.locator("#portada-titulo")).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro");
  await page.locator('#rejilla a[data-slug="trapecio"]').click();
  await expect(page.locator("#decimales")).toHaveValue("9");
  await expect(page.locator("#decimales-valor")).toHaveText("9");
  await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro");
});

test("volver al mismo metodo conserva su resultado", async ({ page }) => {
  await page.goto("/");
  await elegirMetodo(page, "punto-medio");
  await page.locator("#resolver").click();
  await expect(page.locator("#resumen .estado")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#portada")).toBeVisible();
  await page.goForward();
  await expect(page.locator("#resumen .estado")).toBeVisible();
  // La grafica sigue ocupando su caja, no quedo en cero al estar oculta.
  const ancho = await page.locator("#plano").evaluate((c) => c.getBoundingClientRect().width);
  expect(ancho).toBeGreaterThan(200);
});

test("con teclado: tarjeta, Enter, y de vuelta por la cabecera", async ({ page }) => {
  await page.goto("/");
  await esperarDesplegable(page, { portada: true });
  // El foco arranca en el encabezado de la portada: la primera tabulacion
  // llega a la primera tarjeta.
  await expect(page.locator("#portada-titulo")).toBeFocused();
  await page.keyboard.press("Tab");
  const primera = page.locator("#rejilla a.tarjeta-metodo").first();
  await expect(primera).toBeFocused();
  const slug = await primera.getAttribute("data-slug");
  await page.keyboard.press("Enter");
  await expect(page.locator("#vista-metodo")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/metodo/${slug}$`));
  await expect(page.locator("#metodo-titulo")).toBeFocused();
  // Shift+Tab llega a la cabecera, y Enter vuelve a la portada.
  await page.locator("#inicio").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#portada")).toBeVisible();
  await expect(page.locator("#portada-titulo")).toBeFocused();
  // Cada tarjeta se alcanza con Tab y tiene nombre accesible.
  const n = await page.locator("#rejilla a.tarjeta-metodo").count();
  for (let k = 0; k < n; k++) {
    await page.keyboard.press("Tab");
    await expect(page.locator("#rejilla a.tarjeta-metodo").nth(k)).toBeFocused();
  }
});

for (const ancho of [375, 320]) {
  test(`a ${ancho} px no hay desborde horizontal, ni en la portada ni en un metodo`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 740 });
    await page.goto("/");
    await expect(page.locator("#rejilla a.tarjeta-metodo").first()).toBeVisible();
    const desborde = () => page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(await desborde()).toBeLessThanOrEqual(0);
    for (const tarjeta of await page.locator("#rejilla a.tarjeta-metodo").all()) {
      const caja = await tarjeta.boundingBox();
      expect(caja.x).toBeGreaterThanOrEqual(0);
      expect(caja.x + caja.width).toBeLessThanOrEqual(ancho);
    }
    await page.locator('#rejilla a[data-slug="simpson-38"]').click();
    await expect(page.locator("#vista-metodo")).toBeVisible();
    expect(await desborde()).toBeLessThanOrEqual(0);
  });
}

// ------------------------------------------------------------ contraste

for (const tema of ["light", "dark"]) {
  test(`la portada tiene contraste AA en tema ${tema}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema });
    await page.goto("/");
    await expect(page.locator("#rejilla a.tarjeta-metodo").first()).toBeVisible();
    const medidas = await page.evaluate(() => {
      const rgb = (texto) => texto.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = (c) => {
        const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const razon = (a, b) => {
        const [x, y] = [lum(rgb(a)) + 0.05, lum(rgb(b)) + 0.05];
        return Math.max(x, y) / Math.min(x, y);
      };
      const color = (el) => getComputedStyle(el).color;
      const fondo = (el) => getComputedStyle(el).backgroundColor;
      const paper = fondo(document.body);
      const salida = [];
      salida.push(["titulo/paper", razon(color(document.querySelector("#portada-titulo")), paper)]);
      salida.push(["frase/paper", razon(color(document.querySelector(".portada-frase")), paper)]);
      salida.push(["campo-ayuda/paper", razon(color(document.querySelector("#portada .campo-ayuda")), paper)]);
      const paso = document.querySelector(".como-pasos li");
      salida.push(["paso/superficie", razon(color(paso), fondo(paso))]);
      salida.push(["numero/circulo", razon(color(paso.querySelector(".paso")), fondo(paso.querySelector(".paso")))]);
      for (const grupo of document.querySelectorAll("#rejilla .grupo")) {
        const clave = grupo.dataset.familia;
        const h3 = grupo.querySelector("h3");
        salida.push([`${clave} titulo/paper`, razon(color(h3), paper)]);
        const icono = grupo.querySelector(".grupo-icono");
        salida.push([`${clave} icono/fondo`, razon(color(h3), fondo(icono))]);
        const enlace = grupo.querySelector("a.tarjeta-metodo");
        const superficie = fondo(enlace);
        salida.push([`${clave} nombre/tarjeta`, razon(color(enlace.querySelector("strong")), superficie)]);
        salida.push([`${clave} descripcion/tarjeta`, razon(color(enlace.querySelector(".tarjeta-descripcion")), superficie)]);
        // Con el puntero encima la tarjeta toma el fondo de su familia.
        const hover = getComputedStyle(grupo).getPropertyValue("--c-bg").trim();
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hover.slice(i, i + 2), 16));
        salida.push([`${clave} nombre/hover`, razon(color(enlace.querySelector("strong")), `rgb(${r}, ${g}, ${b})`)]);
        salida.push([`${clave} descripcion/hover`, razon(color(enlace.querySelector(".tarjeta-descripcion")), `rgb(${r}, ${g}, ${b})`)]);
      }
      return salida;
    });
    expect(medidas.length).toBeGreaterThan(20);
    for (const [que, valor] of medidas) expect(valor, que).toBeGreaterThanOrEqual(4.5);
  });
}

test("con colores forzados las tarjetas siguen teniendo borde y enlace", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/");
  const tarjeta = page.locator("#rejilla a.tarjeta-metodo").first();
  await expect(tarjeta).toBeVisible();
  const borde = await tarjeta.evaluate((e) => {
    const c = getComputedStyle(e);
    return [c.borderTopWidth, c.borderLeftWidth, c.borderTopStyle];
  });
  expect(borde).toEqual(["3px", "1px", "solid"]);
});

test("con movimiento reducido las tarjetas no animan", async ({ page }) => {
  const transicion = async (preferencia) => {
    await page.emulateMedia({ reducedMotion: preferencia });
    await page.goto("/");
    return page.locator("#rejilla a.tarjeta-metodo").first()
      .evaluate((e) => getComputedStyle(e).transitionDuration);
  };
  expect(await transicion("reduce")).toBe("0s");
  expect(await transicion("no-preference")).not.toBe("0s");
});
