# Especificacion del aplicativo

Asignatura: METODOS NUMERICOS (UTA-FISEI-SF-MP-UB-03-01) — Software, Nivel 3.
Docentes: Ing. Henry Cumbal, Dr. Victor Penafiel.

## Confirmado por el docente

| # | Requisito |
|---|-----------|
| R1 | El aplicativo cubrira alrededor de **10 metodos** a lo largo del semestre. |
| R2 | Para el **primer parcial** son seis: Newton-Raphson, Interpolacion de Newton, Von Mises, Runge-Kutta, Interpolacion de Lagrange y Punto Medio. |
| R3 | La arquitectura **debe poder expandirse** para admitir los metodos restantes. |
| R4 | Precision de **6 decimales por defecto**, ajustable por el usuario. |
| R5 | Se puede pedir el calculo hasta **cualquier iteracion n**, desde el valor inicial. |
| R6 | **Tabla con todas las iteraciones**, no solo el resultado final. |
| R7 | **Graficacion** de los ejercicios. |
| R8 | Interpolacion de Newton debe **mostrar el polinomio expandido**. |
| R12 | **Interpolacion de Lagrange**, agregada sobre el cierre del parcial con sus diapositivas propias. |
| R14 | **Metodo de Simpson (U1)**, agregado a partir de `Método de Simpson.pdf`; con `n` par, debe seguir los dos casos del material (`n = 2` y `n > 2` con puntos medios) y mostrar cada punto con su peso y los arcos de parabola. |
| R13 | **Metodo del Trapecio (U1)**, agregado a partir del material de integracion numerica entregado; debe mostrar los puntos de particion, sus pesos y los trapecios. |
| R9 | Runge-Kutta debe resolver **sistemas de ecuaciones**, y aceptar tanto el paso `h` como el numero de pasos. |
| R10 | Newton-Raphson: **la app deriva sola**, pero el usuario tambien puede escribir la derivada. |
| R11 | Los **tres criterios de error** implementados y **configurables**. |
| R15 | **Simpson 1/3 (U1)**, de `Simpson1.pdf`: parabolas por tres nodos equiespaciados, con `n` par y los pesos `1, 4, 2, 4, ..., 4, 1`. El ejercicio del material es `exp(x^2)` en `[0, 1]` con `n = 10`. Es la misma regla que Simpson con `2n`. |
| R16 | **Simpson 3/8 (U1)**: cubicas por cuatro nodos equiespaciados, con `n = 3` o multiplo de 3, y la **aplicacion multiple** (1/3 mas 3/8) cuando `n` no es multiplo de 3, como en el ejemplo 21.6 de Chapra. Cada regla muestra su corchete y su factor. |
| R17 | **Ajuste por minimos cuadrados (U4)**: la recta `y = m x + b` con su correlacion `r`, la tabla del docente con su fila de totales, y los modelos potencial, exponencial y logaritmico. El ejercicio del docente da `m = 1.90`, `b = 0.22` y `r = 0.9976`. |

### Decisiones del equipo sobre la interfaz

No las pidio el docente; se dejan escritas porque tienen pruebas.

| # | Requisito |
|---|-----------|
| R18 | La aplicacion abre en una **portada** con una tarjeta por metodo, y la ruta vive en la direccion de la pagina: `#/` es la portada y `#/metodo/<slug>` un metodo. Atras, Adelante y los enlaces directos funcionan. |
| R19 | Cada metodo tiene una pestana **Teoria**, que se lee sin resolver, con la explicacion, la formula, los pasos y un ejemplo a mano verificado. |

## Los metodos

Los once que hay hoy, en el orden del desplegable (el campo `orden` de cada
`MethodSpec`; una prueba de `tests/test_contract.py` fija la lista completa):

| orden | Metodo | slug | Unidad | Familia | Material |
|---|---|---|---|---|---|
| 1 | Newton-Raphson | `newton-raphson` | U1 | raices | ejercicios de clase |
| 2 | Von Mises | `von-mises` | U1 | raices | `VON MISES.pdf` |
| 3 | Interpolacion de Newton | `interpolacion-newton` | U1 | interpolacion | `Interpolacion del metodo de Newton.pdf` |
| 4 | Interpolacion de Lagrange | `interpolacion-lagrange` | U1 | interpolacion | `INTERPOLACION DE LAGRANGE.pdf` |
| 5 | Punto Medio | `punto-medio` | U1 | integracion | ejemplo del parcial 1 |
| 6 | Metodo del Trapecio | `trapecio` | U1 | integracion | material de integracion numerica |
| 7 | Metodo de Simpson | `simpson` | U1 | integracion | `Método de Simpson.pdf` |
| 8 | Simpson 1/3 | `simpson-13` | U1 | integracion | `Simpson1.pdf` |
| 9 | Simpson 3/8 | `simpson-38` | U1 | integracion | `Simpson 1/3 y 3/8.pdf` y Chapra 21.6 |
| 10 | Runge-Kutta | `runge-kutta` | U3 | edo | pedido del docente: sistemas, paso h o numero de pasos |
| 11 | Ajuste por minimos cuadrados | `minimos-cuadrados` | U4 | ajuste | ejercicio del docente |

## Von Mises: no es el metodo de las potencias

Confirmado con el material del docente (`VON MISES.pdf`). Es una variante de
Newton-Raphson que **congela la derivada en el punto inicial**:

    x_{i+1} = x_i - f(x_i) / f'(x_0)

