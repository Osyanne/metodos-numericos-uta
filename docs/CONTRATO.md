# Contrato de datos y superficie HTTP

CONGELADO. El nucleo, la API y la interfaz programan contra este documento.
Cambiar algo de aca las rompe a las tres, asi que se revisa antes de tocarlo.

## Peticion

`POST /api/methods/{slug}/solve`

```json
{
  "params": { },
  "decimals": 6,
  "max_iterations": 50,
  "tolerance": 1e-6,
  "error_criterion": "relativo_porcentual",
  "stop_on_tolerance": true
}
```

`max_iterations` es la n que pide el docente. Con `stop_on_tolerance` en `false`
el metodo corre exactamente n iteraciones aunque ya haya convergido, que es lo
que hace falta cuando el ejercicio pide "la iteracion 7".

`error_criterion` acepta `absoluto`, `relativo` o `relativo_porcentual`.

## params de cada metodo

Ya confirmados con el docente. Lo que sigue abierto esta marcado.

### newton-raphson

```json
{ "fx": "x**3 - 2*x - 5", "x0": 2.0, "dfx": null }
```

`x_{i+1} = x_i - f(x_i) / f'(x_i)`

`dfx` en `null` es el caso normal: **la derivada la calcula el aplicativo**.
El campo existe para que el usuario tambien pueda escribirla a mano, que es
la segunda forma que pidio el docente.

### von-mises

```json
{ "fx": "exp(-x) - log(x)", "x0": 1.0, "dfx": null }
```

`x_{i+1} = x_i - f(x_i) / f'(x_0)`

Misma entrada que Newton-Raphson: **no es el metodo de las potencias para
autovalores**, es la variante de Newton-Raphson que congela la derivada en el
punto inicial. Sirve cuando `f'(x_i)` se acerca a cero y Newton-Raphson se
vuelve inestable; geometricamente traza paralelas a la primera tangente.

**El error tipico de implementacion:** el algoritmo del docente reasigna
`x_0 = x` en cada paso pero la derivada la deja en `f'(x_00)`, el x_0 original.
Si se recalcula la derivada con el x_0 actualizado, esto se convierte en
Newton-Raphson y los numeros dejan de coincidir con los de clase. La derivada
se evalua **una sola vez, antes del bucle**.

Caso de referencia con la tabla del docente en `tests/casos_referencia.py`.

### interpolacion-newton

```json
{
  "points": [[1.0, 0.0], [4.0, 1.386294], [6.0, 1.791759]],
  "x": 2.0,
  "variante": "auto"
}
```

Los puntos van en el orden en que el usuario los cargo, sin reordenar.

**El docente pide el polinomio expandido**, y ademas escribe en el pizarron la
forma anidada y los coeficientes `a_i`, asi que `result` lleva:

```json
{
  "polinomio": "-0.0518731*x**2 + 0.7214635*x - 0.6695904",
  "polinomio_newton": "0 + 0.462098*(x - 1) + (-0.0518731)*(x - 1)*(x - 4)",
  "coeficientes": [0.0, 0.462098, -0.0518731],
  "valor": 0.5658442,
  "grado": 2,
  "variante_usada": "divididas"
}
```

`polinomio` y `polinomio_newton` son el mismo polinomio: el primero expandido,
el segundo conservando los factores y el orden en que se cargaron los puntos.
`coeficientes` es la diagonal de diferencias divididas, `[a_0, a_1, ...]`, **sin
redondear**.

`polinomio_newton` se arma a mano, no con `str()` de SymPy, para que se lea
como en el pizarron:

- cada `a_i` se escribe aunque valga 0 o 1, y si es negativo va entre
  parentesis, tambien `a_0`: `(-2) + 2*(x + 3) + (-1)*(x + 3)*(x - 0)`;
- el producto va explicito (`*`), asi el parser la puede releer;
- los binomios llevan el signo resuelto, `(x + 3)` y no `(x - -3)`, y
  `(x - 0)` no se reduce a `x`, igual que en Lagrange.

**La tabla de `divididas` pone cada diferencia en la fila de su ultimo
punto**, como las diapositivas 5 y 7: `f(X_i-k, ..., X_i)` va en la fila `i`,
la fila 0 no lleva ninguna y los `a_k` quedan sobre la diagonal. Es la misma
tabla cuando la elige `auto`.

**`variante` acepta cuatro valores, y el default es `divididas`.** El material
del docente (`Interpolacion del metodo de Newton.pdf`) usa **solo diferencias
divididas**: las finitas no aparecen en ninguna de sus ocho diapositivas. Las
otras tres variantes quedan disponibles porque la tabla se ve distinta segun
cual sea y no cuesta nada ofrecerlas.

