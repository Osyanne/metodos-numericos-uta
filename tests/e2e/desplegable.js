// Espera a que el desplegable tenga cargados todos los metodos que ofrece la
// API y los devuelve.
//
// La lista en si (cuales son y en que orden) la fija tests/test_contract.py.
// Aca solo importa que la interfaz muestre todos: con un numero fijo, cada
// metodo nuevo rompia los beforeEach de tres archivos sin que nada estuviera mal.
import { expect } from "@playwright/test";

export async function esperarDesplegable(page) {
  const respuesta = await page.request.get("/api/methods");
  expect(respuesta.ok()).toBeTruthy();
  const metodos = await respuesta.json();
  await expect(page.locator("#metodo option")).toHaveCount(metodos.length);
  return metodos;
}
