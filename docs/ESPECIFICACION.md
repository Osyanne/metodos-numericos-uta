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

## Como se cumple cada uno

- **R3** — `core/types.py` define `MethodSpec` y `core/registry.py` el registro.
  Agregar un metodo es crear un archivo en `core/methods/` que construya un
  `MethodSpec` y lo registre. No se toca ningun archivo existente. El formulario
  de la interfaz se dibuja solo, a partir de los `InputField` que el metodo declara.
- **R4** — `core/precision.py`. Rango 2..12 decimales, 6 por defecto. El minimo de 2
  sale de lo que dijo el docente; el maximo de 12 es para no perder informacion al
  validar contra ejercicios de referencia.
- **R5** — `SolveConfig.max_iterations` es la n. Con `stop_on_tolerance=False` el
  metodo corre exactamente n iteraciones aunque ya haya convergido, que es lo que
  hace falta cuando el ejercicio pide "la iteracion 7".
- **R6** — `MethodResult.iterations` mas `MethodResult.columns`: cada metodo declara
  las columnas de su propia tabla, porque las de Runge-Kutta no son las de Von Mises.
- **R7** — `MethodResult.plot`. El nucleo entrega puntos ya calculados; dibujar es
  responsabilidad de la interfaz.

## Las cuatro familias de entrada

Los cuatro metodos del primer parcial no comparten forma de entrada, y eso define
la arquitectura. Los seis que faltan caen casi con seguridad en estas mismas familias.

| Metodo | Unidad | Entrada | Salida |
|--------|--------|---------|--------|
| Newton-Raphson | U1 | `f(x)`, x0 | raiz |
| Interpolacion de Newton | U2 | tabla de puntos, x a evaluar | polinomio y valor |
| Von Mises | — | matriz A, vector inicial | autovalor dominante |
| Runge-Kutta | U3 | `f(x,y)`, (x0,y0), h | tabla solucion |

## Preguntas abiertas

Ninguna bloquea el nucleo, pero todas cambian detalles de implementacion.
Actualizar este archivo apenas haya respuesta.

1. **Von Mises** — confirmar que es el metodo de las potencias para el autovalor
   dominante. Si lo es: solo el dominante, o tambien potencia inversa y deflacion?
   Normalizacion con norma infinito o euclidiana?
2. **Interpolacion de Newton** — diferencias divididas o diferencias finitas?
   Hay que mostrar el polinomio expandido o basta evaluar en un x?
3. **Runge-Kutta** — que orden? Solo PVI de primer orden, o tambien sistemas?
   Se ingresa el paso h o el numero de pasos?
4. **Newton-Raphson** — la app deriva `f'(x)` sola o la ingresa el usuario?
5. **Criterio de error** — absoluto, relativo o relativo porcentual? Los tres estan
   implementados y el criterio es configurable, asi que esto solo fija el valor por
   defecto. Hoy: relativo porcentual.
6. **Los otros seis metodos** — saber la lista evita equivocarse en el punto de extension.
7. **Administrativo** — rubrica, peso en la nota, fecha del parcial, formato de entrega.
