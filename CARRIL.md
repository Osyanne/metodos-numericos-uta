# Carril A — Claude Code

Rama `claude/correctitud-informe-y-release` · worktree
`C:/Users/osyanne/Documents/GitHub/metodos-numericos-uta-claude` · base `main`

El contrato completo (incluida la lista de archivos del carril B, que **no**
tocas) esta en `AGENTS.md`, al lado de este archivo.

## Tu tarea

Todo lo que corre en Python: correctitud del nucleo, capa HTTP, documentacion
academica y release.

### Bloque 1 — Porton de correctitud (primero, lo demas depende)

1. **Raiz fantasma al divergir.** `core/methods/_raices.py:201` pasa `raiz` a
   `_grafica()` sin mirar si el metodo diverge, y `_grafica` la marca sobre el
   eje x mientras `result["raiz"]` ya vale `None`.
   Reproducido con **el ejercicio propuesto por el docente**:

       von-mises · f(x)=4x^3-18x^2+12x-6 · x0=1.165
       result.raiz = None      pero      plot.root = {x: -1.5773e+301, y: 0.0}

   El plano dibuja una raiz en 1e301 justo en el ejercicio que el docente va a
   revisar. Es el bug mas caro del repo.

2. **Columna de error de Runge-Kutta.** `_error_estado()`
   (`core/methods/runge_kutta.py:343`) compara `y(i+1)` con `y(i)`: mide cuanto
   cambio la solucion, no cuanto se equivoca. Reproducido con el oscilador
   (`fxy=["y2","-y1"]`, `y0=[0,1]`, `h=0.1`, orden 4):

       n=1   error = 100.00 %      (y0 vale 0, cualquier paso da 100 %)
       n=15  error = 140.28 %
       n=16  error = 342.27 %      (la solucion cruza el cero)

   Ademas en un sistema toma el `max` entre componentes de escalas distintas.
   **Decision ya tomada:** `error=None` en todas las filas mas una nota que
   explique que un metodo de paso unico no produce estimacion de error por
   iteracion. **No** implementar Richardson: obliga a definir si se estima error
   local o global y como agregarlo en sistemas, y eso no cabe antes del 9-oct.

3. **Estado contradictorio de Runge-Kutta.** `runge_kutta.py:111` devuelve
   `converged=True` fijo junto a `stop_reason=MAX_ITERATIONS`. Usar el
   `StopReason.COMPLETED` ya congelado en `main`.

4. **`sqrt(-1)` devuelve HTTP 500.** `core/expression.py:86` tiene
   `float(resultado)` fuera del `try`, y una constante que SymPy simplifica a
   complejo revienta con traceback:

       TypeError: float() argument must be a string or a real number, not 'complex'

   Tiene que ser un 422 con la causa explicada, como el resto de los errores
   matematicos. La entrada llega por HTTP: un 500 es un agujero, no un detalle.

5. **`n` de Runge-Kutta sin tope.** El maximo de 10.000 de `api/schemas.py` solo
   protege `max_iterations`. Verificado: `n=200000` devuelve **200.001 filas**
   con HTTP 200.

6. **R5 se incumple con raiz exacta.** `core/methods/_raices.py:114` corta al
   encontrar solucion exacta aunque `stop_on_tolerance=False`. Verificado:
   `x^2-4` con `x0=2` y `n=5` devuelve **1 fila**, no 5. R5 promete "el calculo
   hasta cualquier iteracion n". Decidir y **documentar**: o se cumple R5, o la
   excepcion queda escrita en `docs/ESPECIFICACION.md`.

### Bloque 2 — Informe, manual y matriz de validacion

Es el entregable ausente (issue #10). La matriz traza
**requisito -> caso -> resultado esperado -> tolerancia -> evidencia**, cubriendo
los once requisitos de `docs/ESPECIFICACION.md`.

Hoy **solo Von Mises** tiene numeros atribuibles al material del docente
(`tests/casos_referencia.py`). Los otros tres tienen casos matematicamente
correctos pero sin origen documentado: hay que decir de donde sale cada numero.

El manual de usuario va con capturas del aplicativo funcionando.

### Bloque 3 — Release probada en maquina limpia

**Bug concreto:** `pyproject.toml:22` empaqueta solo `core`, `core.methods` y
`api`. **`web/` no entra en el artefacto**, y el `check_dir=False` de
`api/main.py:56` lo oculta: la app arranca igual y sirve la API sin interfaz.

Decidir explicitamente entre "clonar y ejecutar desde fuente" o wheel instalable,
y despues probarlo de verdad: `tests/test_distribucion.py` que construya el
artefacto, lo instale en un entorno limpio y verifique que `/` sirve la interfaz.
Guia de instalacion en el README (issue #12).

### Bloque 5 (tu mitad) — Evidencia

- `README.md`: los cuatro metodos siguen figurando como "en desarrollo"
  (`README.md:11`) y estan terminados.
- Cerrar los issues #2-#9, #11 y #13 enlazando commit y prueba. Sin rubrica, el
  repo **es** la evidencia: un tablero lleno de issues abiertos con el trabajo
  hecho se lee como proyecto a medias.
- **Una** prueba de extensibilidad que reemplace el assert de
  `tests/test_api.py:372`, que hoy exige que los slugs sean exactamente cuatro y
  contradice la promesa del README de que agregar un metodo no toca nada
  existente. Registrar un metodo de juguete y verificar que aparece en
  `/api/methods` y que la interfaz recibe sus campos. **No** implementar los
  metodos 5-10: no entran antes del 9-oct y no es lo que se califica.

## Archivos que te pertenecen

`core/**` · `api/**` · los ocho `tests/test_*.py` de Python existentes y los
nuevos · `docs/**` · `README.md` · `HANDOFF.md` · `CODEOWNERS` ·
`pyproject.toml` · `MANIFEST.in` · `.github/**` · `scripts/**`

## Archivos que NO podes tocar

`web/**` · `tests/e2e/**` · `package.json` · `playwright.config.js` ·
`.gitignore` · `.claude/launch.json` · **`tests/casos_referencia.py`** (nadie).

Si alguno te bloquea, para y avisa. No lo edites.

## Terminado significa

- `python -m pytest tests/ -q` en verde, con las pruebas nuevas incluidas y la
  salida real pegada.
- Los seis puntos del bloque 1 arreglados y cada uno con una prueba que falla
  antes del arreglo.
- Informe, manual y matriz de validacion en `docs/`.
- La instalacion probada en un entorno limpio, con la salida del procedimiento.
- `HANDOFF.md` actualizado con el estado nuevo.

## Bitacora

- [ ] (pendiente)
