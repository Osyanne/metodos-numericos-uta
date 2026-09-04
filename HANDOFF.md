# HANDOFF — Aplicativo de Métodos Numéricos (UTA-FISEI, Software N3)

_Actualizado: 2026-08-29 · rama `main` · último commit `3acb1ee` · árbol limpio, todo pusheado_

## Objetivo

Aplicativo para la asignatura Métodos Numéricos. Resuelve problemas mostrando
**todas las iteraciones**, con precisión ajustable y un plano interactivo tipo
GeoGebra. Entrega del primer parcial: **9 de octubre de 2026**.

Cuatro métodos ahora, unos diez para fin de semestre, así que la expansión no es
un extra: es requisito explícito del docente.

## Estado

**Hecho y verificado** — 178 pruebas en verde, aplicativo funcionando de punta a punta.

- Núcleo: Newton-Raphson, Von Mises, Interpolación de Newton, Runge-Kutta.
- API: los seis endpoints, exportación a CSV y PDF.
- Interfaz: formulario genérico, tabla de iteraciones, plano con zoom y paneo,
  comparador de métodos.
- Verificado en navegador contra la API real: Von Mises reproduce la tabla del
  docente dígito por dígito, y un sistema de dos EDO da y₁(1.6) = −0.029198
  contra cos(1.6) = −0.029200.

**Falta**