| valor | que hace |
|-------|----------|
| `divididas` | **por defecto**. Diferencias divididas, como el docente. Funciona siempre. |
| `auto` | si los x estan igualmente espaciados usa `adelante`; si no, `divididas`. |
| `adelante` | diferencias finitas hacia adelante (Newton-Gregory). Exige x equiespaciados. |
| `atras` | diferencias finitas hacia atras. Exige x equiespaciados. |

Pedir `adelante` o `atras` con puntos no equiespaciados es `MethodError`
explicando que esa variante necesita paso constante.

Con `adelante` o `atras`, `coeficientes` y `polinomio_newton` siguen saliendo de
diferencias divididas, asi que no coinciden con ninguna celda de la tabla.
`notes` lo aclara, y con `adelante` da la relacion: `a_k` es la diferencia
adelante `k` de la fila 0 dividida por `k! * h^k`.

El polinomio resultante es **el mismo** en las cuatro: por n+1 puntos pasa un
unico polinomio de grado n. Lo que cambia es la tabla que se muestra. Por eso
`variante_usada` viaja en el resultado, para que la interfaz pueda decir cual
salio.

### interpolacion-lagrange

```json
{
  "points": [[0.0, 1.0], [1.0, 3.0], [2.0, 0.0]],
  "x": 1.5
}
```

No tiene variantes: el procedimiento de Lagrange es uno solo.

```json
{
  "polinomio": "-2.5*x**2 + 4.5*x + 1.0",
  "valor": 2.125,
  "grado": 2
}
```

**La tabla es el procedimiento, no una convergencia.** Cada fila es un `i`, y
las columnas siguen los cinco pasos de la diapositiva del docente:

| key | que es | `numeric` |
|-----|--------|-----------|
| `xi` | la abscisa del punto | si |
| `yi` | `f(x_i)` | si |
| `numerador` | `(x - x_j)` para todo `j != i`, factorizado | **no** |
| `denominador` | `(x_i - x_j)` para todo `j != i`, con los valores sustituidos | **no** |
| `Li` | `L_i(x)` expandido | **no** |
| `termino` | `f(x_i) * L_i(x)` expandido | **no** |
| `Li_evaluado` | `L_i` en la `x` pedida | si |

Los binomios se escriben con el signo ya resuelto: con `x_j = -4` sale
`(x + 4)`, no `(x - -4)`. El `(x - 0)` **no** se reduce a `x`, para que la fila
se lea contra la tabla de puntos sin reconstruir que termino falta.

Como `interpolacion-newton` y `interpolacion-lagrange` construyen el mismo
polinomio por caminos distintos, hay una prueba que los corre sobre los mismos
puntos y exige que coincidan. Si difieren, uno de los dos esta mal.

Casos de referencia del docente en `tests/casos_referencia_lagrange.py`.

### runge-kutta

Una sola ecuacion:

```json
{ "fxy": "x + y", "x0": 0.0, "y0": 1.0, "h": 0.1, "n": 5, "orden": 4 }
```

Sistema de ecuaciones (lo pidio el docente):

```json
{ "fxy": ["y2", "-y1"], "x0": 0.0, "y0": [1.0, 0.0], "h": 0.1, "n": 10, "orden": 4 }
```

En un sistema, `fxy` es una lista de expresiones y `y0` una lista de la misma
longitud. Las variables disponibles son `x` mas `y1`, `y2`, ... segun cuantas
ecuaciones haya. En una sola ecuacion la variable es `y`.

**Paso o numero de pasos, cualquiera de los dos** (lo pidio el docente).
Se aceptan `h`, `n` y `xf` en estas combinaciones:

| Viene | Se calcula |
|-------|-----------|
| `h` y `n` | `xf = x0 + n*h` |
| `h` y `xf` | `n = round((xf - x0) / h)` |
| `n` y `xf` | `h = (xf - x0) / n` |
| solo `h` | `n = max_iterations` |

Si vienen los tres y no son consistentes: `MethodError`, sin adivinar.

`orden` acepta 2 (Heun) o 4 (Runge-Kutta clasico). Por defecto 4. El docente
no confirmo cual quiere, asi que estan los dos. **Abierto.**

## Respuesta

```json
{
  "method": "newton-raphson",
  "columns": [
    {"key": "xi", "label": "xi", "numeric": true},
    {"key": "fxi", "label": "f(xi)", "numeric": true}
  ],
  "iterations": [
    {"n": 0, "values": {"xi": 2.0, "fxi": -1.0}, "error": null},
    {"n": 1, "values": {"xi": 2.1, "fxi": 0.061}, "error": 4.761905}
  ],
  "result": {"raiz": 2.094551},
  "converged": true,
  "stop_reason": "tolerancia_alcanzada",
  "decimals": 6,
  "plot": { },
  "notes": []
}
```

Reglas duras:

