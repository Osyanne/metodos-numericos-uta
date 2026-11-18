// Espera a que la interfaz tenga cargados todos los metodos que ofrece la API
// y los devuelve; y elige un metodo o abre los ajustes como lo haria el
// usuario.
//
// La lista en si (cuales son y en que orden) la fija tests/test_contract.py.
// Aca solo importa que la interfaz muestre todos: con un numero fijo, cada
// metodo nuevo rompia los beforeEach de tres archivos sin que nada estuviera mal.
import { expect } from "@playwright/test";

export const SELECTOR_METODOS = '#metodo input[name="metodo"]';

//
// La app abre en la portada. Las pruebas que solo necesitan "la interfaz lista
// con un metodo abierto" (el primero de la API, como antes de la portada)
// llaman a esto tras goto: entra por su tarjeta, como lo haria la persona.
// `{ portada: true }` se queda en la portada, para probar el arranque.
export async function esperarDesplegable(page, { portada = false } = {}) {
  const respuesta = await page.request.get("/api/methods");
  expect(respuesta.ok()).toBeTruthy();
  const metodos = await respuesta.json();
  await expect(page.locator(SELECTOR_METODOS)).toHaveCount(metodos.length);
  if (!portada) await abrirDesdePortada(page, metodos[0].slug);
  return metodos;
}

async function abrirDesdePortada(page, slug) {
  const portada = page.locator("#portada");
  const vista = page.locator("#vista-metodo");
  await expect.poll(
    async () => (await portada.isVisible()) || (await vista.isVisible()),
  ).toBe(true);
  if (await portada.isVisible()) {
    await page.locator(`a.tarjeta-metodo[data-slug="${slug}"]`).click();
    await expect(vista).toBeVisible();
  }
}

// La app abre en la portada: desde ahi se entra a un metodo por su tarjeta,
// como lo haria la persona. Ya dentro de un metodo, un chip solo se puede
// marcar con su familia a la vista: primero la pestaña.
export async function elegirMetodo(page, slug) {
  await abrirDesdePortada(page, slug);
  const chip = page.locator(`#metodo input[value="${slug}"]`);
  const familia = await chip.getAttribute("data-familia");
  await page.locator(`#familia input[value="${familia}"]`).check();
  await chip.check();
}

export async function abrirAjustes(page) {
  const ajustes = page.locator("#ajustes");
  if (!(await ajustes.evaluate((d) => d.open))) {
    await ajustes.locator("summary").click();
  }
}