- Informe, manual de usuario y validación documentada (issue #10).
- Despliegue y guía de instalación probada en máquina limpia (issue #12).
- La columna de error de Runge-Kutta muestra un número sin sentido (ver
  "Próximo paso").

**Los dos colaboradores del grupo nunca aceptaron la invitación al repo**
(`alvarolopezmoya`, `Edison206`), así que los issues #6 a #13 figuran sin
asignar aunque el trabajo esté hecho.

## Decisiones tomadas

- **El contrato se congela antes de partir el trabajo.** `core/types.py`,
  `core/plots.py`, `api/schemas.py` y `docs/CONTRATO.md` se escribieron y
  probaron primero. Sin eso, dos agentes trabajando en paralelo chocan en cada
  frontera y el problema recién aparece al integrar.
- **`decimals` es formato, no cálculo.** Los datos viajan sin redondear y se
  formatean al mostrar. Redondear al mostrar es reversible; al guardar degrada
  la gráfica, el CSV y el remuestreo del zoom. Hay una prueba parametrizada que
  compara `decimals=2` contra `decimals=10` en los cuatro métodos.
- **El núcleo es el único que hace matemática.** La interfaz nunca evalúa `f(x)`;
  al hacer zoom pide puntos a `POST /api/plot/sample`. Dos parsers podrían
  discrepar justo en lo que el docente califica.
- **Sin librerías externas ni CDN.** Todo tiene que andar sin internet: es
  requisito para demostrarlo en el laboratorio. El plano es Canvas a mano.
- **Von Mises NO es el método de las potencias.** Es una variante de
  Newton-Raphson que congela la derivada en x₀: `x(i+1) = x(i) − f(x(i))/f'(x0)`.
  Confirmado con el material del docente. La derivada se evalúa **una sola vez,
  antes del bucle**; si se recalcula, esto se vuelve Newton-Raphson, sigue
  convergiendo y sigue pareciendo correcto, pero deja de coincidir con los
  números de clase. Hay una prueba que distingue ambas tablas.
- **Interpolación implementa las cuatro variantes** (divididas, adelante, atrás,
  auto) porque el docente no sabe cuál espera. El polinomio es el mismo en todas;
  cambia la tabla que se muestra.

## Callejones descartados

**No repetir esto.** Todo lo de acá ya se probó y falló.

- **Codex no puede ejecutar git en un git worktree.** El `.git` de un worktree es
  un archivo que apunta al repo padre, y esa metadata queda fuera de su sandbox:
  cualquier commit muere con permiso denegado. Ningún ajuste de `-s` lo arregla
  salvo abrirle acceso total a la máquina. **Solución: Codex escribe archivos y
  no toca git; los commits los hace quien integra.**
- **El Python de la Microsoft Store no sirve para nada que corra aislado.** Su
  `python.exe` es un alias de ejecución en `WindowsApps` que delega a otro lado,
  y un venv creado desde él hereda esa indirección en `pyvenv.cfg`. Codex lo
  rechaza con "Access is denied". **Solución: copiar un CPython real (los de
  `%APPDATA%\Roaming\uv\python\`) a `.venv/base` DENTRO del worktree y crear el
  venv desde ese ejecutable.** Un `python -m venv` normal no alcanza.
- **Codex se detiene a pedir aprobación de diseño** antes de implementar, por una
  skill obligatoria suya. Costó dos arranques en vacío. **Solución: pre-aprobar
  explícitamente en el prompt inicial**, incluyendo "y todo lo que se derive
  razonablemente de eso".
- **El navegador cachea los módulos JS y sirve versiones viejas.** Se perdió
  tiempo creyendo que una corrección no funcionaba cuando en realidad no se
  estaba cargando. Ya está mitigado con `Cache-Control: no-cache` en
  `api/main.py`, pero al depurar conviene confirmar con
  `fetch('/archivo.js?bust=' + Date.now())` antes de dudar del código.
- **`global_dict={}` rompe el parser de sympy.** Necesita `Integer`, `Float`,
  `Rational` y `Symbol` para construir números. Se acota a esos cuatro nombres en
  `core/expression.py`, no se vacía ni se deja el `import *` por defecto.
- **`.panel { display: flex }` le gana al atributo `[hidden]`.** El `[hidden]` del
  navegador es solo una regla del user-agent. Hay una regla explícita en
  `web/styles.css`; no quitarla.

## Cómo verificar

```bash
cd "C:/Users/osyanne/Documents/GitHub/metodos-numericos-uta" && PYTHONPATH=. python -m pytest tests/ -q
```

Tienen que dar **178 pruebas en verde, 0 saltadas**. Si alguna de las cuatro
pruebas parametrizadas de `test_los_decimales_no_cambian_los_valores_calculados`
se salta, es que un método dejó de registrarse.

Para levantar el aplicativo:

```bash
python -m uvicorn api.main:app --port 8000 --app-dir "C:/Users/osyanne/Documents/GitHub/metodos-numericos-uta"
```

## Próximo paso

**Arreglar la columna de error de Runge-Kutta en `core/methods/runge_kutta.py`.**

Hoy muestra el error relativo entre `y(i+1)` y `y(i)`, que para una EDO no mide
nada: es cuánto cambió la solución entre pasos, no cuánto se equivoca. Con el
sistema oscilador la solución cruza el cero y la columna llega a mostrar **342 %**,
lo que va a leerse como que el programa está roto.

Dos salidas, hay que elegir una:

1. **Dejar `error` en `None`** para Runge-Kutta y agregar una nota explicando que
   un método de paso único no produce estimación de error por iteración. Es una
   línea y es honesto.
2. **Estimarlo de verdad** corriendo también con `h/2` y comparando (extrapolación
   de Richardson). Más trabajo, pero es lo correcto y queda bien en el informe.

Después de eso: el informe y el manual (issue #10).

## Preguntas abiertas al docente

- **El ejercicio propuesto de `VON MISES.pdf` diverge.** `4x³ − 18x² + 12x − 6 = 0`
  con `x0 = 1.165`: la única raíz real está en 3.81699684, y ahí `f'` vale +49.6
  contra los −13.65 congelados en el punto inicial. El aplicativo lo reporta como
  divergencia con la causa explicada. Newton-Raphson sobre el mismo ejercicio sí
  converge. Falta preguntar si la divergencia es a propósito.
- **Variante de interpolación de Newton** que espera ver (divididas o finitas).
  No bloquea: están las cuatro.
- **No existe rúbrica**, confirmado por el docente.

## Archivos en juego

- `core/methods/runge_kutta.py` — el próximo paso.
- `docs/ESPECIFICACION.md` — requisitos acordados y preguntas abiertas.
- `docs/CONTRATO.md` — formas de datos y superficie HTTP.

## No tocar

- `tests/casos_referencia.py` — los números salen del material del docente. Son
  la vara para medir si un método está bien; cambiarlos es borrar la evidencia.
- El bloque de lista blanca de `core/expression.py` — la entrada llega por HTTP.
- Los worktrees `../metodos-numericos-uta-claude` y `../metodos-numericos-uta-codex`
  están **ya integrados en `main`** y no contienen nada que no esté acá. Se pueden
  retirar con `git worktree remove`.
