# Contrato de trabajo en carriles

> Archivo generado por la skill `dos-agentes`. Vive **identico en los dos worktrees**.
> Claude Code lo lee via el puntero en `CLAUDE.md`; Codex lo lee directo.

## Objetivo

Dejar el aplicativo de Metodos Numericos listo para la entrega del **9 de octubre
de 2026**, en cinco bloques:

1. **Porton de correctitud** — el aplicativo no puede mostrar numeros falsos. Hoy
   muestra una raiz inventada cuando el metodo diverge, una columna de error que
   llega a 342 %, y resultados de un metodo bajo el nombre de otro.
2. **Informe, manual y matriz de validacion** — el entregable que falta.
3. **Release probada en maquina limpia** — hoy el paquete no incluiria `web/`.
4. **Pruebas de navegador** — 1273 lineas de JavaScript sin una sola prueba.
5. **Demo y evidencia** — presets con los casos del docente, README al dia,
   accesibilidad, y cierre trazable de los issues.

El estado real del proyecto, las decisiones ya tomadas con su razon y los
callejones ya descartados estan en `HANDOFF.md`. **Leelo antes de empezar**: te
ahorra repetir errores que ya costaron tiempo.

## Rama base

`main` — el repo original queda parado ahi y **nadie commitea en esa rama**.
Es la estacion de merge.

## Carriles

| | Agente | Rama | Worktree |
|---|---|---|---|
| **A** | Claude Code | `claude/correctitud-informe-y-release` | `C:/Users/osyanne/Documents/GitHub/metodos-numericos-uta-claude` |
| **B** | Codex | `codex/interfaz-y-pruebas-navegador` | `C:/Users/osyanne/Documents/GitHub/metodos-numericos-uta-codex` |

El reparto es por **capa**, no por tema: A es todo lo que corre en Python, B es
todo lo que corre en el navegador. Se eligio asi a proposito, porque a Codex le
funciona `node` y el Python de la Microsoft Store le da "Access is denied"
(ver `HANDOFF.md`, seccion "Callejones descartados").

### Archivos del carril A (solo A escribe aca)

- `core/**` — todo el nucleo numerico
- `api/**` — capa HTTP
- `tests/test_api.py`, `tests/test_contract.py`, `tests/test_export.py`,
  `tests/test_expression.py`, `tests/test_newton_interpolation.py`,
  `tests/test_newton_raphson.py`, `tests/test_runge_kutta.py`,
  `tests/test_von_mises.py`
- Archivos nuevos de pruebas Python: `tests/test_validacion_docente.py`,
  `tests/casos_validacion.py`, `tests/test_extensibilidad.py`,
  `tests/test_distribucion.py`
- `docs/**`
- `README.md`, `HANDOFF.md`, `CODEOWNERS`
- `pyproject.toml`, `MANIFEST.in`, `.github/**`, `scripts/**`

### Archivos del carril B (solo B escribe aca)

- `web/**` — `index.html`, `styles.css`, `app.js`, `forms.js`, `plano.js`,
  `tabla.js`, `comparador.js`, y los modulos nuevos que agregues
- `tests/e2e/**` — las pruebas de navegador (directorio nuevo, tuyo entero)
- `package.json`, `package-lock.json`, `playwright.config.js` (nuevos)
- `.gitignore` — para que puedas agregar `node_modules/` sin pedir permiso
- `.claude/launch.json`

### Archivos compartidos y su dueno unico

Estos son los imanes de conflicto. Cada uno tiene **un solo** agente autorizado a
escribirlo; el otro lo lee y, si necesita un cambio, lo pide en vez de editarlo.

| Archivo | Dueno | Nota |
|---|---|---|
| `core/types.py`, `core/registry.py` | **A** | Contrato congelado. Ver abajo. |
| `api/schemas.py` | **A** | La superficie HTTP no cambia de forma en esta fase. |
| `pyproject.toml` | **A** | A resuelve el empaquetado de `web/`. |
| `.github/workflows/ci.yml` | **A** | Si B necesita un job de Playwright, **lo pide**; no lo escribe. |
| `README.md`, `docs/**` | **A** | B aporta contenido por la bitacora, no editando. |
| `.gitignore`, `.claude/launch.json` | **B** | |
| `tests/casos_referencia.py` | **NADIE** | Los numeros salen del material del docente. Cambiarlos es borrar la evidencia. |

## Contrato ya congelado en `main`

Se congelo **antes** de crear los carriles, justamente para que no haya que
esperarse. Commit `e52db76`. Los dos lados programan contra esto:

1. **`StopReason.COMPLETED` = `"integracion_completada"`** (nuevo). Es el final
   normal de un metodo de malla fija como Runge-Kutta: recorrio sus n pasos y
   ninguno perdio la finitud.
   - **A** lo emite desde `core/methods/runge_kutta.py`.
   - **B** lo dibuja: en `web/tabla.js` el mapa `MOTIVO` tiene que traducirlo a
     `["ok", "Integracion completada"]` — en verde, no en amarillo.
2. **Runge-Kutta manda `error: null` en todas las filas** y explica por que en
   `notes`. `web/tabla.js` ya muestra `null` como `—`: no hay que cambiar nada,
   pero las pruebas de B deben asumir la raya, no un numero.
3. **Un metodo que diverge no marca raiz tampoco en la grafica.**
   `result.raiz` y `plot.series.root` valen los dos `null`. `web/plano.js:462`
   ya hace `if (s.root)`, asi que tampoco hay que cambiarlo.

Esta escrito en `docs/CONTRATO.md`. Si necesitas que el contrato cambie, **para
y pedilo**: cambiarlo por tu cuenta rompe el otro carril en silencio, que es
exactamente lo que paso la vez pasada con `decimals`.

## Reglas

1. **No escribas fuera de tu lista.** Si necesitas tocar un archivo del otro
   carril, para y avisa — no lo edites "rapidito".
2. **Commitea seguido y chico**, en tu rama. Nunca `git checkout` a la rama del
   otro dentro de tu worktree.
3. **No mergees a `main` por tu cuenta.** El merge lo coordina el usuario cuando
   los dos carriles estan verdes.
4. **Verifica lo tuyo antes de decir que terminaste.** Corre las pruebas del
   carril y pega la salida real; nada de "deberia andar".
5. **Si levantas un servidor, usa un puerto propio.** A usa **8001**, B usa
   **8002**. El 8000 queda libre para que el usuario pruebe a mano.
6. **Si la particion se rompe** (descubris que tu tarea necesita algo del otro
   carril), para y decilo. Es senal de que el trabajo no era paralelizable, no
   de que hay que forzarlo.
7. **No agregues dependencias de CDN ni librerias externas al navegador.** Todo
   tiene que andar sin internet: es requisito para demostrarlo en el
   laboratorio. Playwright es herramienta de desarrollo, no del producto.

## Estado

Cada agente mantiene el suyo en `CARRIL.md`, dentro de su propio worktree.
