# HANDOFF — Aplicativo de Métodos Numéricos (UTA-FISEI, Software N3)

_Actualizado: 2026-09-06 · rama `main` · árbol limpio_

## Objetivo

Aplicativo para la asignatura Métodos Numéricos. Resuelve problemas mostrando
**todas las iteraciones**, con precisión ajustable y un plano interactivo tipo
GeoGebra. Entrega del primer parcial: **9 de octubre de 2026**.

Cuatro métodos ahora, unos diez para fin de semestre, así que la expansión no es
un extra: es requisito explícito del docente.

## Estado

**Todo el trabajo está hecho, verificado y mergeado a `main`** (merge `4aa4c30`).

| | |
|---|---|
| Pruebas de Python | **197 en verde**, corridas sobre `main` |
| Pruebas de navegador (Playwright) | **35 en verde**, corridas sobre `main` |
| Instalación en limpio | probada: clon nuevo, entorno virgen, todo funcionando |

Documentación completa en `docs/`: [ESPECIFICACION](docs/ESPECIFICACION.md),
[CONTRATO](docs/CONTRATO.md), [VALIDACION](docs/VALIDACION.md),
[MANUAL](docs/MANUAL.md), [INFORME](docs/INFORME.md).

### Lo que se arregló en esta tanda

Seis defectos de correctitud que la suite no veía, cada uno reproducido antes de
tocar nada y con una prueba que falla sin el arreglo:

| Síntoma | Dónde estaba |
|---|---|
| El plano marcaba una raíz en `x = −1.58e+301` **en el ejercicio del docente** que diverge | `core/methods/_raices.py` |
| La columna de error de Runge-Kutta llegaba a **342 %** con la solución exacta al sexto decimal | `core/methods/runge_kutta.py` |
| Fin de malla reportado como "sin alcanzar la tolerancia" | `core/methods/runge_kutta.py` |
| `sqrt(-1)` devolvía **HTTP 500** con traceback | `core/expression.py` |
| `n = 200000` devolvía 200.001 filas con HTTP 200 | `core/methods/runge_kutta.py` |
| R5 incumplido: `n=5` sobre raíz exacta daba 1 fila | `core/methods/_raices.py` |

Y en la interfaz: cambiar de método dejaba `estado.resultado` vivo, así que
mover el control de Decimales repintaba la corrida anterior **bajo el nombre del
método nuevo**. Más las respuestas que llegaban tarde, el `#leyenda` que no se
limpiaba, y la exportación que perdía la causa del servidor.

### Lo que falta

1. Confirmar las dos preguntas abiertas con el docente (abajo).
2. Cerrar los issues #10 y #12, que quedaron abiertos porque su trabajo todavía
   no estaba en `main` cuando se cerraron los demás. Ahora sí lo está.
3. Los métodos 5 a 10, para el resto del semestre.

## Decisiones tomadas

- **El contrato se congela antes de partir el trabajo.** `core/types.py`,
  `core/plots.py`, `api/schemas.py` y `docs/CONTRATO.md` se escriben y prueban
  primero. Sin eso, dos agentes en paralelo chocan en cada frontera y el
  problema recién aparece al integrar.
- **`decimals` es formato, no cálculo.** Los datos viajan sin redondear y se
  formatean al mostrar. Hay una prueba parametrizada que compara `decimals=2`
  contra `decimals=10` en los cuatro métodos. **El CSV también va sin
  redondear**, y eso está en el contrato: una prueba de navegador que esperaba
  lo contrario se corrigió en la prueba, no en el código.
- **El núcleo es el único que hace matemática.** La interfaz nunca evalúa
  `f(x)`; al hacer zoom pide puntos a `POST /api/plot/sample`. Dos parsers
  podrían discrepar justo en lo que el docente califica.
- **Sin librerías externas ni CDN.** Todo tiene que andar sin internet.
- **Von Mises NO es el método de las potencias.** Es Newton-Raphson con la
  derivada congelada en x₀: `x(i+1) = x(i) − f(x(i))/f'(x0)`. La derivada se
  evalúa **una sola vez, antes del bucle**; si se recalcula, esto se vuelve
  Newton-Raphson, sigue convergiendo y sigue pareciendo correcto, pero deja de
  coincidir con los números de clase. Hay una prueba que distingue ambas tablas.
- **Runge-Kutta no reporta error por iteración**, y la columna vacía es la
  respuesta correcta. Estimarlo de verdad exige resolver con `h/2` y comparar, y
  antes hay que decidir si se estima error local o global y cómo agregarlo en un
  sistema. Se descartó **a propósito** para este parcial, no por olvido.
- **El aplicativo se ejecuta desde una copia del repositorio**, no como paquete:
  `web/` se busca al lado de `api/`. Si falta, el servidor **no arranca y lo
  dice**, en vez de servir una API sin pantalla.