- `columns` manda sobre `iterations`: la tabla se dibuja recorriendo `columns`
  y buscando esa `key` en `values`. Una key que no este en `columns` no se muestra.
- La iteracion 0 siempre tiene `error: null`. No hay valor anterior con que compararla.
- **Ningun numero puede ser `Infinity` ni `NaN`.** JSON no los admite y
  `JSON.parse` los rechaza. Todo valor numerico pasa por
  `core.serialization.finite_or_none`, que los convierte en `null`. La interfaz
  muestra `null` como `—` y busca la explicacion en `stop_reason` y `notes`.
- **Una celda es una medicion o una expresion.** Las columnas con
  `numeric: false` llevan texto: el polinomio base de una interpolacion se
  muestra factorizado y no hay ningun float que lo represente. Esas celdas
  viajan como string y la interfaz las imprime tal cual, sin pasarlas por el
  formateo de decimales. El camino completo es
  `core.serialization.cell_value` -> `IterationSchema.values`
  (`dict[str, float | str | None]`) -> `web/tabla.js`, y la exportacion a CSV y
  PDF las escribe sin tocar.
- **`finite_or_none` no admite texto y no debe admitirlo.** Es la misma funcion
  que usa `POST /api/plot/sample`: si dejara pasar strings, una expresion sin
  evaluar viajaria como punto de la curva. Las celdas de texto pasan por
  `cell_value`, que es otra cosa.
- **`error` siempre es una medicion.** Nunca lleva texto, aunque la fila tenga
  columnas simbolicas.
- `stop_reason` es uno de: `tolerancia_alcanzada`, `n_iteraciones_completadas`,
  `solucion_exacta`, `integracion_completada`, `divergio`, `fallo`.
- **`integracion_completada`** es el final normal de un metodo de malla fija
  (Runge-Kutta): recorrio sus n pasos y ninguno perdio la finitud. No es un
  aviso: la interfaz lo muestra en verde, igual que `tolerancia_alcanzada`.
  `n_iteraciones_completadas` queda para los metodos iterativos que si
  persiguen una tolerancia y se quedaron sin iteraciones antes de alcanzarla.
- **Un metodo de paso unico no reporta error por iteracion.** Runge-Kutta manda
  `error: null` en todas las filas y explica por que en `notes`. La diferencia
  entre `y(i+1)` e `y(i)` mide cuanto cambio la solucion, no cuanto se equivoca,
  y con una solucion que cruza el cero llega a valores absurdos.
- **Si el metodo diverge no hay raiz, tampoco en la grafica.** `result.raiz` y
  `plot.series.root` valen los dos `null`. Marcar el ultimo iterado sobre el eje
  x lo presenta como una raiz que el metodo nunca encontro.

## Graficas: un plano interactivo, no una imagen

El docente lo pidio **tipo GeoGebra**: plano cartesiano con ejes, cuadricula,
zoom con la rueda y paneo arrastrando. Eso tiene una consecuencia tecnica que no
es obvia.

Al hacer zoom, la curva **se tiene que recalcular en el rango visible**. Si se
dibujan siempre los mismos puntos que vinieron en la respuesta, al acercarse se
ve una linea quebrada en vez de una curva.

Quien evalua es siempre el nucleo. Si la interfaz evaluara por su cuenta harian
falta dos parsers, y dos parsers pueden discrepar justo en lo que el docente
califica.

#### decimals es formato, no calculo

`decimals` viaja en la respuesta para que **la interfaz** formatee, con
`core.precision.format_value`. Los numeros de `iterations`, de `result` y de las
graficas van **sin redondear**, con toda la precision que salio del calculo.

No es un detalle estetico. Si se guardaran redondeados:

- pedir 2 decimales degradaria la curva de la grafica, que se veria escalonada;
- exportar a CSV perderia precision de forma permanente;
- el remuestreo al hacer zoom devolveria valores mas finos que los de la tabla,
  y las dos cosas no coincidirian entre si.

Redondear al mostrar es reversible; redondear al guardar no lo es.

## plot.series segun plot.kind

Lo construye `core/plots.py`. La interfaz no lee otras claves que estas.

| kind | series | remuestrea? |
|------|--------|-------------|
| `funcion_raiz` | `{"curve": {"x": [], "y": []}, "root": {"x", "y"} \| null, "iterates": [{"n", "x", "y"}]}` | si |
| `interpolacion` | `{"points": [[x, y]], "curve": {"x": [], "y": []}, "evaluated": {"x", "y"} \| null}` | si |
| `convergencia` | `{"n": [], "error": []}` (misma longitud; error admite null) | no |
| `solucion_edo` | `{"solution": {"x": [], "components": [{"name", "y": []}]}, "exact": igual \| null}` | no |

`convergencia` y `solucion_edo` no remuestrean porque son **puntos discretos**:
salieron de correr el metodo con un paso y un numero de iteraciones dados. No hay
mas resolucion que obtener sin volver a resolver. Ahi el zoom reescala la vista.

