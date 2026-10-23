// Que dato del problema es un asa del plano en cada familia y como cambian
// los parametros al moverla. Es logica pura: se prueba importando el modulo.
import { test, expect } from "@playwright/test";

// asas.js queda en window.m y los metodos de la API en window.metodo(slug).
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    window.m = await import("/asas.js");
    const metodos = await (await fetch("/api/methods")).json();
    window.metodo = (slug) => metodos.find((x) => x.slug === slug);
  });
});

test("asasDe da un asa por dato arrastrable de cada familia", async ({ page }) => {
  const r = await page.evaluate(() => {
    const { m, metodo } = window;
    return {
      nr: m.asasDe(metodo("newton-raphson"), { fx: "x^2 - 2", x0: 2 }),
      lagrange: m.asasDe(metodo("interpolacion-lagrange"), { points: [[1, 0], [4, 1.386294]], x: 2 }),
      trapecio: m.asasDe(metodo("trapecio"), { fx: "x", a: 0, b: 1, n: 4 }),
      rk: m.asasDe(metodo("runge-kutta"), { fxy: "y", x0: 0, y0: 1, h: 0.1, n: 5 }),
      sinX0: m.asasDe(metodo("newton-raphson"), { fx: "x^2 - 2", x0: null }),
    };
  });
  expect(r.nr).toEqual({ tipo: "asas", asas: [{ id: "x0", x: 2, y: 0, eje: "x", etiqueta: "x₀" }] });
  expect(r.lagrange.asas.map((a) => a.id)).toEqual(["p:0", "p:1", "x"]);
  expect(r.lagrange.asas.map((a) => a.etiqueta)).toEqual(["P₀", "P₁", "x"]);
  expect(r.lagrange.asas[1]).toEqual({ id: "p:1", x: 4, y: 1.386294, eje: "xy", etiqueta: "P₁" });
  expect(r.lagrange.asas[2].eje).toBe("x");
  expect(r.trapecio.asas.map((a) => [a.id, a.x, a.eje])).toEqual([["a", 0, "x"], ["b", 1, "x"]]);
  expect(r.rk).toEqual({ tipo: "asas", asas: [{ id: "y0:0", x: 0, y: 1, eje: "xy", etiqueta: "y₀" }] });
  expect(r.sinX0).toBeNull();
});

test("asasDe rotula P con dos cifras y las componentes de un sistema", async ({ page }) => {
  const r = await page.evaluate(() => {
    const { m, metodo } = window;
    const puntos = Array.from({ length: 12 }, (_, i) => [i, i * i]);
    const columnas = [{ key: "x", label: "x" }, { key: "y1", label: "y1" }, { key: "y2", label: "y2" }];
    return {
      p11: m.asasDe(metodo("interpolacion-lagrange"), { points: puntos, x: 2 }).asas[11].etiqueta,
      sistema: m.asasDe(metodo("runge-kutta"), { x0: 0, y0: [1, 2] }, { columns: columnas })
        .asas.map((a) => [a.id, a.y, a.etiqueta]),
      sinResultado: m.asasDe(metodo("runge-kutta"), { x0: 0, y0: [1, 2] }).asas.map((a) => a.etiqueta),
    };
  });
  expect(r.p11).toBe("P₁₁");
  expect(r.sistema).toEqual([["y0:0", 1, "y1"], ["y0:1", 2, "y2"]]);
  expect(r.sinResultado).toEqual(["y1", "y2"]);
});

test("asasDe no da asas de un campo vacio, no finito o de una familia sin mapa", async ({ page }) => {
  const r = await page.evaluate(() => {
    const { m, metodo } = window;
    return {
      vacio: m.asasDe(metodo("trapecio"), { a: "", b: 1, n: 4 }).asas.map((a) => a.id),
      infinito: m.asasDe(metodo("trapecio"), { a: Infinity, b: 1, n: 4 }).asas.map((a) => a.id),
      sinX: m.asasDe(metodo("interpolacion-lagrange"), { points: [[1, 0], [2, 1]] }).asas.map((a) => a.id),
      otros: m.asasDe({ family: "otros", inputs: [{ name: "x0" }] }, { x0: 1 }),
    };
  });
  expect(r.vacio).toEqual(["b"]);
  expect(r.infinito).toEqual(["b"]);
  expect(r.sinX).toEqual(["p:0", "p:1"]);
  expect(r.otros).toBeNull();
});

test("mover cambia solo el dato del asa y no toca lo que recibe", async ({ page }) => {
  const r = await page.evaluate(() => {
    const { m, metodo } = window;
    const rk = metodo("runge-kutta");
    const trap = metodo("trapecio");
    const original = { points: [[1, 0], [4, 2]], x: 2 };
    const movido = m.mover(metodo("interpolacion-lagrange"), original, "p:1", 5, 3);
    return {
      escalar: m.mover(rk, { x0: 0, y0: 1, h: 0.1, n: 5 }, "y0:0", 0.5, 2),
      sistema: m.mover(rk, { x0: 0, y0: [1, 2] }, "y0:1", 0.5, 3),
      trapecio: m.mover(trap, { a: 0, b: 1, n: 4 }, "b", 2.5, null),
      x: m.mover(metodo("interpolacion-lagrange"), original, "x", 3.5, null).x,
      movido,
      original,
    };
  });
  expect(r.escalar).toEqual({ x0: 0.5, y0: 2, h: 0.1, n: 5 });
  expect(r.sistema).toEqual({ x0: 0.5, y0: [1, 3] });
  expect(r.trapecio).toEqual({ a: 0, b: 2.5, n: 4 });
  expect(r.x).toBe(3.5);
  expect(r.movido.points).toEqual([[1, 0], [5, 3]]);
  expect(r.original).toEqual({ points: [[1, 0], [4, 2]], x: 2 });
});

test("campoDe y describir", async ({ page }) => {
  const r = await page.evaluate(() => {
    const { m } = window;
    return {
      campos: ["x0", "x", "a", "b", "p:3", "y0:1"].map(m.campoDe),
      xy: m.describir({ etiqueta: "P₂", eje: "xy", x: 3, y: 1.5 }),
      x: m.describir({ etiqueta: "x₀", eje: "x", x: 0.82, y: 0 }),
    };
  });
  expect(r.campos).toEqual(["x0", "x", "a", "b", "points", "y0"]);
  expect(r.xy).toBe("P₂ = (3, 1.5)");
  expect(r.x).toBe("x₀ = 0.82");
});