## Callejones descartados

**No repetir esto.** Todo lo de acá ya se probó y falló.

- **Codex no puede ejecutar git en un git worktree.** El `.git` de un worktree
  es un archivo que apunta al repo padre, y esa metadata queda fuera de su
  sandbox. **Solución: Codex escribe archivos y no toca git; los commits los
  hace quien integra.**
- **El Python de la Microsoft Store no sirve para nada que corra aislado.**
  **Solución: copiar un CPython real (los de `%APPDATA%\Roaming\uv\python\`) a
  `.venv/base` DENTRO del worktree y crear el venv desde ese ejecutable.**
- **`gpt-6-astra` necesita codex-cli ≥ 0.153.** Con 0.150 el CLI resolvía el
  default en silencio a `gpt-5.6-sol`, y forzarlo con `-m` daba HTTP 400. Se
  arregla con `codex update`. Ojo con `model_reasoning_effort = "ultra"`:
  consume cuota rápido, y una corrida larga se cortó a mitad por límite de uso.
- **`preview_start` sirve el repo principal, no el worktree.** Editar el
  `.claude/launch.json` del worktree no lo cambia. Para verificar la interfaz de
  una rama, usar Playwright, que levanta su propio servidor con `--app-dir .`.
- **`playwright.config.js` no arranca en Windows con rutas de barras normales.**
  `cmd.exe` no reconoce `.venv/Scripts/python.exe`. Hay que resolver la ruta
  absoluta con `node:path`.
- **Codex se detiene a pedir aprobación de diseño.** **Solución: pre-aprobar
  explícitamente en el prompt inicial**, incluyendo "y todo lo que se derive
  razonablemente de eso".
- **El navegador cachea los módulos JS.** Mitigado con `Cache-Control: no-cache`
  en `api/main.py`.
- **`global_dict={}` rompe el parser de sympy.** Necesita `Integer`, `Float`,
  `Rational` y `Symbol`.
- **`.panel { display: flex }` le gana al atributo `[hidden]`.** Hay una regla
  explícita en `web/styles.css`; no quitarla.

## Cómo verificar

```bash
cd "C:/Users/osyanne/Documents/GitHub/metodos-numericos-uta"
python -m pytest tests/ --ignore=tests/e2e     # 197 en verde
npx playwright test                            # 35 en verde
```

Para regenerar las capturas del manual, con la interfaz cambiada:

```bash
CAPTURAS=1 npx playwright test capturas
```

**Ojo con un flake.** Aparece en unas 2 de cada 8 corridas de Playwright: falla
una prueba y en el resto pasa todo. **Todavía sin identificar** — las dos veces
que apareció, las corridas siguientes salieron limpias y no se alcanzó a
capturar el nombre. Para aislarlo, correr `npx playwright test --repeat-each=5`
y guardar la salida a un archivo, en vez de filtrarla por tubería.

Las pruebas de navegador necesitan `npm install` y `npx playwright install
chromium`. Los navegadores ya descargados están en el worktree de Codex; se
pueden reutilizar con `PLAYWRIGHT_BROWSERS_PATH`.

## Próximo paso

**Preguntarle al docente las dos cosas de abajo**, y aislar el flake de
Playwright. Después, los métodos 5 a 10 para el resto del semestre: la
arquitectura para agregarlos está ejercitada con una prueba que la usa de
verdad.

Las ramas `claude/correctitud-informe-y-release` y
`codex/interfaz-y-pruebas-navegador` ya están mergeadas y se pueden borrar,
junto con sus worktrees (`git worktree remove`).

## Preguntas abiertas al docente

- **El ejercicio propuesto de `VON MISES.pdf` diverge.** `4x³ − 18x² + 12x − 6 = 0`
  con `x0 = 1.165`: la única raíz real está en 3.81699684, y ahí `f'` vale +49.6
  contra los −13.65 congelados en el punto inicial. El aplicativo lo reporta
  como divergencia con la causa explicada, y ya no dibuja una raíz falsa.
  Newton-Raphson sobre el mismo ejercicio sí converge. **Falta preguntar si la
  divergencia es a propósito.**
- **Variante de interpolación de Newton** que espera ver (divididas o finitas).
  No bloquea: están las cuatro.
- **No existe rúbrica**, confirmado por el docente. `docs/VALIDACION.md` cumple
  esa función.

## No tocar

- `tests/casos_referencia.py` — los números salen del material del docente. Son
  la vara para medir si un método está bien; cambiarlos es borrar la evidencia.
- El bloque de lista blanca de `core/expression.py` — la entrada llega por HTTP.

<!-- handoff:auto -->
<!-- /handoff:auto -->