`solucion_edo` lleva **una componente por incognita**, con la misma forma tanto
para una sola ecuacion (una componente llamada `y`) como para un sistema (`y1`,
`y2`, ...). La interfaz dibuja una linea por componente sin tener que saber si
atras hay un sistema. Lo pide R9: Runge-Kutta resuelve sistemas.

### El bloque `resample`

Las graficas que si remuestrean llevan:

```json
"resample": {
  "expression": "exp(-x) - log(x)",
  "variables": ["x"],
  "domain": [0.1, 5.0]
}
```

Si `resample` es `null`, la interfaz solo reescala lo que ya tiene.

### POST /api/plot/sample

```json
{ "expression": "exp(-x) - log(x)", "variables": ["x"],
  "x_min": 0.5, "x_max": 2.0, "points": 400 }
```

Respuesta:

```json
{ "x": [0.5, 0.503, ...], "y": [1.299, 1.294, ..., null, ...] }
```

Lo resuelve `core.sampling.sample`, que ya esta hecho y probado. La ruta solo
traduce JSON.

**`y` lleva `null` donde la funcion no esta definida, y ahi la linea se corta.**
No se unen los dos lados: si se unen, `1/x` se dibuja con una raya vertical falsa
cruzando la asintota y `tan(x)` queda irreconocible.

Rango invertido, expresion invalida o pedir mas de 5000 puntos: `MethodError`,
que sale como 422.

### Como construirlo sin morir en el intento

Conviene hacerlo en dos etapas, porque la primera ya es entregable:

1. **Plano estatico.** Ejes, cuadricula, la curva con los puntos que vinieron en
   la respuesta, la raiz y los iterados marcados. Sin zoom.
2. **Interactivo.** Zoom con la rueda, paneo arrastrando, y al soltar se pide un
   muestreo nuevo del rango visible. Conviene pedir un rango mas ancho que el
   visible para que un paneo chico no dispare otra peticion, y esperar unos
   150 ms antes de pedir.

Canvas plano alcanza y sobra; no hace falta una libreria de graficas para esto,
y una libreria de charts no sirve porque estan pensadas para series de datos, no
para funciones. Sea cual sea la decision, tiene que funcionar **sin internet**:
nada traido de un CDN.

## Superficie HTTP completa

Congelada. La interfaz programa contra esta lista sin esperar a que la API
exista, y la API la implementa sin esperar a la interfaz.

| Metodo y ruta | Devuelve |
|---|---|
| `GET /api/methods` | lista de `MethodSummary`, con sus `inputs` |
| `GET /api/methods/{slug}` | un `MethodSummary` |
| `POST /api/methods/{slug}/solve` | `SolveResponse` |
| `POST /api/plot/sample` | `SampleResponse` |
| `POST /api/methods/{slug}/export/{formato}` | archivo, `formato` es `csv` o `pdf` |
| `GET /` y estaticos | lo que hay en `web/` |

### Exportar

Mismo cuerpo que `solve`. La API resuelve y devuelve el archivo, para que la
tabla exportada sea exactamente la que se calculo y no una copia que la interfaz
haya rearmado por su cuenta.

- `csv`: `text/csv`. Cabecera con `i`, las `columns` del metodo y `error`. Los
  numeros van **sin redondear**; redondear es cosa de la pantalla.
- `pdf`: `application/pdf`. Metodo, funcion, parametros, la tabla de iteraciones
  y el resultado. Se genera con `fpdf2`, que ya esta en `pyproject.toml`.

Los dos responden con `Content-Disposition: attachment` y un nombre de archivo
que incluya el slug del metodo.

### Servir la interfaz

`api/main.py` monta `web/` como estatico y sirve `web/index.html` en la raiz.
Todo tiene que andar **sin internet**: nada de librerias traidas de un CDN.

## Errores

Un fallo con causa matematica es `MethodError` y sale como **HTTP 422** con el
mensaje tal cual, que tiene que explicar la causa en terminos del problema:

```json
{"detail": "La derivada se anula en x = 1.0, el metodo no puede continuar."}
```

Metodo inexistente: **404**. Params invalidos o incompletos: **422**.
Cualquier otra excepcion es un bug: **500**, y no se le muestra al usuario.

## Arranque del registro

`api/main.py` expone `create_app(cargar_metodos: bool = True)`. En produccion
llama a `registry.load_methods()` al arrancar. Las pruebas de la API construyen
la app con `cargar_metodos=False` y registran los metodos falsos que necesiten,
para no depender de los metodos reales.

En pruebas, despues de `registry.clear()` hay que usar
`registry.load_methods(force=True)`: sin `force` el cache de imports de Python
hace que no se vuelva a registrar nada.