Newton-Raphson se vuelve problematico en puntos alejados de la raiz y cercanos
a donde `f'(x_i)` tiende a cero. Von Mises sustituye el denominador `f'(x_i)`
por `f'(x_0)`, que geometricamente equivale a trazar paralelas a la primera
tangente en vez de tangentes nuevas.

**Consecuencia para la arquitectura:** ningun metodo del primer parcial usa
matrices. Las familias de entrada son tres, no cuatro. `FieldKind.MATRIX` y
`FieldKind.VECTOR` quedan declarados para los metodos que vengan despues, pero
hoy no los consume nadie.

| Metodo | Unidad | Entrada | Salida |
|--------|--------|---------|--------|
| Newton-Raphson | U1 | `f(x)`, x0 | raiz |
| Von Mises | U1 | `f(x)`, x0 | raiz |
| Interpolacion de Newton | U1 | tabla de puntos, x a evaluar | polinomio expandido, forma de Newton y valor |
| Interpolacion de Lagrange | U1 | tabla de puntos, x a evaluar | polinomio expandido y valor |
| Punto Medio | U1 | `f(x)`, a, b, n | integral aproximada, con cada punto medio y su rectangulo |
| Metodo del Trapecio | U1 | `f(x)`, a, b, n | integral aproximada, con los puntos extremos, sus pesos y cada trapecio |
| Metodo de Simpson | U1 | `f(x)`, a, b, n par | integral aproximada, con los extremos, los puntos medios, sus pesos y cada arco de parabola |
| Runge-Kutta | U3 | `f(x,y)` o sistema, condiciones iniciales, h o n | tabla solucion |

## Como se cumple cada requisito

- **R3** — `core/types.py` define `MethodSpec` y `core/registry.py` el registro.
  Agregar un metodo es crear un archivo en `core/methods/`. No se toca ningun
  archivo existente del nucleo ni de la API. El formulario se dibuja solo desde
  los `InputField`. La interfaz pide ademas la formula del metodo en
  `web/formulas.js` y su teoria en `web/teoria.js`, y su familia en `FAMILIAS` de
  `web/app.js` si es nueva.
- **R4** — `core/precision.py`, rango 2..12, por defecto 6.
- **R5** — `SolveConfig.max_iterations`. Con `stop_on_tolerance=False` corre
  exactamente n iteraciones aunque ya haya convergido.
- **R6** — `MethodResult.iterations` mas `MethodResult.columns`: cada metodo
  declara las columnas de su propia tabla.
- **R7** — `MethodResult.plot`, construido por `core/plots.py`.
- **R11** — `core/errors.py`. Por defecto **relativo porcentual**, que es el
  que usa el docente en la tabla de `VON MISES.pdf`. Verificado contra sus
  numeros en `tests/test_contract.py`.

## Casos de referencia

En `tests/casos_referencia.py`, sacados del material del docente (Von Mises,
Newton, Lagrange, Punto Medio, Simpson 1/3, Simpson 3/8 y minimos cuadrados). Son la vara para medir si un metodo esta bien:
reproducir estos numeros o esta mal.

`f(x) = e^-x - ln(x)`, `x0 = 1`, derivada congelada `f'(1) = -1.36787944`:

| i | xi | f(xi) | x(i+1) | \|er\| % |
|---|-----|-------|--------|---------|
| 0 | 1 | 0.36787944 | 1.26894142 | - |
| 1 | 1.26894142 | 0.042946035 | 1.30033749 | 2.4144554 |
| 2 | 1.30033749 | 0.00981599 | 1.307513555 | 0.54883309 |

Ejercicio propuesto en clase, sin resolver:
`4x^3 - 18x^2 + 12x - 6 = 0` con `x0 = 1.165`.

## Interpolacion de Lagrange

El docente entrego las diapositivas sobre el cierre del parcial. El
procedimiento que evalua tiene cinco pasos, y la tabla del aplicativo los
muestra los cinco:

    L_i(x) = producto sobre j != i de (x - x_j) / (x_i - x_j)
    P_n(x) = suma de f(x_i) * L_i(x)

**Consecuencia para la arquitectura:** es el primer metodo cuya tabla lleva
**expresiones y no mediciones**. `Column.numeric` ya existia para eso y la
interfaz ya sabia dibujarlo, pero la serializacion y el esquema HTTP solo
admitian numeros, asi que las celdas simbolicas llegaban vacias. Ver
`docs/CONTRATO.md`, seccion "Respuesta".

Casos de referencia en `tests/casos_referencia.py` (`LAGRANGE_RESUELTO` y
`LAGRANGE_EJERCICIO`): los dos ejercicios resueltos en clase y el propuesto.

## Preguntas que siguen abiertas

Ninguna bloquea.

1. **Runge-Kutta** — que orden? Se implementan **2 (Heun) y 4 (clasico)**, con
   4 por defecto.
2. **Fecha de entrega del primer parcial** y formato (repositorio, informe,
   sustentacion). No hay rubrica: el docente confirmo que no existe.

### Cerradas por el material del docente

- **Interpolacion de Newton: divididas o finitas?** **Divididas.** El PDF
  `Interpolacion del metodo de Newton.pdf` usa solo diferencias divididas en
  sus ocho diapositivas; las finitas no aparecen. Es el default del metodo.
  Las otras tres variantes quedan disponibles.

## Sin rubrica

El docente confirmo que **no hay rubrica**, aunque el silabo la declara como
instrumento de evaluacion formativa en las cuatro unidades. Conviene guardar
constancia escrita de los requisitos acordados: esta especificacion cumple esa
funcion, y por eso se versiona junto al codigo.
