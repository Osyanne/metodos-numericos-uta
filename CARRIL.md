# Carril B — Codex

Rama `codex/interfaz-y-pruebas-navegador` · worktree
`C:/Users/osyanne/Documents/GitHub/metodos-numericos-uta-codex` · base `main`

El contrato completo (incluida la lista de archivos del carril A, que **no**
tocas) esta en `AGENTS.md`, al lado de este archivo.

## Pre-aprobacion

**El diseno de este carril esta aprobado de antemano**, incluido todo lo que se
derive razonablemente de el. No pares a pedir aprobacion de diseno: implementa,
verifica y anota en la bitacora. Solo para si necesitas tocar un archivo del
carril A o cambiar el contrato congelado.

## Tu entorno

Este worktree tiene un **CPython real** en `.venv/`, creado desde
`%APPDATA%/uv/python/cpython-3.12.13` con las dependencias ya instaladas. Usalo:

    .venv/Scripts/python.exe -m uvicorn api.main:app --port 8002 --app-dir .

**No uses `python` a secas**: el `python.exe` del PATH es el alias de la
Microsoft Store y te va a dar "Access is denied" (ver `HANDOFF.md`).

`node v24.14.1` y `npx 11.11.0` estan disponibles.

**Vos no ejecutas git.** El `.git` de un worktree es un archivo que apunta al
repo padre y esa metadata queda fuera de tu sandbox: cualquier commit muere con
permiso denegado. Escribi los archivos y deja constancia en la bitacora; los
commits los hace quien integra.

## Tu tarea

Todo lo que corre en el navegador: correctitud de la interfaz, pruebas de
navegador, presets y accesibilidad.

### Bloque 1 — Porton de correctitud (primero)

1. **Resultados zombi.** `web/app.js:82` (`seleccionarMetodo`) limpia el DOM pero
   **no** `estado.resultado`. Entonces: elegis Newton-Raphson, resolves, cambias
   a Runge-Kutta, y con solo mover el control de Decimales (`web/app.js:160`)
   reaparece la tabla de Newton-Raphson bajo el nombre del otro metodo. Es el
   peor bug de la interfaz: muestra numeros correctos atribuidos al metodo
   equivocado.

2. **Respuestas tardias.** Una resolucion o un remuestreo iniciados para un
   metodo pueden llegar despues de que el usuario cambio de metodo, y se pintan
   igual. Hace falta descartar la respuesta que ya no corresponde.

3. **`web/tabla.js`: el mapa `MOTIVO`** tiene que traducir el
   `integracion_completada` ya congelado en `main` a
   `["ok", "Integracion completada"]` — en verde. Hoy cae en el fallback y
   muestra la cadena cruda; y mientras el carril A no lo emita, Runge-Kutta
   sigue diciendo "Completo las n iteraciones sin alcanzar la tolerancia" sobre
   un metodo que nunca persigue una tolerancia.

4. **El formulario altera el problema en silencio.** `web/forms.js:98`: una
   coordenada vacia se convierte en cero, asi que una fila a medio llenar entra
   como el punto (0, 0) sin avisar. `web/forms.js:268`: un entero escrito con
   decimales se redondea sin decirlo. Las dos cosas cambian el problema que el
   usuario cree haber planteado.

5. **Exportacion.** El manejador de `web/app.js` descarta el `detail` que manda
   el servidor y muestra "No se pudo exportar", perdiendo la causa; tampoco
   deshabilita el boton mientras corre. El resto de la app si usa el `detail`
   (ver la funcion `pedir`): igualalo.

### Bloque 4 — Pruebas de navegador

**1273 lineas de JavaScript sin una sola prueba**, contra 178 pruebas del lado
Python. Es el mayor hueco de verificacion del repo.

Playwright, en `tests/e2e/`, contra el servidor real en el puerto **8002**. No
persigas un porcentaje: cubri lo que romperia la demostracion.

- Resolver los cuatro metodos y ver la tabla con sus columnas.
- **Cambiar de metodo no resucita el resultado anterior** (bug 1 y 2).
- Un sistema de dos EDO con Runge-Kutta: dos series en el plano, y la columna
  de error mostrando `—` en todas las filas (contrato congelado).
- Exportar CSV y PDF.
- El plano: zoom, paneo, y que el remuestreo pida puntos al servidor.
- Viewport movil.

### Bloque 5 (tu mitad) — Demo y accesibilidad

- **Presets con los casos del docente.** Newton-Raphson y Von Mises ya traen
  defaults y Interpolacion tiene un fallback en `web/forms.js:256`, pero no hay
  catalogo de casos completos y **Runge-Kutta no tiene ninguno**. Un desplegable
  que cargue el ejercicio entero (todos los campos a la vez) sirve para la
  sustentacion y para que el docente pruebe sin escribir nada. Incluir el
  ejercicio divergente de `VON MISES.pdf` (`4x^3-18x^2+12x-6`, `x0=1.165`):
  el aplicativo lo reporta como divergencia con la causa explicada, y eso es una
  funcionalidad, no una falla.
- **El plano no admite teclado** (`web/plano.js:231`): zoom y paneo son solo
  mouse. Agregar foco y flechas/`+`/`-`.
- **Se recorta entre 320 y 360 px** por el minimo de 320 px del canvas dentro de
  un panel con padding (`web/styles.css:94`).

## Archivos que te pertenecen

`web/**` · `tests/e2e/**` (nuevo) · `package.json`, `package-lock.json`,
`playwright.config.js` (nuevos) · `.gitignore` · `.claude/launch.json`

## Archivos que NO podes tocar

`core/**` · `api/**` · los `tests/test_*.py` de Python · `docs/**` ·
`README.md` · `HANDOFF.md` · `pyproject.toml` · `.github/**` ·
**`tests/casos_referencia.py`** (nadie).

Si necesitas un cambio en la API o en el CI, **pedilo en la bitacora**. No lo
edites.

## Terminado significa

- Los cinco puntos del bloque 1 arreglados.
- Las pruebas de `tests/e2e/` corriendo en verde contra el servidor real, con la
  salida pegada. Anota el comando exacto para correrlas.
- Presets, teclado en el plano y el recorte de 320 px resueltos.
- La bitacora con lo que el carril A necesita saber al mergear.

## Bitacora

### Plan de ejecución (2026-09-05)

- [ ] Reproducir resultados zombi y respuestas tardías en navegador; invalidar
  resultados, comparaciones y operaciones anteriores en `web/app.js` y
  `web/comparador.js`; conservar el detalle y el estado ocupado al exportar.
- [ ] Validar puntos incompletos y enteros sin redondeos en `web/forms.js`;
  cargar ejercicios completos desde `web/presets.js` y el selector de la UI.
- [ ] Traducir `integracion_completada` en `web/tabla.js`; verificarlo junto
  con las columnas, CSV/PDF y las respuestas del servidor real.
- [ ] Proteger el remuestreo y habilitar teclado en `web/plano.js`; corregir
  anchos mínimos en `web/styles.css` y comprobar 320/360 px.
- [ ] Ejecutar Playwright en 8002, revisar los cambios y registrar salida real
  y dependencias de integración. Sin git, sin editar archivos del carril A.
