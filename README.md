# Aplicativo de Metodos Numericos

Universidad Tecnica de Ambato — FISEI — Carrera de Software, Nivel 3.

Resuelve problemas de metodos numericos mostrando **todas las iteraciones**, con
precision ajustable y un plano interactivo tipo GeoGebra. Disenado para crecer:
los seis metodos confirmados del primer parcial son los primeros de una decena.
Hoy son **once**: ademas del parcial incorpora la Regla del Trapecio, el Metodo
de Simpson, Simpson 1/3 y Simpson 3/8 de U1, a partir del material entregado
para integracion numerica, y el ajuste por minimos cuadrados. Abre en una
**portada** con una tarjeta por metodo, y cada metodo tiene una pestana
**Teoria** que lo explica.

Funciona **sin internet**: no hay ninguna libreria externa ni CDN del lado del
navegador. El plano esta dibujado a mano sobre Canvas.

## Version en linea

**<https://osyanne.github.io/metodos-numericos-uta/>**

Es el mismo aplicativo, sin instalar nada. GitHub Pages solo sirve archivos y
no puede correr Python, asi que el nucleo corre **dentro del navegador** con
[Pyodide](https://pyodide.org) (Python compilado a WebAssembly). No se
reescribio ninguna formula en JavaScript: el navegador ejecuta los mismos
`core/` y `api/`, con la misma aplicacion FastAPI, y `pages/puente.js` le
entrega cada pedido a `api/` como lo haria uvicorn.

Diferencias con la version local:

- La primera visita tiene que descargar Python y SymPy. La interfaz se pinta
  antes, sin esperar a Python: la lista de metodos sale de un `catalogo.json`
  armado con la propia aplicacion, y las descargas empiezan desde el HTML y
  corren en paralelo. En la segunda visita, un service worker (`sw.js`, generado
  al armar el sitio) guarda Pyodide, sus paquetes y el sitio, y funciona sin red.
  El PDF baja su pila (pillow, fonttools, micropip y fpdf2) al exportar el
  primero.
- **Necesita internet**: Pyodide y sus paquetes se bajan de jsDelivr y PyPI.
  Para el laboratorio sin conexion sigue estando la version local de abajo.

El sitio se publica solo con cada push a `main` (`.github/workflows/pages.yml`),
que instala antes las dependencias de Python, y solo si pasan las pruebas del
sitio armado:

```bash
npx playwright test --config playwright.pages.config.js
```

## Metodos

| Metodo | Unidad | Que resuelve |
|--------|--------|--------------|
| Newton-Raphson | U1 | raices de `f(x) = 0`; la app deriva sola o acepta la derivada |
| Von Mises | U1 | raices, con la derivada congelada en `x0` |
| Interpolacion de Newton | U1 | polinomio expandido y forma de Newton, por diferencias divididas |
| Interpolacion de Lagrange | U1 | polinomio expandido, mostrando cada `L_i` con su numerador y denominador |
| Punto Medio | U1 | integral definida `∫[a,b] f(x)dx` con rectangulos centrados |
| Método del Trapecio | U1 | integral definida `∫[a,b] f(x)dx` con segmentos y trapecios |
| Método de Simpson | U1 | integral definida `∫[a,b] f(x)dx` con arcos de parabola, `n` par, y un punto medio por subintervalo |
| Simpson 1/3 | U1 | lo mismo con una parabola por cada dos subintervalos, `n` par (equivale al Metodo de Simpson con `2n`) |
| Simpson 3/8 | U1 | lo mismo con cubicas, `n` de 3 o mas; si `n` no es multiplo de 3 combina las reglas 1/3 y 3/8 (aplicacion multiple) |
| Runge-Kutta | U3 | EDO y sistemas de EDO, orden 2 y 4 |
| Ajuste por minimos cuadrados | U4 | recta `y = m x + b` con correlacion `r` y la tabla con sus totales; modelos potencial, exponencial y logaritmico |

## Instalar y ejecutar

**El aplicativo se ejecuta desde una copia del repositorio.** No se instala como
paquete: la interfaz vive en `web/`, al lado de `api/`, y se sirve desde ahi. Si
falta esa carpeta el servidor no arranca y lo dice.

Hace falta **Python 3.11 o mas nuevo**.

```bash
git clone https://github.com/Osyanne/metodos-numericos-uta.git
cd metodos-numericos-uta

python -m venv .venv
.venv\Scripts\activate            # Windows
source .venv/bin/activate         # Linux o macOS

pip install -e ".[dev]"
python -m uvicorn api.main:app --port 8000
```

Y abrir <http://127.0.0.1:8000>.

> **Windows:** si `python` abre la Microsoft Store en vez de ejecutar Python, el
> `python.exe` del PATH es un alias de la tienda y no sirve para crear entornos
> virtuales. Instalar Python desde [python.org](https://www.python.org/downloads/)
> con la casilla "Add python.exe to PATH", o usar la ruta completa al interprete
> real.

## Comprobar que quedo bien instalado

```bash
python -m pytest tests/ --ignore=tests/e2e
```

Tienen que dar **503 pruebas en verde**. Entre ellas hay cuatro que verifican
justamente la instalacion: que todo lo que el codigo importa este declarado en
`pyproject.toml`, y que ningun archivo referenciado desde la interfaz falte en
el repositorio. Las dos cosas pasan desapercibidas en la maquina donde se
escribio el codigo y aparecen en la del que clona.

### Pruebas de navegador

Aparte de las de Python hay **324 pruebas de interfaz** con Playwright (mas dos
que solo regeneran las capturas del manual, a pedido), que levantan el servidor
de verdad y manejan la pantalla. Entre ellas, `tests/e2e/portada.spec.js` cubre
la portada y la ruta por hash:

```bash
npm install
npx playwright install chromium
npx playwright test
```

Las del sitio de GitHub Pages son **10** y necesitan internet
(`npx playwright test --config playwright.pages.config.js`). Para regenerar las
capturas del manual: `CAPTURAS=1 npx playwright test capturas`.

## Como usarlo

1. Abrir un metodo desde su tarjeta en la **portada** (`#/`; el titulo de la
   cabecera vuelve a ella, y `#/metodo/<slug>` es un enlace directo a un
   metodo), y cambiar de metodo con las pestanas de familia (Raices,
   Interpolacion, Integracion, EDO, Ajuste) y los botones.
2. Cargar un **ejercicio de ejemplo** del desplegable, o escribir los datos a
   mano. Los ejemplos incluyen los ejercicios del material del docente y
   ejercicios de practica para cada metodo, con la fuente de cada uno.
3. Si hace falta, abrir **Ajustes de calculo** para cambiar iteraciones,
   tolerancia y criterio de error. Los decimales se mueven desde la tarjeta de
   Resultado.
4. **Resolver**, y mirar la tabla completa de iteraciones o el plano. La
   pestana **Teoria** explica el metodo y se puede leer sin resolver.
5. **Comparar metodos** enfrenta sobre el mismo problema a los que reciben los
   mismos datos: Newton-Raphson contra Von Mises es el caso interesante.
6. Exportar a CSV o PDF. Los numeros exportados van **sin redondear**: el
   control de decimales es de la pantalla.

En el plano se hace zoom con la rueda y se mueve arrastrando; con el foco
puesto, tambien con las flechas, `+`, `-` y `Home`. Al acercarse, la curva se
recalcula pidiendole puntos al nucleo, no interpolando en el navegador.

## Estructura

```
core/           nucleo numerico puro, sin dependencias de web
  types.py      contrato congelado: MethodSpec, MethodResult, Iteration
  registry.py   registro de metodos: el unico punto de extension
  precision.py  decimales configurables (2..12, por defecto 6)
  errors.py     criterios de error: absoluto, relativo, relativo porcentual
  methods/      un archivo por metodo, se auto-registra al importarse
api/            capa HTTP (FastAPI), no contiene matematica
web/            interfaz: formularios, tabla de iteraciones, plano, presets
pages/          armado del sitio de GitHub Pages y puente a Pyodide
tests/          pruebas de Python; tests/e2e/ las de navegador; tests/pages/ las del sitio
docs/           especificacion, contrato y validacion
```

## Agregar un metodo nuevo

Crear un archivo en `core/methods/`, construir un `MethodSpec` y registrarlo.
No hay que tocar ningun archivo existente del nucleo ni de la API: el registro
lo descubre solo y la interfaz dibuja el formulario a partir de los campos que el
metodo declara.

La interfaz pide un poco mas, y una prueba lo exige: un metodo nuevo tambien
necesita su **formula** en `web/formulas.js` y su **teoria** en `web/teoria.js`
(sin ellas la prueba «todo metodo de la API tiene su guia» de
`tests/e2e/portada.spec.js` falla), y su familia en `FAMILIAS` de `web/app.js`,
con su color en `web/styles.css`, si la familia es nueva.

El nucleo y la API cumplen esto sin promesa de folleto:
`tests/test_extensibilidad.py` escribe un metodo nuevo en disco y verifica que
aparezca en el registro, en la API y con sus campos.

## Documentacion

- [Especificacion y preguntas abiertas](docs/ESPECIFICACION.md)
- [Contrato de datos y superficie HTTP](docs/CONTRATO.md)
