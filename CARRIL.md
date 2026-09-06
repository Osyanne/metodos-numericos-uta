# Estado del trabajo — carriles A y B fusionados

Rama `claude/correctitud-informe-y-release` · base `main`

Los dos carriles vivian en ramas separadas (`AGENTS.md` guarda el contrato con
que se repartieron). El carril B se corto por limite de cuota de Codex con la
mitad de su lista hecha, asi que a partir de aca hay un solo carril y este
archivo reemplaza a los dos `CARRIL.md`.

## Hecho

### Bloque 1 — Porton de correctitud (nucleo y API)

Los seis, cada uno con una prueba que fallaba antes del arreglo. Verificados
otra vez por HTTP contra el codigo corregido, no solo por la suite.

| Sintoma | Estado |
|---|---|
| `plot.root = {x: -1.58e+301}` en el ejercicio del docente | `raiz` y `plot.root` valen `None` |
| Columna de error de Runge-Kutta: 100 %, 140 %, 342 % | `None` en todas las filas, con nota |
| Fin de malla reportado como "sin alcanzar la tolerancia" | `StopReason.COMPLETED` |
| `sqrt(-1)` devolvia HTTP 500 con traceback | 422 con la causa explicada |
| `n = 200000` devolvia 200.001 filas | 422, tope de 10.000 (`MAX_PASOS`) |
| R5: `n = 5` sobre raiz exacta daba 1 fila | 5 filas |

### Bloque 5 — parte de evidencia

`tests/test_extensibilidad.py` ejercita la promesa de R3: escribe un metodo de
juguete en `core/methods/`, recarga y verifica que aparezca en el registro, en
`/api/methods`, con sus campos y resolviendo. **La promesa se sostiene.** De
paso, el assert de `tests/test_api.py` que exigia exactamente cuatro slugs pasa
a ser contencion: con la igualdad, agregar el quinto metodo rompia una prueba,
que es justo lo que la arquitectura promete que no pasa.

### Bloque 1 y 5 del lado del navegador (Codex)

- `web/forms.js` — el formulario ya no altera el problema en silencio.
- `web/plano.js` — teclado y remuestreo protegido.
- `web/styles.css`, `web/index.html` — 320-360 px y etiquetas de accesibilidad.
- `web/presets.js` — catalogo de ejercicios (escrito, **sin cablear**).
- `tests/e2e/`, `playwright.config.js`, `package.json` — andamiaje de Playwright
  (escrito, **nunca ejecutado**).

## Pendiente

1. **`web/app.js`: resultados zombi.** `seleccionarMetodo` limpia el DOM pero no
   `estado.resultado`, asi que mover el control de Decimales repinta la corrida
   del metodo anterior bajo el nombre del nuevo. Falta tambien descartar las
   respuestas que llegan tarde, y conservar el `detail` del servidor al exportar.
2. **`web/tabla.js`: el mapa `MOTIVO`** no traduce `integracion_completada`, que
   el nucleo ya emite. Cae en el fallback y muestra la cadena cruda.
3. **Cablear `web/presets.js`.** Nadie lo importa y nadie referencia `#preset`:
   el desplegable "Ejercicio de ejemplo" que quedo en el HTML esta vacio.
4. **Correr las pruebas de Playwright** contra el servidor real. Ojo: se
   escribieron contra el backend **sin** los arreglos del bloque 1, asi que
   pueden estar afirmando el 342 % y la raiz fantasma como comportamiento
   esperado. Revisar antes de darlas por buenas.
5. **Bloque 2** — informe, manual y matriz de validacion (`docs/`).
6. **Bloque 3** — empaquetado de `web/`, instalacion probada en maquina limpia.
7. **Bloque 5** — README al dia y cierre trazable de los issues.

## Como verificar

    cd "C:/Users/osyanne/Documents/GitHub/metodos-numericos-uta-claude"
    python -m pytest tests/ -p no:cacheprovider

191 pruebas en verde al momento de la fusion.
