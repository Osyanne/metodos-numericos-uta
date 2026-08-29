# Especificacion del aplicativo

Asignatura: METODOS NUMERICOS (UTA-FISEI-SF-MP-UB-03-01) — Software, Nivel 3.
Docentes: Ing. Henry Cumbal, Dr. Victor Penafiel.

## Confirmado por el docente

| # | Requisito |
|---|-----------|
| R1 | El aplicativo cubrira alrededor de **10 metodos** a lo largo del semestre. |
| R2 | Para el **primer parcial** son cuatro: Newton-Raphson, Interpolacion de Newton, Von Mises y Runge-Kutta. |
| R3 | La arquitectura **debe poder expandirse** para admitir los metodos restantes. |
| R4 | Precision de **6 decimales por defecto**, ajustable por el usuario. |
| R5 | Se puede pedir el calculo hasta **cualquier iteracion n**, desde el valor inicial. |
| R6 | **Tabla con todas las iteraciones**, no solo el resultado final. |
| R7 | **Graficacion** de los ejercicios. |
| R8 | Interpolacion de Newton debe **mostrar el polinomio expandido**. |
| R9 | Runge-Kutta debe resolver **sistemas de ecuaciones**, y aceptar tanto el paso `h` como el numero de pasos. |
| R10 | Newton-Raphson: **la app deriva sola**, pero el usuario tambien puede escribir la derivada. |
| R11 | Los **tres criterios de error** implementados y **configurables**. |

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
| Interpolacion de Newton | U2 | tabla de puntos, x a evaluar | polinomio expandido y valor |
| Runge-Kutta | U3 | `f(x,y)` o sistema, condiciones iniciales, h o n | tabla solucion |

## Como se cumple cada requisito

- **R3** — `core/types.py` define `MethodSpec` y `core/registry.py` el registro.
  Agregar un metodo es crear un archivo en `core/methods/`. No se toca ningun
  archivo existente. El formulario se dibuja solo desde los `InputField`.
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

En `tests/casos_referencia.py`, sacados del material del docente. Son la vara
para medir si un metodo esta bien: reproducir estos numeros o esta mal.

`f(x) = e^-x - ln(x)`, `x0 = 1`, derivada congelada `f'(1) = -1.36787944`:

| i | xi | f(xi) | x(i+1) | \|er\| % |
|---|-----|-------|--------|---------|
| 0 | 1 | 0.36787944 | 1.26894142 | - |
| 1 | 1.26894142 | 0.042946035 | 1.30033749 | 2.4144554 |
| 2 | 1.30033749 | 0.00981599 | 1.307513555 | 0.54883309 |

Ejercicio propuesto en clase, sin resolver:
`4x^3 - 18x^2 + 12x - 6 = 0` con `x0 = 1.165`.

## Preguntas que siguen abiertas

Ninguna bloquea. Cada respuesta ahorra implementar dos variantes.

1. **Interpolacion de Newton** — diferencias divididas o diferencias finitas?
   Se implementa **divididas**, que es el caso general y cubre tambien puntos
   equiespaciados.
2. **Runge-Kutta** — que orden? Se implementan **2 (Heun) y 4 (clasico)**, con
   4 por defecto.
3. **Fecha de entrega del primer parcial** y formato (repositorio, informe,
   sustentacion). No hay rubrica: el docente confirmo que no existe.

## Sin rubrica

El docente confirmo que **no hay rubrica**, aunque el silabo la declara como
instrumento de evaluacion formativa en las cuatro unidades. Conviene guardar
constancia escrita de los requisitos acordados: esta especificacion cumple esa
funcion, y por eso se versiona junto al codigo.
