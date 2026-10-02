import { defineConfig, devices } from "@playwright/test";

// Pruebas del sitio de GitHub Pages: el aplicativo corriendo con Python en el
// navegador (Pyodide), sin servidor FastAPI. Se arma el sitio con
// pages/construir.py y se sirve como archivos estaticos, bajo la misma
// subcarpeta que usa Pages, para que una ruta absoluta olvidada falle aca.
//
//   npx playwright test --config playwright.pages.config.js
//
// Necesita internet: Pyodide y sus paquetes se bajan de jsDelivr y PyPI.
const python = process.platform === "win32" ? "python" : "python3";

export default defineConfig({
  testDir: "./tests/pages",
  retries: 0,
  workers: 1,
  // El primer arranque descarga Python y SymPy; despues queda en la cache.
  timeout: 300_000,
  expect: { timeout: 30_000 },
  outputDir: "tests/pages/artifacts/results",
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8011/metodos-numericos-uta/",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      `${python} pages/construir.py _pages_prueba/metodos-numericos-uta && ` +
      `${python} -m http.server 8011 --bind 127.0.0.1 --directory _pages_prueba`,
    url: "http://127.0.0.1:8011/metodos-numericos-uta/index.html",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
