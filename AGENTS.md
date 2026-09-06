# Guia para agentes

Aplicativo de Metodos Numericos — UTA, FISEI, Software Nivel 3.
Entrega del primer parcial: **9 de octubre de 2026**.

**Leer [`HANDOFF.md`](HANDOFF.md) antes de tocar nada.** Tiene el estado real,
las decisiones con su razon y los callejones que ya se probaron y fallaron.
Este archivo solo lista las reglas duras.

## No tocar

- **`tests/casos_referencia.py`** — los numeros salen del material del docente.
  Son la vara para medir si un metodo esta bien. Si una prueba falla contra
  ellos, lo que esta mal es el codigo. Cambiarlos es borrar la evidencia.
- **La lista blanca de `core/expression.py`** — la entrada llega por HTTP.

## Reglas de diseno

- **El nucleo es el unico que hace matematica.** La interfaz nunca evalua
  `f(x)`: cuando el plano necesita mas puntos al hacer zoom, se los pide a
  `POST /api/plot/sample`. Dos parsers podrian discrepar justo en lo que el
  docente califica.
- **`decimals` es formato, no calculo.** Los datos viajan sin redondear y se
  formatean al mostrar. Eso incluye el CSV: redondear al mostrar es reversible,
  al guardar no.
- **Sin librerias externas ni CDN en el navegador.** Tiene que funcionar sin
  internet para la demostracion en el laboratorio.
- **Agregar un metodo es crear un archivo en `core/methods/`** y registrar un
  `MethodSpec`. No se toca ningun archivo existente. Si algo obliga a tocarlos,
  eso es el bug. Ver `tests/test_extensibilidad.py`.
- **Von Mises congela la derivada en x₀** y la evalua **una sola vez, antes del
  bucle**. Si se recalcula, esto se vuelve Newton-Raphson: sigue convergiendo y
  sigue pareciendo correcto, pero deja de coincidir con los numeros de clase.

## Verificar

```bash
pytest --ignore=tests/e2e     # 197 en verde
npx playwright test           # 35 en verde
```

Las de navegador necesitan `npm install` y `npx playwright install chromium`.

Una prueba nueva no vale si nunca se la vio fallar. Y un numero esperado no se
obtiene corriendo el aplicativo y copiando la salida: eso congela tambien el
error. Ver [`docs/VALIDACION.md`](docs/VALIDACION.md).

## Documentacion

| Archivo | Que tiene |
|---|---|
| [`HANDOFF.md`](HANDOFF.md) | estado, decisiones, callejones descartados |
| [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md) | los once requisitos acordados |
| [`docs/CONTRATO.md`](docs/CONTRATO.md) | formas de datos y superficie HTTP |
| [`docs/VALIDACION.md`](docs/VALIDACION.md) | que se comprobo y contra que |
| [`docs/MANUAL.md`](docs/MANUAL.md) | manual de usuario |
| [`docs/INFORME.md`](docs/INFORME.md) | informe academico |
