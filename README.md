# Aplicativo de Metodos Numericos

Universidad Tecnica de Ambato — FISEI — Carrera de Software, Nivel 3.

Resuelve problemas de metodos numericos mostrando **todas las iteraciones**, con
precision ajustable y un plano interactivo tipo GeoGebra. Disenado para crecer:
los cuatro metodos del primer parcial son los primeros de una decena.

Funciona **sin internet**: no hay ninguna libreria externa ni CDN del lado del
navegador. El plano esta dibujado a mano sobre Canvas.

## Metodos

| Metodo | Unidad | Que resuelve |
|--------|--------|--------------|
| Newton-Raphson | U1 | raices de `f(x) = 0`; la app deriva sola o acepta la derivada |
| Von Mises | U1 | raices, con la derivada congelada en `x0` |
| Interpolacion de Newton | U2 | polinomio expandido, en sus cuatro variantes |
| Runge-Kutta | U3 | EDO y sistemas de EDO, orden 2 y 4 |

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
pytest
```

Tienen que dar **197 pruebas en verde**. Entre ellas hay cuatro que verifican
justamente la instalacion: que todo lo que el codigo importa este declarado en
`pyproject.toml`, y que ningun archivo referenciado desde la interfaz falte en
el repositorio. Las dos cosas pasan desapercibidas en la maquina donde se
escribio el codigo y aparecen en la del que clona.

### Pruebas de navegador

Aparte de las de Python hay **35 pruebas de interfaz** con Playwright, que
levantan el servidor de verdad y manejan la pantalla:

```bash
npm install
npx playwright install chromium
npx playwright test
```

## Como usarlo

1. Elegir el metodo.
2. Cargar un **ejercicio de ejemplo** del desplegable, o escribir los datos a
   mano. Los ejemplos incluyen los ejercicios del material del docente, con la
   fuente de cada uno.
3. Ajustar precision, iteraciones, tolerancia y criterio de error.
4. **Resolver**, y mirar la tabla completa de iteraciones o el plano.
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
tests/          pruebas de Python; tests/e2e/ las de navegador
docs/           especificacion, contrato y validacion
```

## Agregar un metodo nuevo

Crear un archivo en `core/methods/`, construir un `MethodSpec` y registrarlo.
No hay que tocar ningun archivo existente: el registro lo descubre solo y la
interfaz dibuja el formulario a partir de los campos que el metodo declara.

No es una promesa de folleto: `tests/test_extensibilidad.py` la ejercita
escribiendo un metodo nuevo en disco y verificando que aparezca en el registro,
en la API y con sus campos.

## Documentacion

- [Especificacion y preguntas abiertas](docs/ESPECIFICACION.md)
- [Contrato de datos y superficie HTTP](docs/CONTRATO.md)
- [Estado del proyecto para retomarlo](HANDOFF.md)
