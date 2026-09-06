import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(
  new URL("./tests/e2e/artifacts/browsers", import.meta.url),
);

// Ruta absoluta y con el separador del sistema. Playwright lanza el webServer a
// traves de cmd.exe en Windows, y ahi ".venv/Scripts/python.exe" con barras
// normales no se reconoce como comando.
const raiz = fileURLToPath(new URL(".", import.meta.url));
const python = resolve(
  raiz,
  process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python",
);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: "tests/e2e/artifacts/results",
  reporter: [["list"], ["html", {
    outputFolder: "tests/e2e/artifacts/report", open: "never",
  }]],
  use: {
    baseURL: "http://127.0.0.1:8002",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `"${python}" -B -m uvicorn api.main:app --host 127.0.0.1 --port 8002 --app-dir . --no-access-log`,
    url: "http://127.0.0.1:8002/api/methods",
    reuseExistingServer: !process.env.CI,
    env: { PYTHONDONTWRITEBYTECODE: "1" },
    timeout: 60_000,
  },
});
