// Espera a que la interfaz tenga cargados todos los metodos que ofrece la API
// y los devuelve; y elige un metodo o abre los ajustes como lo haria el
// usuario.
//
// La lista en si (cuales son y en que orden) la fija tests/test_contract.py.
// Aca solo importa que la interfaz muestre todos: con un numero fijo, cada
// metodo nuevo rompia los beforeEach de tres archivos sin que nada estuviera mal.
//
// Transitorio: aceptan el desplegable viejo y los chips por familia, para que
// la suite siga en verde mientras la interfaz cambia de uno a otro.
import { expect } from "@playwright/test";

export const SELECTOR_METODOS = '#metodo option, #metodo input[name="metodo"]';

export async function esperarDesplegable(page) {
  const respuesta = await page.request.get("/api/methods");
  expect(respuesta.ok()).toBeTruthy();
  const metodos = await respuesta.json();
  await expect(page.locator(SELECTOR_METODOS)).toHaveCount(metodos.length);
  return metodos;
}

// Un chip solo se puede marcar con su familia a la vista: primero la pestaña.
export async function elegirMetodo(page, slug) {
  const metodo = page.locator("#metodo");
  if (await metodo.evaluate((e) => e.tagName === "SELECT")) {
    await metodo.selectOption(slug);
    return;
  }
  const chip = metodo.locator(`input[value="${slug}"]`);
  const familia = await chip.getAttribute("data-familia");
  await page.locator(`#familia input[value="${familia}"]`).check();
  await chip.check();
}

export async function abrirAjustes(page) {
  const ajustes = page.locator("#ajustes");
  if (await ajustes.count() === 0) return;
  if (!(await ajustes.evaluate((d) => d.open))) {
    await ajustes.locator("summary").click();
  }
}
