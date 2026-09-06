import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#metodo option")).toHaveCount(4);
});

test("una coordenada incompleta se explica sin enviar un cero inventado", async ({ page }) => {
  await page.locator("#metodo").selectOption("interpolacion-newton");
  await page.locator(".puntos-tabla tbody tr").first().locator("input").first().fill("");
  await page.locator("#formulario > .campo").nth(1).locator("input").fill("2");
  const envios = [];
  page.on("request", request => {
    if (request.url().endsWith("/solve")) envios.push(request.postDataJSON());
  });
  await page.locator("#resolver").click();
  await expect(page.locator("#aviso")).toContainText(/punto 1.*(completo|ambas|coordenadas)/i);
  expect(envios).toHaveLength(0);
});

test("un numero de pasos fraccionario se rechaza sin redondearlo", async ({ page }) => {
  await page.locator("#metodo").selectOption("runge-kutta");
  const campos = page.locator("#formulario > .campo");
  for (const [indice, valor] of [[0, "y"], [1, "0"], [2, "1"], [3, "0.1"], [4, "2.5"]]) {
    await campos.nth(indice).locator("input").fill(valor);
  }
  const envios = [];
  page.on("request", request => {
    if (request.url().endsWith("/solve")) envios.push(request.postDataJSON());
  });
  await page.locator("#resolver").click();
  await expect(page.locator("#aviso")).toContainText(/pasos.*entero/i);
  expect(envios).toHaveLength(0);
});

test("el formulario generico rechaza enteros fraccionarios en listas", async ({ page }) => {
  const lectura = await page.evaluate(async () => {
    const { Formulario } = await import("/forms.js");
    const caja = document.createElement("div");
    const formulario = new Formulario(caja);
    formulario.dibujar({ inputs: [
      { name: "indices", label: "Indices", kind: "integer", multiple: true, required: true, default: 2.5 },
    ] });
    try { return { valor: formulario.valores() }; }
    catch (error) { return { error: error.message }; }
  });
  expect(lectura.error).toMatch(/Indices.*entero/i);
});

test("listas incompletas no desplazan las condiciones de un sistema", async ({ page }) => {
  const lectura = await page.evaluate(async () => {
    const { Formulario } = await import("/forms.js");
    const caja = document.createElement("div");
    const formulario = new Formulario(caja);
    formulario.dibujar({ inputs: [
      { name: "y0", label: "y0", kind: "number", multiple: true, required: true, default: 1 },
    ] });
    caja.querySelector(".boton-agregar").click();
    try { return { valor: formulario.valores() }; }
    catch (error) { return { error: error.message }; }
  });
  expect(lectura.error).toMatch(/y0.*(fila|valor|complet)/i);
});

for (const kind of ["vector", "matrix"]) {
  test(`${kind} rechaza valores que no son finitos`, async ({ page }) => {
    const lectura = await page.evaluate(async kind => {
      const { Formulario } = await import("/forms.js");
      const caja = document.createElement("div");
      const formulario = new Formulario(caja);
      formulario.dibujar({ inputs: [
        { name: "datos", label: "Datos", kind, required: true },
      ] });
      caja.querySelector("input, textarea").value = "1 1e309";
      try { return { valor: formulario.valores() }; }
      catch (error) { return { error: error.message }; }
    }, kind);
    expect(lectura.error).toMatch(/finito/i);
  });
}

test("cargar un sistema reemplaza todas las filas y cargar escalar elimina las sobrantes", async ({ page }) => {
  const valores = await page.evaluate(async () => {
    const { Formulario } = await import("/forms.js");
    const metodos = await fetch("/api/methods").then(respuesta => respuesta.json());
    const metodo = metodos.find(metodo => metodo.slug === "runge-kutta");
    const formulario = new Formulario(document.createElement("div"));
    formulario.dibujar(metodo, {
      fxy: ["y2", "-y1"], x0: 0, y0: [1, 0], h: 0.1, n: 16, orden: 4,
    });
    let sistema, escalar;
    try { sistema = formulario.valores(); } catch (error) { sistema = { error: error.message }; }
    formulario.dibujar(metodo, {
      fxy: "x + y", x0: 0, y0: 1, h: 0.1, n: 5, orden: 4,
    });
    try { escalar = formulario.valores(); } catch (error) { escalar = { error: error.message }; }
    return { sistema, escalar };
  });
  expect(valores.sistema).toEqual({ fxy: ["y2", "-y1"], x0: 0, y0: [1, 0], h: 0.1, n: 16, orden: 4 });
  expect(valores.escalar).toEqual({ fxy: "x + y", x0: 0, y0: 1, h: 0.1, n: 5, orden: 4 });
});

test("cargar parametros elimina la derivada previa y conserva las definiciones", async ({ page }) => {
  const lectura = await page.evaluate(async () => {
    const { Formulario } = await import("/forms.js");
    const metodo = { inputs: [
      { name: "fx", label: "Funcion", kind: "expression", required: true, default: "x" },
      { name: "x0", label: "Inicial", kind: "number", required: true, default: 7 },
      { name: "dfx", label: "Derivada", kind: "expression", required: false, default: "1" },
    ] };
    const formulario = new Formulario(document.createElement("div"));
    formulario.dibujar(metodo, { fx: "x^2 - 4", x0: 0 });
    return { valores: formulario.valores(), defaultOriginal: metodo.inputs[2].default };
  });
  expect(lectura.valores).toEqual({ fx: "x^2 - 4", x0: 0 });
  expect(lectura.defaultOriginal).toBe("1");
});

test("cargar puntos conserva el cero y omite solamente filas totalmente vacias", async ({ page }) => {
  const valores = await page.evaluate(async () => {
    const { Formulario } = await import("/forms.js");
    const caja = document.createElement("div");
    const formulario = new Formulario(caja);
    formulario.dibujar({ inputs: [
      { name: "points", label: "Puntos", kind: "points", required: true },
    ] }, { points: [[0, 0], [1, 2]] });
    caja.querySelector(".boton-agregar").click();
    return formulario.valores();
  });
  expect(valores).toEqual({ points: [[0, 0], [1, 2]] });
});
