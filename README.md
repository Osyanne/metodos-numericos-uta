# Aplicativo de Metodos Numericos

Universidad Tecnica de Ambato — FISEI — Carrera de Software, Nivel 3.

Resuelve problemas de metodos numericos mostrando **todas las iteraciones**, con
precision ajustable y grafica del ejercicio. Disenado para crecer: los cuatro
metodos del primer parcial son los primeros de una decena.

## Metodos

| Metodo | Que resuelve | Estado |
|--------|--------------|--------|
| Newton-Raphson | raices de `f(x) = 0` | en desarrollo |
| Von Mises | raices, con la derivada congelada en `x0` | en desarrollo |
| Interpolacion de Newton | polinomio expandido por diferencias divididas | en desarrollo |
| Runge-Kutta | EDO y sistemas de EDO, orden 2 y 4 | en desarrollo |

## Correr el proyecto

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -e ".[dev]"
pytest
uvicorn api.main:app --reload
```

## Estructura

```
core/           nucleo numerico puro, sin dependencias de web
  types.py      contrato congelado: MethodSpec, MethodResult, Iteration
  registry.py   registro de metodos: el unico punto de extension
  precision.py  decimales configurables (2..12, por defecto 6)
  errors.py     criterios de error: absoluto, relativo, relativo porcentual
  methods/      un archivo por metodo, se auto-registra al importarse
api/            capa HTTP (FastAPI), no contiene matematica
web/            interfaz: formularios, tabla de iteraciones, graficas
tests/          pruebas
docs/           especificacion y preguntas abiertas al docente
```

## Agregar un metodo nuevo

Crear un archivo en `core/methods/`, construir un `MethodSpec` y registrarlo.
No hay que tocar ningun archivo existente: el registro lo descubre solo y la
interfaz dibuja el formulario a partir de los campos que el metodo declara.

## Documentacion

- [Especificacion y preguntas abiertas](docs/ESPECIFICACION.md)
